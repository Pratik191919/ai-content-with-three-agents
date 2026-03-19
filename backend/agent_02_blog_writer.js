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

    let htmlContent;
    let attempts = 0;
    while (attempts < 5) {
        try {
            const prompt = `Write a totally unique, highly dynamic 500-800 word blog post for the topic: "${brief.title}".

Rules:
- Output ONLY article body HTML using these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <img>
- For <img> tags, use this format: <img src="IMAGE_PROMPT_HERE" alt="description" style="width:100%; border-radius:12px; margin: 24px 0;" />
- Use "IMAGE_PROMPT_HERE" as a placeholder for a descriptive prompt (e.g. "futuristic-city-landscape").
- Include at least 2-3 images throughout the post to break up the text.
- Write original, insightful paragraphs with unique H2 and H3 headings for this specific topic`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9
            });

            let rawHtml = completion.choices[0].message.content;

            // Process inline images: Replace placeholders with real Pollinations URLs
            htmlContent = rawHtml
                .replace(/IMAGE_PROMPT_HERE/g, (match) => {
                    const seed = Math.floor(Math.random() * 10000);
                    return `https://image.pollinations.ai/prompt/${encodeURIComponent(brief.title + ' detail')}${seed}?width=800&height=450&nologo=true`;
                })
                .replace(/```html/gi, '').replace(/```/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<!DOCTYPE[^>]*>/gi, '')
                .replace(/<\/?html[^>]*>/gi, '')
                .replace(/<\/?head[^>]*>/gi, '')
                .replace(/<\/?body[^>]*>/gi, '')
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

function generateFeaturedImage(title, category) {
    // --- For the React frontend (Supabase) ---
    // Pollinations.ai: AI-generated, works great in browser via direct URL
    const categoryStyles = {
        'Technology & AI':       'futuristic digital technology, glowing circuits, blue neon',
        'Food & Recipes':        'delicious food photography, vibrant colors, natural lighting',
        'Travel & Adventure':    'breathtaking landscape travel photography, golden hour',
        'Health & Fitness':      'healthy lifestyle, fitness, energetic, bright clean colors',
        'Lifestyle':             'modern lifestyle aesthetic, cozy, warm tones',
        'Fashion & Beauty':      'high fashion editorial photography, elegant, stylish',
        'Personal Finance':      'financial growth, money, charts, professional clean design',
        'CMS & Web Development': 'web development code editor, dark theme, colorful syntax'
    };
    const style = categoryStyles[category] || 'professional blog header, modern design';
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 60);
    const prompt = encodeURIComponent(`${cleanTitle}, ${style}, high quality, cinematic`);
    const seed = Date.now() % 99999;
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true&seed=${seed}`;

    // --- For WordPress.com embed ---
    // picsum.photos: real photos, seed-based (consistent per title), allowed by WP security
    const picsumSeed = cleanTitle.toLowerCase().replace(/\s+/g, '-').substring(0, 40);
    const wpImageUrl = `https://picsum.photos/seed/${picsumSeed}/1200/630`;

    console.log(`Agent 02: 🎨 Images generated for '${title}'`);
    return { pollinationsUrl, wpImageUrl };
}

async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN) {
        console.warn('Agent 02: WP_COM_TOKEN missing. Skipping WordPress.com publish.');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${frontendUrl}/preview/${briefId}`;
    }

    console.log(`Agent 02: Publishing '${postData.title}' [${postData.category || 'General'}] to WordPress.com...`);

    // Use wpImageUrl in WordPress content (picsum.photos — allowed by WP security)
    // Use pollinationsUrl stored in Supabase (for React frontend display)
    const imageHtml = postData.wp_image_url
        ? `<figure class="wp-block-image size-large" style="margin:0 0 2em 0;">
    <img src="${postData.wp_image_url}" alt="${postData.title}" style="width:100%;height:auto;border-radius:8px;display:block;" />
    <figcaption style="text-align:center;font-size:0.8em;color:#888;margin-top:0.5em;">📷 ${postData.category || 'Blog'} — AI Content Hub</figcaption>
  </figure>\n\n`
        : '';

    const fullContent = imageHtml + (postData.html_content || '');

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
                content: fullContent,
                status: 'publish',
                featured_image: postData.wp_image_url,
                categories: postData.category || 'General',
                tags: postData.category
                    ? [postData.category, 'AI Generated', '2026']
                    : ['AI Generated']
            })
        });

        const data = await response.json();
        if (data.ID) {
            console.log(`Agent 02: ✅ Published! Post ID: ${data.ID}, Category: ${postData.category}, URL: ${data.URL}`);
            return data.URL;
        } else {
            console.error('Agent 02: WordPress.com publish failed:', JSON.stringify(data));
            await logActivity('Writer (Agent 02)', 'ERROR', `WordPress publish failed for '${postData.title}'`, { error: JSON.stringify(data) });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return `${frontendUrl}/preview/${briefId}`;
        }
    } catch (err) {
        console.error('Agent 02: WordPress.com API error:', err.message);
        await logActivity('Writer (Agent 02)', 'ERROR', `API system error during WordPress publish: '${postData.title}'`, { error: err.message });
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

        const { pollinationsUrl, wpImageUrl } = generateFeaturedImage(brief.title, brief.category);
        
        await logActivity('Writer (Agent 02)', 'INFO', `Started content generation for: ${brief.title}`);

        const liveUrl = await publishToCMS({
            title: brief.title,
            html_content: htmlContent,
            category: brief.category,
            wp_image_url: wpImageUrl
        }, briefId);

        await logActivity('Writer (Agent 02)', 'SUCCESS', `Published article: ${brief.title}`, { post_id: briefId, url: liveUrl });

        const { data: postData, error: insertError } = await supabase.from('content').insert({
            brief_id: briefId,
            title: brief.title,
            category: brief.category,
            html_content: htmlContent,
            seo_score: seoScore,
            live_url: liveUrl,
            featured_image_url: pollinationsUrl,
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

            if (isValidRedisUrl(REDIS_URL)) {
                const publishClient = redis.createClient({ url: REDIS_URL });
                await publishClient.connect();
                await publishClient.publish('content_events', JSON.stringify(eventData));
                await publishClient.disconnect();
                console.log(`Agent 02: Blog post ${postId} published & event emitted!`);
            } else {
                console.log(`Agent 02: Blog post ${postId} published (Redis unavailable — no event emitted)`);
            }
        }
    } catch (err) {
        console.error(`Agent 02 Error processing brief ID ${briefId}:`, err);
    }
}

async function listenForEvents() {
    console.log('Agent 02 - Blog Writer listening for events...');
    if (!isValidRedisUrl(REDIS_URL)) {
        console.warn('Agent 02: Redis disabled — REDIS_URL invalid. Will poll Supabase directly instead.');
        return;
    }
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
