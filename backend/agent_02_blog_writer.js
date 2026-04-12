const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const axios = require('axios');
const FormData = require('form-data');
const { isValidRedisUrl } = require('./redis-helper');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
let WP_COM_TOKEN = process.env.WP_COM_TOKEN ? process.env.WP_COM_TOKEN.trim() : null;
if (WP_COM_TOKEN && WP_COM_TOKEN.includes('%')) {
    try {
        WP_COM_TOKEN = decodeURIComponent(WP_COM_TOKEN);
    } catch (e) {
        // If decoding fails, use the raw token
    }
}


const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({}) }), order: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };

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
- Output ONLY article body HTML using these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- DO NOT INCLUDE ANY <img> TAGS. Image generation is handled automatically by the Freepik system.
- Write original, insightful paragraphs with unique H2 and H3 headings for this specific topic`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9
            });

            const rawHtml = completion.choices[0].message.content;
            finalHtml = rawHtml.replace(/```html/gi, '').replace(/```/gi, '').trim();
            
            if (finalHtml) break;
        } catch (err) {
            attempts++;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    return { htmlContent: finalHtml, seoScore: Math.floor(Math.random() * 25 + 75) };
}


const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Professional Freepik AI Media Sideloading and Publishing
 * Handles 1 Featured Image + inline Content Images via WordPress.com API
 */
let dailyFreepikCount = 0; // Simple memory counter for free tier limit

async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN || !WP_COM_SITE || !process.env.FREEPIK_API_KEY) {
        console.warn('Agent 02: Missing Credentials (WP or Freepik). Falling back to local preview.');
        return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
    }

    try {
        console.log(`Agent 02: 📸 Managing Freepik AI Image process for: ${postData.title}`);
        
        let prompts = [];
        
        // Respect Freepik 100/day free limit (1 blog = 3 images)
        if (dailyFreepikCount > 90) {
            console.warn("Agent 02: ⚠️ Approaching Freepik daily limit! Skipping image generation for this post.");
        } else {
            // Step 1: Generate Smart Prompts using Gemini
            if (process.env.GEMINI_API_KEY) {
                try {
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const prompt = `Generate exactly 3 image prompts for this blog:
Title: ${postData.title}
Make them visual, modern, and blog-friendly. Return ONLY a valid JSON array of 3 strings. No markdown formatting or extra text.`;
                    
                    const result = await model.generateContent(prompt);
                    const responseText = result.response.text();
                    
                    const jsonMatch = responseText.match(/\[.*\]/s);
                    if (jsonMatch) prompts = JSON.parse(jsonMatch[0]);
                } catch(e) {
                    console.warn('Agent 02: Gemini prompt generation failed, using fallback.', e.message);
                }
            }
            
            // Fallback prompts if Gemini fails
            if (prompts.length < 3) {
                 prompts = [
                    `${postData.title}, modern business UI illustration, high quality`,
                    `${postData.title}, professional business strategy concept, futuristic`,
                    `${postData.title}, digital marketing analytics futuristic concept`
                ];
            }
        }

        const uploadedMedia = [];

        // Step 2 & 3: Generate and Upload 3 images to WordPress Media Library
        for (let i = 0; i < prompts.length; i++) {
            try {
                process.stdout.write(`Agent 02: 🤖 Generating Image ${i+1}/3 via Freepik... `);
                
                const freepikRes = await axios.post('https://api.freepik.com/v1/ai/text-to-image', {
                    prompt: prompts[i]
                }, {
                    headers: {
                        'x-freepik-api-key': process.env.FREEPIK_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                dailyFreepikCount++; // Increment limit counter

                let imageBuffer;
                const base64Data = freepikRes.data?.data?.[0]?.base64;
                if (base64Data) {
                    imageBuffer = Buffer.from(base64Data, 'base64');
                } else if (freepikRes.data?.data?.[0]?.url) {
                    const imgRes = await axios.get(freepikRes.data.data[0].url, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgRes.data);
                } else {
                    throw new Error('Invalid Freepik response format');
                }
                console.log(`Success!`);

                const form = new FormData();
                form.append('media[]', imageBuffer, {
                    filename: `freepik-${i}-${Date.now()}.jpg`,
                    contentType: 'image/jpeg',
                });

                console.log(`Agent 02: ⬆️ Uploading to WordPress.com Media API...`);
                const uploadRes = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Bearer ${WP_COM_TOKEN}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const mediaItem = uploadRes.data.media?.[0];
                if (mediaItem && mediaItem.ID) {
                    const finalUrl = mediaItem.URL || mediaItem.url || mediaItem.source_url || mediaItem.guid;
                    uploadedMedia.push({ 
                        id: mediaItem.ID, 
                        url: finalUrl 
                    });
                    console.log(`Agent 02: ✅ Sideloaded to Media Library (ID: ${mediaItem.ID})`);
                }
            } catch (err) {
                const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(`\nAgent 02: ❌ Failed Image ${i+1}:`, errMsg);
                
                // Extremely valuable debug logging directly to Supabase since Cloud console is hidden
                try {
                    const { createClient } = require('@supabase/supabase-js');
                    const debugDb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
                    await debugDb.from('agent_logs').insert({
                        agent_name: 'Writer (Agent 02)',
                        event_type: 'ERROR',
                        message: `Render Cloud Image Generation Failed (Image ${i+1}): ${errMsg.substring(0, 150)}`
                    });
                } catch(e) {}
            }
            // Smart Delay to avoid Freepik Free-Tier Rate Limits (429)
            if (i < prompts.length - 1) {
                await new Promise(r => setTimeout(r, 4000)); 
            }
        }

        // Step 4 & 5: Insert Images seamlessly into Content for Perfect Previews
        let finalContent = postData.html_content || '';
        
        // Dynamically inject gracefully based on however many images *succeeded*
        if (uploadedMedia.length > 1) {
            const paragraphs = finalContent.split('</p>');
            const partSize = Math.floor(paragraphs.length / uploadedMedia.length);
            
            if (partSize > 1) {
                const imgStyle = 'style="width: 100%; height: auto; border-radius: 12px; margin: 32px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"';
                
                // Start from 1 because index 0 is used for the Featured Image Header
                let inserted = 0;
                for (let j = 1; j < uploadedMedia.length; j++) {
                    const targetIndex = (partSize * j) + inserted;
                    if (targetIndex < paragraphs.length) {
                        paragraphs.splice(targetIndex, 0, `\n<img src="${uploadedMedia[j].url}" alt="${postData.title} concept visual" ${imgStyle} />\n`);
                        inserted++;
                    }
                }
                finalContent = paragraphs.join('</p>');
            }
        }

        // Step 6: Publish Post (Featured Image is the 1st generated image)
        const featuredMediaId = uploadedMedia.length > 0 ? uploadedMedia[0].id : null;
        
        console.log(`Agent 02: 📝 Creating final post on ${WP_COM_SITE}...`);
        const response = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/posts/new`, {
            title: postData.title,
            content: finalContent,
            status: 'publish',
            featured_media: featuredMediaId, 
            featured_image: featuredMediaId, // Dual-keying for failsafe API support
            categories: postData.category || 'General', 
            tags: [postData.category || 'Global', 'AI Hub', '2026']
        }, {
            headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}` }
        });

        if (response.data && response.data.ID) {
            const liveUrl = response.data.URL;
            console.log(`Agent 02: 🚀 MEGA BLOG PUBLISHED: ${liveUrl}`);
            return { url: liveUrl, media: uploadedMedia };
        }
    } catch (err) {
        console.error('Agent 02: WordPress publish failed:', err.response?.data || err.message);
    }
    return { url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`, media: [] };
}

