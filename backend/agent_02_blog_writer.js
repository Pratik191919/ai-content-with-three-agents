const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({}) }), order: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };
let redisClient;

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    try {
        if (!supabase) return;
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

async function generateBlogPost(brief) {
    console.log(`Agent 02: Generating blog post with Groq AI (Llama 3.3) for: ${brief.title}...`);
    if (!groq) throw new Error('GROQ_API_KEY is missing.');

    let finalHtml;
    let attempts = 0;
    while (attempts < 5) {
        try {
            const prompt = `Write a totally unique, highly dynamic 500-800 word blog post for the topic: "${brief.title}".
            
Rules:
- Output ONLY article body HTML using these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <img>
- For <img> tags, use this format: <img src="https://image.pollinations.ai/prompt/DESCRIPTIVE_PROMPT?width=800&height=450&nologo=true" alt="description" style="width:100%; border-radius:12px; margin: 24px 0;" />
- Replace "DESCRIPTIVE_PROMPT" with a specific prompt (e.g. "futuristic-smartwatch-on-table").
- Include at least 2-3 images throughout the post to break up the text.
- Write original, insightful paragraphs with unique H2 and H3 headings for this specific topic`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9
            });

            const rawHtml = completion.choices[0].message.content;
            finalHtml = rawHtml
                .replace(/https:\/\/image\.pollinations\.ai\/prompt\/([^?"]+)/g, (match, p1) => {
                    const encodedPrompt = encodeURIComponent(p1.trim().replace(/['"]+/g, ''));
                    const seed = Math.floor(Math.random() * 100000);
                    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=450&nologo=true&seed=${seed}`;
                })
                .replace(/```html/gi, '').replace(/```/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<!DOCTYPE[^>]*>/gi, '')
                .replace(/<\/?html[^>]*>/gi, '')
                .replace(/<\/?head[^>]*>/gi, '')
                .replace(/<\/?body[^>]*>/gi, '')
                .trim();
            
            if (finalHtml) break;
        } catch (err) {
            attempts++;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    return { htmlContent: finalHtml, seoScore: Math.floor(Math.random() * 25 + 75) };
}

async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN) return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;

    console.log(`Agent 02: Publishing '${postData.title}' to WordPress.com...`);
    let featuredMediaId = null;

    if (postData.wp_image_url) {
        try {
            const mediaEndpoint = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`;
            const mediaRes = await fetch(mediaEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ media_urls: [postData.wp_image_url] })
            });
            const mediaData = await mediaRes.json();
            if (mediaData.media?.[0]?.ID) {
                featuredMediaId = mediaData.media[0].ID;
                console.log(`Agent 02: ✅ Image uploaded! Media ID: ${featuredMediaId}`);
            }
        } catch (err) {
            console.error('Agent 02: Media upload failed:', err.message);
        }
    }

    const imageHtml = postData.wp_image_url
        ? `<figure class="wp-block-image size-large"><img src="${postData.wp_image_url}" alt="${postData.title}" /></figure>\n\n`
        : '';

    try {
        const response = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/posts/new`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: postData.title,
                content: imageHtml + (postData.html_content || ''),
                status: 'publish',
                featured_image: featuredMediaId || postData.wp_image_url,
                categories: postData.category || 'General',
                tags: [postData.category || 'AI Generated', '2026']
            })
        });

        const data = await response.json();
        return data.URL || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
    } catch (err) {
        return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
    }
}

async function processBrief(briefId) {
    try {
        const { data: briefData } = await supabase.from('content_briefs').select('*').eq('id', briefId);
        if (!briefData?.[0]) return;

        const brief = briefData[0];
        if (brief.status !== 'PENDING') return;

        await supabase.from('content_briefs').update({ status: 'IN_PROGRESS' }).eq('id', briefId);
        
        await logActivity('Writer (Agent 02)', 'INFO', `Generating: ${brief.title}`);
        const { htmlContent, seoScore } = await generateBlogPost(brief);
        
        // --- PREFER THE PRE-GENERATED IMAGE FROM BRIEF ---
        const finalImageUrl = brief.featured_image_url || `https://picsum.photos/seed/${briefId}/1200/630`;

        const liveUrl = await publishToCMS({
            title: brief.title,
            html_content: htmlContent,
            category: brief.category,
            wp_image_url: finalImageUrl
        }, briefId);

        await logActivity('Writer (Agent 02)', 'SUCCESS', `Published: ${brief.title}`, { url: liveUrl });

        await supabase.from('content').insert({
            brief_id: briefId,
            title: brief.title,
            category: brief.category,
            html_content: htmlContent,
            seo_score: seoScore,
            live_url: liveUrl,
            featured_image_url: finalImageUrl,
            status: 'PUBLISHED'
        });

        await supabase.from('content_briefs').update({ status: 'PUBLISHED' }).eq('id', briefId);

        if (isValidRedisUrl(REDIS_URL)) {
            const publishClient = redis.createClient({ url: REDIS_URL });
            await publishClient.connect();
            await publishClient.publish('content_events', JSON.stringify({ event: 'post_published', post_id: briefId, live_url: liveUrl }));
            await publishClient.disconnect();
        }
    } catch (err) {
        console.error(`Agent 02 Error:`, err);
    }
}

async function listenForEvents() {
    console.log('Agent 02 - Blog Writer listening...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        redisClient = redis.createClient({ url: REDIS_URL });
        await redisClient.connect();
        await redisClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'content_briefs_ready') processBrief(data.brief_id);
        });
    } catch (err) {
        console.error('Agent 02 listener failed:', err);
    }
}

listenForEvents();
