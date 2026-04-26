const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
const FEATURES = require('./features');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try { await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata }); } catch (err) {}
}

async function verifyFacts(briefId) {
    if (!FEATURES.fact_checking_enabled) {
        console.log(`Agent Fact-Checking: Feature disabled. Skipping for brief ${briefId}`);
        await publishNextEvent(briefId);
        return;
    }

    console.log(`Agent Fact-Checking: Verifying claims for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        let status = 'PASSED';
        let notes = 'All facts verified successfully.';

        const prompt = `You are an expert Fact Checker. Review the following blog post and identify any major factual errors, hallucinations, or false claims.
            If there are errors, list them clearly. If it is generally factually correct, respond with "PASSED".
            
            Blog HTML Content:
            ${contentData.html_content}`;
            
        const { generateWithFallback } = require('./llm_helper');
        const rawResult = await generateWithFallback(prompt, 0.1);
        const result = rawResult.trim();
        if (result !== 'PASSED') {
            status = 'FAILED';
            notes = result;
        }

        if (supabase) {
            await supabase.from('content').update({ 
                fact_check_status: status,
                fact_check_notes: notes
            }).eq('id', contentData.id);
        }
        
        await logActivity('Fact-Checking Agent', status === 'PASSED' ? 'SUCCESS' : 'WARNING', `Fact check completed: ${status}`);

        // Even if it failed, we might want to flag it for human review but continue the pipeline
        await publishNextEvent(briefId);

    } catch (err) {
        console.error(`Agent Fact-Checking Error:`, err);
        await logActivity('Fact-Checking Agent', 'ERROR', `Failed fact check for ${briefId}`);
        await publishNextEvent(briefId);
    }
}

async function publishNextEvent(briefId) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Hand off to SEO Agent
    await publishClient.publish('content_events', JSON.stringify({ event: 'fact_checking_completed', brief_id: briefId }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent Fact-Checking listening for writer_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            // This event is fired by Writer Agent (Agent 02)
            if (data.event === 'writer_completed') verifyFacts(data.brief_id);
        });
    } catch (err) {
        console.error('Agent Fact-Checking listener failed:', err);
    }
}

listenForEvents();
