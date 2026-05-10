const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const axios = require('axios');
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
        await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata });
    } catch (err) {}
}

async function publishToWordPress(briefId) {
    console.log(`Agent Publisher: Publishing brief ${briefId} to WordPress...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        if (!WP_COM_TOKEN || !WP_COM_SITE) {
            console.warn('Agent Publisher: Missing WP Credentials. Skipping WP API call.');
            await triggerPostPublished(briefId, `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`);
            return;
        }

        // Atomic Optimistic Lock: Only publish if it hasn't been published yet
        const { data: updated, error: updateError } = await supabase
            .from('content')
            .update({ status: 'PUBLISHING_IN_PROGRESS' })
            .eq('brief_id', briefId)
            .eq('status', 'DRAFT')
            .select();

        if (updateError || !updated || updated.length === 0) {
            console.log(`Agent Publisher: Post for brief ${briefId} is already published or in progress by another worker.`);
            return;
        }

        // Build content with featured image at the top
        let finalContent = contentData.html_content || '';
        if (contentData.featured_image_url) {
            const featuredImgTag = `<img src="${contentData.featured_image_url}" alt="${contentData.title}" style="width:100%;height:auto;border-radius:12px;margin-bottom:24px;" />`;
            finalContent = featuredImgTag + finalContent;
        }

        const response = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/posts/new`, {
            title: contentData.title,
            content: finalContent,
            status: 'publish',
            featured_image: contentData.featured_image_url, // Pass URL directly if no WP media ID
            categories: contentData.category || 'General',
            tags: [contentData.category || 'Global', 'AI Hub', '2026']
        }, {
            headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}` }
        });

        if (response.data && response.data.ID) {
            const liveUrl = response.data.URL;
            console.log(`Agent Publisher: 🚀 POST PUBLISHED: ${liveUrl}`);
            
            await supabase.from('content').update({ 
                live_url: liveUrl,
                status: 'PUBLISHED'
            }).eq('brief_id', briefId);

            await supabase.from('content_briefs').update({ status: 'PUBLISHED' }).eq('id', briefId);
            await logActivity('Publisher Agent', 'SUCCESS', `Published to WP: ${contentData.title}`);

            await triggerPostPublished(briefId, liveUrl);
        }
    } catch (err) {
        console.error(`Agent Publisher Error:`, err.response?.data || err.message);
        await logActivity('Publisher Agent', 'ERROR', `Failed publishing brief ${briefId}`);
    }
}

async function triggerPostPublished(briefId, liveUrl) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Publish for Social Agent and others
    await publishClient.publish('content_events', JSON.stringify({ event: 'post_published', post_id: briefId, live_url: liveUrl }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent Publisher listening for image_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'image_completed') publishToWordPress(data.brief_id);
        });
    } catch (err) {
        console.error('Agent Publisher listener failed:', err);
    }
}

listenForEvents();
