const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
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

async function repurposeContent(briefId) {
    console.log(`Agent Repurposing: Starting repurpose jobs for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        if (groq && supabase) {
            const prompt = `You are an expert Content Repurposer. I have a blog post.
            I need you to convert this into a viral 5-part Twitter Thread.
            
            Blog Title: ${contentData.title}
            Blog HTML Content:
            ${contentData.html_content}
            
            Output ONLY the Twitter thread. Separate each tweet with "---".`;
            
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            });

            const threadText = completion.choices[0].message.content.trim();

            await supabase.from('repurposed_content').insert([
                { content_id: contentData.id, format_type: 'Twitter_Thread', content_text: threadText }
            ]);
            
            await logActivity('Repurposing Agent', 'SUCCESS', `Created Twitter Thread from: ${contentData.title}`);
        }
    } catch (err) {
        console.error(`Agent Repurposing Error:`, err);
        await logActivity('Repurposing Agent', 'ERROR', `Failed repurposing for ${briefId}`);
    }
}

async function listenForEvents() {
    console.log('Agent Repurposing listening for post_published events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'post_published') repurposeContent(data.post_id || data.brief_id);
        });
    } catch (err) {
        console.error('Agent Repurposing listener failed:', err);
    }
}

listenForEvents();
