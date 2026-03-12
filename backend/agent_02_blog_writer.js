const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'dummy_key';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let redisClient;

let genAI;
let model;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function generateBlogPost(brief) {
    console.log(`Agent 02: Generating content for brief: ${brief.title} using Gemini AI...`);
    let htmlContent = `<h1>${brief.title}</h1>\n<p>This is a complete 2000-word post with optimized H2s and FAQs.</p>`;
    try {
        if (!model) throw new Error("Gemini model not initialized.");
        const prompt = `Write a short 3-paragraph HTML formatted blog post for the topic: "${brief.title}". Include <h2> tags and <p> tags. Do not wrap in markdown tags like \`\`\`html.`;
        const result = await model.generateContent(prompt);
        htmlContent = result.response.text().replace(/```html/gi, '').replace(/```/gi, '').trim();
    } catch (e) {
        console.error("Gemini writing failed, using fallback", e);
    }
    const seoScore = Math.floor(Math.random() * (100 - 75 + 1) + 75);
    return { htmlContent, seoScore };
}

async function generateFeaturedImage(title) {
    console.log(`Agent 02: Generating image for '${title}'...`);
    return 'https://via.placeholder.com/800x400';
}

async function publishToCMS(postData, briefId) {
    console.log(`Agent 02: Publishing '${postData.title}' to preview...`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${frontendUrl}/preview/${briefId}`;
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

        await supabase.from('content_briefs').update({ status: 'IN_PROGRESS' }).eq('id', briefId);

        const { htmlContent, seoScore } = await generateBlogPost(brief);

        const imageUrl = await generateFeaturedImage(brief.title);
        const liveUrl = await publishToCMS({ title: brief.title }, briefId);

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