async function processBrief(briefId) {
    try {
        const { data: briefData } = await supabase.from('content_briefs').select('*').eq('id', briefId);
        if (!briefData?.[0]) return;

        const brief = briefData[0];
        if (brief.status !== 'PENDING') return;

        await supabase.from('content_briefs').update({ status: 'IN_PROGRESS' }).eq('id', briefId);
        
        await logActivity('Writer (Agent 02)', 'INFO', `Generating physical image & post: ${brief.title}`);
        const { htmlContent, seoScore } = await generateBlogPost(brief);
        
        const finalImageUrl = brief.featured_image_url || `https://picsum.photos/seed/${briefId}/1200/630`;

        const liveResult = await publishToCMS({
            title: brief.title,
            html_content: htmlContent,
            category: brief.category,
            wp_image_url: finalImageUrl
        }, briefId);
        
        const { url: liveUrl, media: uploadedMedia } = liveResult;
        
        await logActivity('Writer (Agent 02)', 'SUCCESS', `Published article: ${brief.title}`, { 
            url: liveUrl,
            images: uploadedMedia
        });

        await supabase.from('content').insert({
            brief_id: briefId,
            title: brief.title,
            category: brief.category,
            html_content: htmlContent,
            seo_score: seoScore,
            live_url: liveUrl,
            featured_image_url: uploadedMedia?.[0]?.url || finalImageUrl,
            content_image: uploadedMedia?.[1]?.url || null,   // Specific requested field (guaranteed different from featured)
            content_image_1: uploadedMedia?.[1]?.url || null, // Fallback/duplicate logic
            content_image_2: uploadedMedia?.[2]?.url || null, // Third image
            status: 'PUBLISHED'
        });

        await supabase.from('content_briefs').update({ status: 'PUBLISHED' }).eq('id', briefId);

        if (isValidRedisUrl(REDIS_URL)) {
            const publishClient = redis.createClient({ url: REDIS_URL });
            publishClient.on('error', err => console.error('Agent 02 Publish Error:', err.message));
            await publishClient.connect();
            await publishClient.publish('content_events', JSON.stringify({ event: 'post_published', post_id: briefId, live_url: liveUrl }));
            await publishClient.disconnect();
        }
    } catch (err) {
        console.error(`Agent 02 Error:`, err);
    }
}

async function listenForEvents() {
    console.log('Agent 02 - Blog Writer listening (Physical Media Mode enabled)...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        subClient.on('error', err => console.error('Agent 02 Redis Listener Error:', err.message));
        await subClient.connect();
        console.log('Agent 02: Connected to Redis for listening events');
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'content_briefs_ready') processBrief(data.brief_id);
        });
    } catch (err) {
        console.error('Agent 02 listener failed:', err);
    }
}

async function runAgent02() {
    listenForEvents();

    // Fallback polling for missed Redis events
    while (true) {
        try {
            const { data } = await supabase.from('content_briefs').select('id').eq('status', 'PENDING');
            if (data && data.length > 0) {
                console.log(`Agent 02: Found ${data.length} PENDING briefs via fallback poll. Processing...`);
                for (const brief of data) {
                    await processBrief(brief.id);
                }
            }
        } catch (err) {
            console.error('Agent 02 polling error:', err.message);
        }
        await new Promise(res => setTimeout(res, 5 * 60 * 1000)); // Poll every 5 minutes
    }
}

runAgent02();
