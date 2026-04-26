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

        // NOTE: In the fully refactored flow, the Freepik generation from agent_02 will be moved here.
        // It will: 1. Prompt Gemini 2. Call Freepik 3. Upload to WP 4. Save Media IDs to Supabase
        
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
