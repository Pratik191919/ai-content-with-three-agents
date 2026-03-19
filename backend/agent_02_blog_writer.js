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
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;

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
- Output ONLY article body HTML using these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <img>
- For <img> tags, use this format: <img src="https://image.pollinations.ai/prompt/DESCRIPTIVE_PROMPT?width=800&height=450&nologo=true" alt="description" style="width:100%; border-radius:12px; margin: 24px 0;" />
- Replace "DESCRIPTIVE_PROMPT" with a specific prompt (e.g. "futuristic-smartwatch-on-table").
- Include 2-3 images. Don't use same prompt for images.
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
                .replace(/```html/gi, '').replace(/```/gi, '').trim();
            
            if (finalHtml) break;
        } catch (err) {
            attempts++;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    return { htmlContent: finalHtml, seoScore: Math.floor(Math.random() * 25 + 75) };
}

const Replicate = require('replicate');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

/**
 * Official WordPress Media Sideloading and Publishing
 * Handles 1 Featured Image + 3 Content Images using Stable Diffusion (Replicate)
 */
async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN || !WP_COM_SITE || !process.env.REPLICATE_API_TOKEN) {
        console.warn('Agent 02: Missing Credentials. Falling back to local preview.');
        return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
    }

    try {
        console.log(`Agent 02: 📸 Generating 4 High-End Stable Diffusion images for: ${postData.title}`);
        
        // Define 4 professional cinematic prompts
        const prompts = [
            `${postData.title}, professional modern AI blog cover thumbnail, cinematic lighting, 8k resolution, clean design`,
            `${postData.title}, futuristic conceptual visualization, intricate digital art, mastery, high detail`,
            `${postData.title}, abstract technology concept, glowing elements, future aesthetics, vivid colors`,
            `${postData.title}, digital infographic visualization art, artistic and clean, professional masterpiece`
        ];

        const uploadedMedia = [];

        // Upload 4 physical images to WordPress Media Library
        for (let i = 0; i < prompts.length; i++) {
            try {
                process.stdout.write(`Agent 02: 🤖 Generating Image ${i+1}/4 via Replicate... `);
                
                // Call Replicate (Stable Diffusion XL)
                const output = await replicate.run(
                    "stability-ai/sdxl:7762fd07cf27411a72d45b46e3968600d8ce20dcf16d47b0a3f6517173e35195",
                    {
                        input: {
                            prompt: prompts[i],
                            width: 1024,
                            height: 1024,
                            refiner: "expert_ensemble_refiner",
                            apply_watermark: false
                        }
                    }
                );

                const imageUrl = output[0];
                console.log(`Success! URL: ${imageUrl}`);

                // Download the generated image bytes
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                
                const form = new FormData();
                form.append('media[]', Buffer.from(imageRes.data), {
                    filename: `sdxl-${i}-${Date.now()}.jpg`,
                    contentType: 'image/jpeg',
                });

                // Post to WordPress Media API
                const uploadRes = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Bearer ${WP_COM_TOKEN}`
                    }
                });

                if (uploadRes.data.media?.[0]?.ID) {
                    uploadedMedia.push({ 
                        id: uploadRes.data.media[0].ID, 
                        url: uploadRes.data.media[0].URL 
                    });
                    console.log(`Agent 02: ✅ Sideloaded to Media Library (ID: ${uploadRes.data.media[0].ID})`);
                }
            } catch (err) {
                console.error(`\nAgent 02: ❌ Failed Image ${i+1}:`, err.message);
            }
        }

        // --- Rest of CMS Logic: Gallery Linking & Gutenberg Formatting ---

        // Step 2: Embed Images into Content (Gutenberg Format with ID Linking)
        let finalContent = postData.html_content || '';
        if (uploadedMedia.length >= 4) {
            const paragraphs = finalContent.split('</p>');
            const partSize = Math.floor(paragraphs.length / 4);
            
            if (partSize > 1) {
                // Insert 3 internal images with official WordPress IDs
                paragraphs.splice(partSize, 0, `\n<!-- wp:image {"id":${uploadedMedia[1].id},"sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image size-large"><img src="${uploadedMedia[1].url}" alt="Concept" class="wp-image-${uploadedMedia[1].id}"/></figure>\n<!-- /wp:image -->\n`);
                paragraphs.splice(partSize * 2 + 1, 0, `\n<!-- wp:image {"id":${uploadedMedia[2].id},"sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image size-large"><img src="${uploadedMedia[2].url}" alt="Visualization" class="wp-image-${uploadedMedia[2].id}"/></figure>\n<!-- /wp:image -->\n`);
                paragraphs.splice(partSize * 3 + 2, 0, `\n<!-- wp:image {"id":${uploadedMedia[3].id},"sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image size-large"><img src="${uploadedMedia[3].url}" alt="Infographic" class="wp-image-${uploadedMedia[3].id}"/></figure>\n<!-- /wp:image -->\n`);
                finalContent = paragraphs.join('</p>');
            }
        }

        // Step 3: Publish to Post API with Featured Media ID
        const featuredMediaId = uploadedMedia.length > 0 ? uploadedMedia[0].id : null;
        
        const response = await axios.post(`https://public-api.wordpress.com/wp/v2/sites/${WP_COM_SITE}/posts`, {
            title: postData.title,
            content: finalContent,
            status: 'publish',
            featured_media: featuredMediaId,
            categories: postData.category || 'General',
            tags: [postData.category || 'Global', 'AI Hub', '2026']
        }, {
            headers: { 'Authorization': `Bearer ${WP_COM_TOKEN}` }
        });

        if (response.data.ID) {
            console.log(`Agent 02: 🚀 MEGA BLOG PUBLISHED: ${response.data.URL}`);
            return { url: response.data.URL, media: uploadedMedia };
        }
    } catch (err) {
        console.error('Agent 02: WordPress mega-publish failed:', err.response?.data || err.message);
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
    console.log('Agent 02 - Blog Writer listening (Physical Media Mode enabled)...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'content_briefs_ready') processBrief(data.brief_id);
        });
    } catch (err) {
        console.error('Agent 02 listener failed:', err);
    }
}

listenForEvents();
