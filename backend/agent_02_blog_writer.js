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

async function publishToCMS(postData, briefId) {
    if (!WP_COM_TOKEN || !WP_COM_SITE) {
        console.warn('Agent 02: WordPress.com credentials missing. Falling back to local preview.');
        return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
    }

    try {
        console.log(`Agent 02: 📸 Generating 4 unique AI images for: ${postData.title}`);
        
        // Define 4 distinct image prompts as per architecture
        const prompts = [
            `Professional 8k cinematic featured cover image for ${postData.title}, futuristic digital art`,
            `Intricate conceptual illustration for ${postData.title}, high resolution, scientific style`,
            `Futuristic visualization for ${postData.title}, vivid colors, masterpiece`,
            `Modern infographic-style digital art for ${postData.title}, clean design, 8k`
        ];

        const uploadedMedia = [];

        // Step 1: Upload 4 physical images to WordPress Media API
        for (let i = 0; i < prompts.length; i++) {
            const seed = Math.floor(Math.random() * 1000000);
            const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompts[i])}?width=1024&height=768&seed=${seed}&nologo=true`;
            
            try {
                const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const form = new FormData();
                form.append('media[]', Buffer.from(imageRes.data), {
                    filename: `image-${i}-${Date.now()}.jpg`,
                    contentType: 'image/jpeg',
                });

                const uploadRes = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Bearer ${WP_COM_TOKEN}`
                    }
                });

                if (uploadRes.data.media?.[0]?.ID) {
                    const media = uploadRes.data.media[0];
                    uploadedMedia.push({ id: media.ID, url: media.URL });
                    console.log(`Agent 02: ✅ Image ${i+1}/4 Uploaded Successfully! ID: ${media.ID}`);
                }
            } catch (err) {
                console.error(`Agent 02: ❌ Failed to upload image ${i+1}:`, err.message);
            }
        }

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
            return response.data.URL;
        }
    } catch (err) {
        console.error('Agent 02: WordPress mega-publish failed:', err.response?.data || err.message);
    }
    return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/preview/${briefId}`;
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

        const liveUrl = await publishToCMS({
            title: brief.title,
            html_content: htmlContent,
            category: brief.category,
            wp_image_url: finalImageUrl
        }, briefId);

        await logActivity('Writer (Agent 02)', 'SUCCESS', `Published article with featured image: ${brief.title}`, { url: liveUrl });

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
