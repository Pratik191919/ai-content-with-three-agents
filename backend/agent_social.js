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
    try { await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata }); } catch (err) {}
}

async function createSocialPosts(briefId, liveUrl) {
    if (!FEATURES.social_enabled) {
        console.log(`Agent Social: Feature disabled. Skipping for brief ${briefId}`);
        return;
    }

    console.log(`Agent Social: Generating social media posts for brief ${briefId}...`);
    try {
        const { data: contentData } = await supabase.from('content').select('*').eq('brief_id', briefId).single();
        if (!contentData) return;

        if (groq) {
            const prompt = `You are an expert Social Media Manager. Write a highly engaging LinkedIn post and a Twitter (X) post to promote this new blog article.
            Blog Title: ${contentData.title}
            Blog URL: ${liveUrl}
            
            Format your output strictly like this:
            LINKEDIN:
            [LinkedIn post text here]
            
            TWITTER:
            [Twitter post text here]`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            });

            const text = completion.choices[0].message.content;
            
            // Basic parsing (In a real scenario, you'd extract via Regex)
            const linkedinMatch = text.match(/LINKEDIN:\n([\s\S]*?)TWITTER:/);
            const twitterMatch = text.match(/TWITTER:\n([\s\S]*)/);

            const linkedinText = linkedinMatch ? linkedinMatch[1].trim() : text;
            const twitterText = twitterMatch ? twitterMatch[1].trim() : text;

            // Save to new social_posts table
            if (supabase) {
                await supabase.from('social_posts').insert([
                    { content_id: contentData.id, platform: 'LinkedIn', post_text: linkedinText },
                    { content_id: contentData.id, platform: 'Twitter', post_text: twitterText }
                ]);
                
                await supabase.from('content').update({ social_posted: true }).eq('id', contentData.id);
            }
            
            await logActivity('Social Agent', 'SUCCESS', `Social media drafts generated for: ${contentData.title}`);
        }
    } catch (err) {
        console.error(`Agent Social Error:`, err);
        await logActivity('Social Agent', 'ERROR', `Failed generating social posts for ${briefId}`);
    }
}

async function listenForEvents() {
    console.log('Agent Social listening for post_published events...');
    if (!isValidRedisUrl(REDIS_URL)) return;
    try {
        const subClient = redis.createClient({ url: REDIS_URL });
        await subClient.connect();
        await subClient.subscribe('content_events', (message) => {
            const data = JSON.parse(message);
            if (data.event === 'post_published') createSocialPosts(data.post_id || data.brief_id, data.live_url);
        });
    } catch (err) {
        console.error('Agent Social listener failed:', err);
    }
}

listenForEvents();
