const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
// Assuming translation might have a feature flag too, but we will default to false safely
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try { await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata }); } catch (err) {}
}

async function translateContent(briefId) {
    console.log(`Agent Translation: Starting translation jobs for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        if (groq) {
            // Translate to Hindi
            const hiPrompt = `Translate the following HTML blog post into Hindi. ONLY translate the text inside the HTML tags. DO NOT alter any HTML tags, class names, or structure.
            HTML:
            ${contentData.html_content}`;
            
            const hiCompletion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: hiPrompt }],
                temperature: 0.3
            });
            const hindiHtml = hiCompletion.choices[0].message.content.replace(/```html/gi, '').replace(/```/gi, '').trim();

            // Translate to Gujarati
            const guPrompt = `Translate the following HTML blog post into Gujarati. ONLY translate the text inside the HTML tags. DO NOT alter any HTML tags, class names, or structure.
            HTML:
            ${contentData.html_content}`;
            
            const guCompletion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: guPrompt }],
                temperature: 0.3
            });
            const gujaratiHtml = guCompletion.choices[0].message.content.replace(/```html/gi, '').replace(/```/gi, '').trim();

            if (supabase) {
                await supabase.from('content').update({ 
                    html_content_hi: hindiHtml,
                    html_content_gu: gujaratiHtml
                }).eq('id', contentData.id);
            }
            
            await logActivity('Translation Agent', 'SUCCESS', `Translated content to Hindi and Gujarati for: ${contentData.title}`);
        }
    } catch (err) {
        console.error(`Agent Translation Error:`, err);
        await logActivity('Translation Agent', 'ERROR', `Failed translation for ${briefId}`);
    }
}

async function listenForEvents() {
    console.log('Agent Translation listening for post_published events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            // Can be triggered after publish to not delay the main pipeline
            if (data.event === 'post_published') translateContent(data.post_id || data.brief_id);
        });
    } catch (err) {
        console.error('Agent Translation listener failed:', err);
    }
}

listenForEvents();
