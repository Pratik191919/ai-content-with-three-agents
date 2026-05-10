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

    console.log(`Agent Image: Processing brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) {
            console.error(`Agent Image: No content found for brief ${briefId}`);
            return;
        }

        // --- FREEPIK IMAGE GENERATION ---
        const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY;
        if (!FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not found in environment');

        const { generateWithFallback } = require('./llm_helper');
        
        // 1. Generate 3 Image Prompts
        const promptTemplate = `Generate exactly 3 short, descriptive, cinematic image generation prompts based on this blog title: "${contentData.title}".
Return ONLY a valid JSON array of 3 strings. No markdown formatting or extra text.`;
        
        let responseText = '';
        try {
            responseText = (await generateWithFallback(promptTemplate, 0.7)).trim();
        } catch (llmErr) {
            console.warn('Agent Image: LLM prompt generation failed (likely rate limit). Using default prompts.');
        }
        
        let prompts = [];
        try {
            if (responseText) {
                const jsonMatch = responseText.match(/\[.*\]/s);
                if (jsonMatch) prompts = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('Agent Image: Prompt parsing failed, using fallback.');
        }

        if (prompts.length < 3) {
            prompts = [
                `${contentData.title}, highly descriptive, cinematic, stunning`,
                `${contentData.title}, professional modern concept, high quality`,
                `${contentData.title}, futuristic dynamic visual, 8k resolution`
            ];
        }

        const uploadedMedia = [];

        // 2 & 3. Call Freepik API and Upload to WP
        for (let i = 0; i < prompts.length; i++) {
            try {
                console.log(`Agent Image: Requesting Freepik AI for: ${prompts[i]}`);
                const freepikRes = await axios.post('https://api.freepik.com/v1/ai/text-to-image', {
                    prompt: prompts[i],
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

                let wpMediaUrl = imgData?.url || '';
                let wpMediaId = null;
                
                if (WP_COM_TOKEN && WP_COM_SITE) {
                    const form = new FormData();
                    form.append('media[]', imageBuffer, {
                        filename: `freepik-${i}-${Date.now()}.jpg`,
                        contentType: 'image/jpeg',
                    });

                    console.log(`Agent Image: Uploading Image ${i+1}/3 to WordPress Media Library...`);
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
                        console.log(`Agent Image: Success! Image uploaded to WP (ID: ${wpMediaId}, URL: ${wpMediaUrl})`);
                    }
                }
                
                uploadedMedia.push({ id: wpMediaId, url: wpMediaUrl });
                
                // Rate limit to avoid 429
                if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 4000));
            } catch (err) {
                console.error(`Agent Image Error on image ${i+1}:`, err.message);
            }
        }

        // 4. Inject into HTML content (only images 1 and 2)
        let finalHtml = contentData.html_content || '';
        if (uploadedMedia.length > 1) {
            const paragraphs = finalHtml.split('</p>');
            const partSize = Math.floor(paragraphs.length / uploadedMedia.length);
            
            if (partSize > 1) {
                const imgStyle = 'style="width: 100%; height: auto; border-radius: 12px; margin: 32px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"';
                let inserted = 0;
                for (let j = 1; j < uploadedMedia.length; j++) {
                    const targetIndex = (partSize * j) + inserted;
                    if (targetIndex < paragraphs.length) {
                        paragraphs.splice(targetIndex, 0, `\n<img src="${uploadedMedia[j].url}" alt="${contentData.title} visual" ${imgStyle} />\n`);
                        inserted++;
                    }
                }
                finalHtml = paragraphs.join('</p>');
            }
        }

        // 5. Update Database
        console.log(`Agent Image: Updating Supabase with new HTML content and image URLs...`);
        const updatePayload = { html_content: finalHtml };
        
        if (uploadedMedia.length > 0 && uploadedMedia[0].url) {
            updatePayload.featured_media_id = uploadedMedia[0].id;
            updatePayload.featured_image_url = uploadedMedia[0].url;
        }
        if (uploadedMedia.length > 1 && uploadedMedia[1].url) {
            updatePayload.content_image_1 = uploadedMedia[1].url;
        }
        if (uploadedMedia.length > 2 && uploadedMedia[2].url) {
            updatePayload.content_image_2 = uploadedMedia[2].url;
        }

        const { error: dbError } = await supabase.from('content').update(updatePayload).eq('brief_id', briefId);

        if (dbError) throw new Error(`Supabase Update Failed: ${dbError.message}`);
        
        await logActivity('Image Agent', 'SUCCESS', `Images processed and ready for publishing: ${contentData.title}`);
        await publishNextEvent(briefId);

    } catch (err) {
        const errorDetail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.error(`Agent Image Error:`, errorDetail);
        await logActivity('Image Agent', 'ERROR', `Failed Image Gen for brief ${briefId}: ${errorDetail}`);
        // Failsafe: still trigger publisher so the post isn't stuck forever
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
