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
    try {
        await supabase.from('agent_logs').insert({
            agent_name: agentName,
            event_type: eventType,
            message: message,
            metadata: metadata
        });
    } catch (err) {
        console.error('Logging failed:', err.message);
    }
}

async function processInternalLinking(briefId) {
    if (!FEATURES.internal_linking_enabled) {
        console.log(`Agent Internal Linking: Feature disabled. Skipping for brief ${briefId}`);
        await publishNextEvent(briefId);
        return;
    }

    console.log(`Agent Internal Linking: Adding internal links for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        // Fetch previously published posts to use as link targets
        const { data: previousPosts } = await supabase.from('content')
            .select('title, live_url')
            .eq('status', 'PUBLISHED')
            .not('live_url', 'is', null)
            .limit(10);

        let linkedHtml = contentData.html_content;

        if (previousPosts && previousPosts.length > 0) {
            const availableLinks = previousPosts.map(p => `- "${p.title}": ${p.live_url}`).join('\n');
            const prompt = `You are an SEO Internal Linking Expert.
            Take the following HTML blog post and strategically inject 1-3 internal links to our existing content.
            
            Here are the available published posts you can link to:
            ${availableLinks}
            
            Rules:
            1. Find a natural word or phrase in the HTML paragraph text to turn into a hyperlink (<a> tag).
            2. Do not change the overall structure or remove any existing HTML tags.
            3. Output ONLY the modified HTML code.
            
            HTML:
            ${contentData.html_content}`;

            const { generateWithFallback } = require('./llm_helper');
            const rawResponse = await generateWithFallback(prompt, 0.3);
            linkedHtml = rawResponse.replace(/```html/gi, '').replace(/```/gi, '').trim();
        }

        // Update database with linked content
        await supabase.from('content').update({ 
            html_content: linkedHtml 
        }).eq('brief_id', briefId);

        await logActivity('Internal Linking Agent', 'SUCCESS', `Internal links injected for: ${contentData.title}`);
        
        await publishNextEvent(briefId);

    } catch (err) {
        console.error(`Agent Internal Linking Error:`, err);
        await logActivity('Internal Linking Agent', 'ERROR', `Failed linking for brief ${briefId}: ${err.message}`);
        await publishNextEvent(briefId);
    }
}

async function publishNextEvent(briefId) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Publish to next agent in the chain (Image Agent)
    await publishClient.publish('content_events', JSON.stringify({ event: 'internal_linking_completed', brief_id: briefId }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent Internal Linking listening for seo_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        subClient.on('error', err => console.error('Agent Internal Linking Redis Error:', err.message));
        await subClient.connect();
        
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'seo_completed') {
                processInternalLinking(data.brief_id);
            }
        });
    } catch (err) {
        console.error('Agent Internal Linking listener failed:', err);
    }
}

listenForEvents();
