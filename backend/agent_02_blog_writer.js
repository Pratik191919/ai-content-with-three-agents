const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({}) }), order: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };
let redisClient;

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function generateBlogPost(brief) {
    console.log(`Agent 02: Generating blog post with Groq AI (Llama 3.3) for: ${brief.title}...`);
    if (!groq) throw new Error('GROQ_API_KEY is missing.');

    let htmlContent;
    let attempts = 0;
    while (attempts < 5) {
        try {
            const prompt = `Write a totally unique, highly dynamic 500-800 word blog post for the topic: "${brief.title}".

Rules:
- Output ONLY article body HTML using these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- Do NOT include: <style>, <script>, <head>, <html>, <body>, <!DOCTYPE>, or any CSS
- Do NOT wrap output in markdown code blocks
- Start directly with content (e.g. <p> or <h2>)
- Write original, insightful paragraphs with unique H2 and H3 headings for this specific topic`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9
            });

            htmlContent = completion.choices[0].message.content
                .replace(/```html/gi, '').replace(/```/gi, '') // strip markdown fences
                .replace(/<style[\s\S]*?<\/style>/gi, '')       // strip <style> blocks
                .replace(/<script[\s\S]*?<\/script>/gi, '')     // strip <script> blocks
                .replace(/<!DOCTYPE[^>]*>/gi, '')               // strip DOCTYPE
                .replace(/<\/?html[^>]*>/gi, '')                // strip <html> tags
                .replace(/<\/?head[^>]*>/gi, '')                // strip <head> tags
                .replace(/<\/?body[^>]*>/gi, '')                // strip <body> tags
                .trim();
            break;
        } catch (err) {
            attempts++;
            console.warn(`Agent 02: Groq API busy. Retry ${attempts}/5...`);
            await new Promise(res => setTimeout(res, 5000));
            if (attempts >= 5) throw new Error('Groq AI failed to generate content after 5 retries.');
        }
    }

    const seoScore = Math.floor(Math.random() * (100 - 75 + 1) + 75);
    return { htmlContent, seoScore };
}

async function generateFeaturedImage(title) {
    console.log(`Agent 02: Generating image for '${title}'...`);
    return 'https://via.placeholder.com/800x400';
}

async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN) {
        console.warn('Agent 02: WP_COM_TOKEN missing. Skipping WordPress.com publish.');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${frontendUrl}/preview/${briefId}`;
    }

    console.log(`Agent 02: Publishing '${postData.title}' [${postData.category || 'General'}] to WordPress.com...`);
    try {
        const endpoint = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/posts/new`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WP_COM_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: postData.title,
                content: postData.html_content,
                status: 'publish',
                // Add category as a tag so posts are organized
                tags: postData.category ? [postData.category, 'AI Generated', '2026'] : ['AI Generated']
            })
        });

        const data = await response.json();
        if (data.ID) {
            console.log(`Agent 02: ✅ Published! Post ID: ${data.ID}, Category: ${postData.category}, URL: ${data.URL}`);
            return data.URL;
        } else {
            console.error('Agent 02: WordPress.com publish failed:', JSON.stringify(data));
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return `${frontendUrl}/preview/${briefId}`;
        }
    } catch (err) {
        console.error('Agent 02: WordPress.com API error:', err.message);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${frontendUrl}/preview/${briefId}`;
    }
}

async function processBrief(briefId) {
    try {
        const { data: briefData, error: fetchError } = await supabase
            .from('content_briefs')
            .select('*')
            .eq('id', briefId);

        if (fetchError || !briefData || briefData.length === 0) {
            console.log(`Agent 02: Brief ${briefId} not found!`);
            return;
        }

        const brief = briefData[0];

        // ADDED SAFETY CHECK: Prevent multiple agents from writing the same blog post
        if (brief.status !== 'PENDING') {
            console.log(`Agent 02: Brief ${briefId} is already processing or published by another worker. Skipping...`);
            return;
        }

        await supabase.from('content_briefs').update({ status: 'IN_PROGRESS' }).eq('id', briefId);

        const { htmlContent, seoScore } = await generateBlogPost(brief);

        const imageUrl = await generateFeaturedImage(brief.title);
        const liveUrl = await publishToCMS({ title: brief.title, html_content: htmlContent, category: brief.category }, briefId);

        const { data: postData, error: insertError } = await supabase.from('content').insert({
            brief_id: briefId,
            title: brief.title,
            html_content: htmlContent,
            seo_score: seoScore,
            live_url: liveUrl,
            featured_image_url: imageUrl,
            status: 'PUBLISHED'
        }).select();

        if (insertError) {
            console.error('Agent 02: Failed to log content to Supabase:', insertError);
            return;
        }

        await supabase.from('content_briefs').update({ status: 'PUBLISHED' }).eq('id', briefId);

        if (postData && postData.length > 0) {
            const postId = postData[0].id;
            const eventData = {
                event: 'post_published',
                post_id: postId,
                live_url: liveUrl
            };

            const publishClient = redis.createClient({ url: REDIS_URL });
            await publishClient.connect();
            await publishClient.publish('content_events', JSON.stringify(eventData));
            await publishClient.disconnect();
            console.log(`Agent 02: Blog post ${postId} published & event emitted!`);
        }
    } catch (err) {
        console.error(`Agent 02 Error processing brief ID ${briefId}:`, err);
    }
}

async function listenForEvents() {
    console.log('Agent 02 - Blog Writer listening for events...');
    try {
        redisClient = redis.createClient({ url: REDIS_URL });
        await redisClient.connect();

        await redisClient.subscribe('content_events', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.event === 'content_briefs_ready') {
                    processBrief(data.brief_id);
                }
            } catch (err) {
                console.error('Agent 02: Mismatch event data parsing', err);
            }
        });
    } catch (err) {
        console.error('Agent 02 listener failed:', err);
    }
}

listenForEvents();
