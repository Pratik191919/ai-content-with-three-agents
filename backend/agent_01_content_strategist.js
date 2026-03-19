const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
const { isValidRedisUrl } = require('./redis-helper');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : { from: () => ({ select: () => ({ eq: () => ({}), order: () => ({ limit: () => ({}) }) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };

const redisClient = isValidRedisUrl(REDIS_URL)
    ? redis.createClient({ url: REDIS_URL })
    : null;

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

const BLOG_CATEGORIES = [
    'Technology & AI',
    'Food & Recipes',
    'Travel & Adventure',
    'Health & Fitness',
    'Lifestyle',
    'Fashion & Beauty',
    'Personal Finance',
    'CMS & Web Development'
];

async function scanTrends() {
    console.log(`Agent 01: Requesting unique trends and image prompts from Groq AI...`);
    if (!groq) throw new Error('GROQ_API_KEY is missing.');

    let lastTitles = [];
    try {
        const { data } = await supabase.from('content_briefs').select('title, category').order('created_at', { ascending: false }).limit(10);
        lastTitles = data ? data.map(d => d.title) : [];
        const lastCategory = (data && data.length > 0) ? data[0].category : null;
        
        const availableCategories = BLOG_CATEGORIES.filter(c => c !== lastCategory);
        const targetCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        
        const prompt = `You are a high-level content strategist. Generate 1 UNIQUE, trending blog topic for 2026.
        
CRITICAL RULES:
- DO NOT use the word "Revolutionizing".
- DO NOT use generic clickbait.
- Category: "${targetCategory}".
- Recent titles (DO NOT REPEAT): ${JSON.stringify(lastTitles)}.

Return ONLY a valid JSON object with a specific image_prompt for pollinations.ai.
Format: {
  "topic": "...", 
  "category": "${targetCategory}", 
  "trend_score": 92,
  "image_prompt": "highly detailed descriptive prompt for AI image generation, cinematic, high resolution"
}`;

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9
        });

        const text = completion.choices[0].message.content;
        const cleaned = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        console.error('Trend scan failed:', e.message);
        return [{ topic: `Future of ${BLOG_CATEGORIES[0]} in 2026`, category: BLOG_CATEGORIES[0], trend_score: 80, image_prompt: 'futuristic technology landscape' }];
    }
}

async function processTask() {
    try {
        const rawTrends = await scanTrends();
        for (const trend of rawTrends) {
            // Note: If this column is missing in your DB, please add it: 
            // ALTER TABLE content_briefs ADD COLUMN featured_image_url TEXT;
            const { data, error } = await supabase.from('content_briefs').insert({
                title: trend.topic,
                target_keyword: trend.topic.toLowerCase().split(' ').slice(0, 4).join(' '),
                status: 'PENDING',
                category: trend.category,
                trend_score: trend.trend_score,
                featured_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(trend.image_prompt)}?width=1200&height=630&nologo=true&seed=${Math.floor(Math.random() * 99999)}`,
                outline: 'H2 Introduction\nH2 Key Insights\nH2 Future Outlook\nH2 Conclusion'
            }).select();

            if (!error && data && data.length > 0) {
                const briefId = data[0].id;
                console.log(`Agent 01: Unique brief created with image preview!`);
                await logActivity('Strategist (Agent 01)', 'SUCCESS', `Generated unique trend: ${trend.topic}`, { brief_id: briefId });
                
                if (redisClient) {
                    await redisClient.publish('content_events', JSON.stringify({ event: 'content_briefs_ready', brief_id: briefId }));
                }
            } else if (error) {
                console.error('Supabase Insert Error:', error.message);
            }
        }
    } catch (error) {
        console.error('Task execution failed:', error);
    }
}

async function runAgent01() {
    console.log('Starting Agent 01 - Content Strategist (Daemon Mode)');
    if (redisClient) await redisClient.connect();
    
    while (true) {
        await processTask();
        console.log('Agent 01: Sequence complete. Sleeping 4 hours...');
        await new Promise(resolve => setTimeout(resolve, 4 * 60 * 60 * 1000));
    }
}

runAgent01();
