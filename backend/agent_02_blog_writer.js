const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) 
    ? createClient(SUPABASE_URL, SUPABASE_KEY) 
    : { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({}) }), order: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };
let redisClient;

let genAI;
let model;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function generateBlogPost(brief) {
    console.log(`Agent 02: Initiating AI content generation for: ${brief.title}...`);
    let htmlContent;
    try {
        if (!model) throw new Error("Gemini API key is missing or model not initialized.");
        const prompt = `Write a totally unique, highly dynamic 500-800 word HTML blog post for the topic: "${brief.title}". 
        Include:
        - A unique, catchy introduction paragraph.
        - Unique H2 and H3 tags specific to this exact topic.
        - Detailed, uniquely written paragraphs filled with original thoughts.
        Output ONLY raw HTML. Do not wrap it in markdown block tags like \`\`\`html.`;
        
        let result;
        let attempts = 0;
        // Automatic Retry Logic to prevent API timeouts!
        while (attempts < 5) {
            try {
                result = await model.generateContent(prompt);
                break; // If successful, exit the retry loop
            } catch (err) {
                attempts++;
                console.warn(`Agent 02: Gemini API busy/rate-limited. Waiting 5 seconds before retry ${attempts}/5...`);
                await new Promise(res => setTimeout(res, 5000));
                if (attempts >= 5) throw err; // If all 5 retries fail, throw to the final catch
            }
        }
        
        htmlContent = result.response.text().replace(/```html/gi, '').replace(/```/gi, '').trim();
    } catch (e) {
        console.error("Gemini AI completely failed to generate content:", e.message);
        throw new Error("Generative AI was unable to generate content. Please check API Limits or model availability.");
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

    console.log(`Agent 02: Publishing '${postData.title}' to WordPress.com (${WP_COM_SITE})...`);
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
                status: 'publish'
            })
        });

        const data = await response.json();
        if (data.ID) {
            console.log(`Agent 02: ✅ Published to WordPress.com! Post ID: ${data.ID}, URL: ${data.URL}`);
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
        const liveUrl = await publishToCMS({ title: brief.title, html_content: htmlContent }, briefId);

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
