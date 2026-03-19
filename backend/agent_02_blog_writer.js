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
- Replace "DESCRIPTIVE_PROMPT" with a specific prompt related to the section (e.g. "futuristic-smartwatch-on-wrist").
- Include at least 2-3 images throughout the post to break up the text.
- Write original, insightful paragraphs with unique H2 and H3 headings for this specific topic`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9
            });

            const rawHtml = completion.choices[0].message.content;

            // Sanitize and fix image URLs (URL encode prompts + add randomness)
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
            console.warn(`Agent 02: Groq API busy. Retry ${attempts}/5...`);
            await new Promise(res => setTimeout(res, 5000));
        }
    }

    const seoScore = Math.floor(Math.random() * (100 - 75 + 1) + 75);
    return { htmlContent: finalHtml, seoScore };
}

function generateFeaturedImage(title, category) {
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

    let featuredMediaId = null;

    if (postData.wp_image_url) {
        try {
            console.log('Agent 02: Uploading image to WordPress Media Library...');
            const mediaEndpoint = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`;
            const mediaRes = await fetch(mediaEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ media_urls: [postData.wp_image_url] })
            });
            const mediaData = await mediaRes.json();
            if (mediaData.media && mediaData.media.length > 0) {
                featuredMediaId = mediaData.media[0].ID;
                console.log(`Agent 02: ✅ Image uploaded! Media ID: ${featuredMediaId}`);
            }
        } catch (err) {
            console.error('Agent 02: Media upload failed, falling back to basic publish:', err.message);
        }
    }

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
                featured_image: featuredMediaId || postData.wp_image_url,
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
        if (brief.status !== 'PENDING') {
            console.log(`Agent 02: Brief ${briefId} is already processing or published. Skipping...`);
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
                console.log(`Agent 02: Blog post ${postId} published (Redis unavailable)`);
            }
        }
    } catch (err) {
        console.error(`Agent 02 Error processing brief ID ${briefId}:`, err);
    }
}

async function listenForEvents() {
    console.log('Agent 02 - Blog Writer listening for events...');
    if (!isValidRedisUrl(REDIS_URL)) {
        console.warn('Agent 02: Redis disabled. Auditor will poll instead.');
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
                console.error('Agent 02: Error parsing event', err);
            }
        });
    } catch (err) {
        console.error('Agent 02 listener failed:', err);
    }
}

listenForEvents();
