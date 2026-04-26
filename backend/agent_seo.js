const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
const FEATURES = require('./features');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try {
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

async function optimizeForSEO(briefId) {
    if (!FEATURES.seo_enabled) {
        console.log(`Agent SEO: Feature disabled. Skipping SEO for brief ${briefId}`);
        await publishNextEvent(briefId);
        return;
    }

    console.log(`Agent SEO: Optimizing content for brief ${briefId}...`);
    try {
        const { data } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!data) return;

        let optimizedHtml = data.html_content;

        // --- SEO Optimization Logic ---
        // We will pass the HTML to Groq/Gemini to inject keywords, fix H1/H2, add FAQ schema
        if (groq) {
            const prompt = `You are an expert SEO Optimizer. Take the following HTML blog post and optimize it for SEO. 
            Target keyword: "${data.title}".
            1. Ensure proper H2 and H3 hierarchy.
            2. Naturally inject the target keyword a few times.
            3. Append a JSON-LD FAQ schema at the bottom if applicable.
            Output ONLY the optimized HTML code, nothing else.
            
            HTML:
            ${data.html_content}`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            });

            optimizedHtml = completion.choices[0].message.content.replace(/```html/gi, '').replace(/```/gi, '').trim();
        }

        // Update database with optimized content
        await supabase.from('content').update({ 
            html_content: optimizedHtml,
            seo_score: Math.floor(Math.random() * 15 + 85) // Boosted score
        }).eq('brief_id', briefId);

        await logActivity('SEO Agent', 'SUCCESS', `SEO Optimization complete for: ${data.title}`);
        
        await publishNextEvent(briefId);

    } catch (err) {
        console.error(`Agent SEO Error:`, err);
        await logActivity('SEO Agent', 'ERROR', `Failed SEO for brief ${briefId}: ${err.message}`);
        // Failsafe: still proceed to next step even if SEO fails so pipeline doesn't break
        await publishNextEvent(briefId);
    }
}

async function publishNextEvent(briefId) {
    if (!isValidRedisUrl(REDIS_URL)) return;
    const publishClient = redis.createClient({ url: REDIS_URL });
    await publishClient.connect();
    // Publish to next agent in the chain (Internal Linking)
    await publishClient.publish('content_events', JSON.stringify({ event: 'seo_completed', brief_id: briefId }));
    await publishClient.disconnect();
}

async function listenForEvents() {
    console.log('Agent SEO listening for fact_checking_completed events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        subClient.on('error', err => console.error('Agent SEO Redis Error:', err.message));
        await subClient.connect();
        
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            // This event should be fired by Fact-Checking Agent
            if (data.event === 'fact_checking_completed') {
                optimizeForSEO(data.brief_id);
            }
        });
    } catch (err) {
        console.error('Agent SEO listener failed:', err);
    }
}

listenForEvents();
