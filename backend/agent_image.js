const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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
        await supabase.from('agent_logs').insert({
            agent_name: agentName, event_type: eventType, message: message, metadata: metadata
        });
    } catch (err) {}
}

async function processImageGeneration(briefId) {
    if (!FEATURES.image_enabled) {
        console.log(`Agent Image: Feature disabled. Skipping for brief ${briefId}`);
        await publishNextEvent(briefId);
        return;
    }

        // --- FREEPIK IMAGE GENERATION ---
        const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY;
        if (!FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not found in environment');

        const { generateWithFallback } = require('./llm_helper');
        
        // 1. Generate Image Prompt
        const promptTemplate = `Create a highly descriptive, cinematic, and stunning image generation prompt based on this blog title: "${contentData.title}". Output ONLY the prompt text.`;
        const imagePrompt = (await generateWithFallback(promptTemplate, 0.7)).trim();
        
        console.log(`Agent Image: Requesting Freepik AI for: ${imagePrompt}`);

        // 2. Call Freepik API
        const freepikRes = await axios.post('https://api.freepik.com/v1/ai/text-to-image', {
            prompt: imagePrompt,
            negative_prompt: 'text, watermark, low quality, blurry, distorted',
            num_images: 1,
            image: { size: 'landscape_4_3' }
        }, {
            headers: { 
                'Content-Type': 'application/json',
                'x-freepik-api-key': FREEPIK_API_KEY 
            }
        });

        let imageBuffer;
        const imgData = freepikRes.data?.data?.[0];
        if (imgData?.base64) {
            imageBuffer = Buffer.from(imgData.base64, 'base64');
        } else if (imgData?.url) {
            const imgRes = await axios.get(imgData.url, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(imgRes.data);
        } else {
            throw new Error('Freepik returned no image data');
        }

        // 3. Upload to WordPress Media Library (to ensure permanent visibility)
        let wpMediaUrl = '';
        let wpMediaId = null;
        if (WP_COM_TOKEN && WP_COM_SITE) {
            const form = new FormData();
            form.append('media[]', imageBuffer, {
                filename: `freepik-${Date.now()}.jpg`,
                contentType: 'image/jpeg',
            });

            console.log(`Agent Image: Uploading to WordPress Media Library...`);
            const uploadRes = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`, form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${WP_COM_TOKEN}`
                }
            });

            const mediaItem = uploadRes.data.media?.[0];
            if (mediaItem) {
                wpMediaUrl = mediaItem.URL || mediaItem.url;
                wpMediaId = mediaItem.ID;
            }
        }

        // Failsafe: if WP upload failed, we can't really use the temp Freepik URL, but let's try
        const finalImageUrl = wpMediaUrl || (imgData?.url || '');

        // 4. Inject into HTML content
        const imgStyle = 'style="width: 100%; height: auto; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"';
        const imgTag = `\n<img src="${finalImageUrl}" alt="${contentData.title}" ${imgStyle} />\n`;
        const newHtml = imgTag + contentData.html_content;

        // 5. Update Database
        await supabase.from('content').update({ 
            html_content: newHtml,
            featured_media_id: wpMediaId // Save for Publisher Agent
        }).eq('brief_id', briefId);
        
        await logActivity('Image Agent', 'SUCCESS', `Images processed and ready for publishing: ${contentData.title}`);
        await publishNextEvent(briefId);

    } catch (err) {
        console.error(`Agent Image Error:`, err);
        await logActivity('Image Agent', 'ERROR', `Failed Image Gen for brief ${briefId}: ${err.message}`);
        await publishNextEvent(briefId);
    }
}

async function publishNextEvent(briefId) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Publish to Publisher Agent
    await publishClient.publish('content_events', JSON.stringify({ event: 'image_completed', brief_id: briefId }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent Image listening for internal_linking_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'internal_linking_completed') processImageGeneration(data.brief_id);
        });
    } catch (err) {
        console.error('Agent Image listener failed:', err);
    }
}

listenForEvents();
