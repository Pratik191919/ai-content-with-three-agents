const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isValidRedisUrl } = require('./redis-helper');
const FEATURES = require('./features');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
let WP_COM_TOKEN = process.env.WP_COM_TOKEN ? process.env.WP_COM_TOKEN.trim() : null;
if (WP_COM_TOKEN && WP_COM_TOKEN.includes('%')) {
    try { WP_COM_TOKEN = decodeURIComponent(WP_COM_TOKEN); } catch (e) {}
}

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try {
        await supabase.from('agent_logs').insert({
            agent_name: agentName, event_type: eventType, message: message, metadata: metadata
        });
    } catch (err) {}
}

async function processImageGeneration(briefId) {
    if (!FEATURES.image_enabled) {
        console.log(`Agent Image: Feature disabled. Skipping for brief ${briefId}`);
        await publishNextEvent(briefId);
        return;
    }

    console.log(`Agent Image: Generating images for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        // Free Image Generation via Pollinations.ai
        const { generateWithFallback } = require('./llm_helper');
        
        // 1. Generate an optimized image prompt using Gemini
        const promptTemplate = `Create a highly descriptive, cinematic, and stunning image generation prompt based on this blog title: "${contentData.title}". Output ONLY the prompt text, no quotes or intro.`;
        const imagePrompt = (await generateWithFallback(promptTemplate, 0.7)).trim();
        
        // 2. Encode for Pollinations API
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1200&height=630&nologo=true`;
        
        // 3. Inject the image perfectly into the top of the HTML content
        const imgTag = `\n<img src="${imageUrl}" alt="${contentData.title}" style="width: 100%; height: auto; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />\n`;
        const newHtml = imgTag + contentData.html_content;

        // 4. Update the DB
        await supabase.from('content').update({ 
            html_content: newHtml 
        }).eq('brief_id', briefId);
        
        await logActivity('Image Agent', 'SUCCESS', `Images processed and ready for publishing: ${contentData.title}`);
        await publishNextEvent(briefId);

    } catch (err) {
        console.error(`Agent Image Error:`, err);
        await logActivity('Image Agent', 'ERROR', `Failed Image Gen for brief ${briefId}: ${err.message}`);
        await publishNextEvent(briefId);
    }
}

async function publishNextEvent(briefId) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Publish to Publisher Agent
    await publishClient.publish('content_events', JSON.stringify({ event: 'image_completed', brief_id: briefId }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent Image listening for internal_linking_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'internal_linking_completed') processImageGeneration(data.brief_id);
        });
    } catch (err) {
        console.error('Agent Image listener failed:', err);
    }
}

listenForEvents();
