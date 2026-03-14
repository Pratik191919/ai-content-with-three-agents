const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const Groq = require('groq-sdk');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : { from: () => ({ select: () => ({ eq: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };
const redisClient = redis.createClient({ url: REDIS_URL });

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// 8 rotating categories — each cycle picks a different one
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

let lastCategoryIndex = -1;

function pickNextCategory() {
    // Rotate to next category, skip same as last
    let idx;
    do {
        idx = Math.floor(Math.random() * BLOG_CATEGORIES.length);
    } while (idx === lastCategoryIndex && BLOG_CATEGORIES.length > 1);
    lastCategoryIndex = idx;
    return BLOG_CATEGORIES[idx];
}

async function scanTrends() {
    const category = pickNextCategory();
    console.log(`Agent 01: Requesting unique trend from Groq AI for category: [${category}]...`);
    if (!groq) throw new Error('GROQ_API_KEY is missing. Add it to your .env file.');

    const seed = Date.now(); // ensures uniqueness each call
    let attempts = 0;
    while (attempts < 5) {
        try {
            const prompt = `You are a content strategist. Generate 1 hot, trending, UNIQUE blog topic for the "${category}" category in 2026.
Seed for uniqueness: ${seed}

Return ONLY a valid JSON array with exactly 1 object. No markdown. Example format:
[{"topic": "How AI is Transforming Home Cooking in 2026", "category": "Food & Recipes", "trend_score": 87}]

Rules:
- topic must be a specific, catchy, full blog post title (not just a keyword)
- topic must be 100% unique and different from generic titles
- category must be exactly: ${category}
- trend_score must be a number between 60 and 100`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 1.0  // max creativity for unique topics
            });

            const text = completion.choices[0].message.content;
            const cleaned = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [parsed];

        } catch (e) {
            attempts++;
            console.error(`Agent 01: Groq API failed (Attempt ${attempts}/5). Retrying in 5 seconds... Error:`, e.message);
            await new Promise(res => setTimeout(res, 5000));
            if (attempts >= 5) {
                console.error('Agent 01: All retries failed. Giving up for this cycle.');
                throw new Error('Failed to scan trends after 5 attempts.');
            }
        }
    }
}

async function deduplicateTrends(trends) {
    console.log('Agent 01: Deduplicating trends using mock approach...');
    return trends;
}

async function generateBrief(topicData) {
    const category = topicData.category || 'Technology & AI';
    console.log(`Agent 01: Generating brief for [${category}] → ${topicData.topic}...`);
    return {
        title: topicData.topic,  // use AI-generated title directly (already catchy & unique)
        target_keyword: topicData.topic.toLowerCase().split(' ').slice(0, 4).join(' '),
        secondary_keywords: [category.toLowerCase(), '2026', 'guide'],
        outline: 'H2 Introduction\nH2 Key Insights\nH2 Practical Tips\nH2 Future Outlook\nH2 Conclusion',
        angle: `Trending ${category} perspective for 2026`,
        word_count_target: 800,
        trend_score: topicData.trend_score,
        category: category
    };
}

async function processTask() {
    try {
        const rawTrends = await scanTrends();
        const uniqueTrends = await deduplicateTrends(rawTrends);

        for (const trend of uniqueTrends) {
            const brief = await generateBrief(trend);

            const { data, error } = await supabase.from('content_briefs').insert({
                title: brief.title,
                target_keyword: brief.target_keyword,
                secondary_keywords: brief.secondary_keywords,
                outline: brief.outline,
                angle: brief.angle,
                status: 'PENDING',
                word_count_target: brief.word_count_target,
                trend_score: brief.trend_score
            }).select();

            if (error) {
                console.error('Error inserting brief:', error.message);
                continue;
            }

            if (data && data.length > 0) {
                const briefId = data[0].id;
                const eventData = {
                    event: 'content_briefs_ready',
                    brief_id: briefId
                };

                await redisClient.publish('content_events', JSON.stringify(eventData));
                console.log(`Agent 01: Brief saved & event 'content_briefs_ready' published for brief ID ${briefId}`);
            }
        }
    } catch (error) {
        console.error('Unexpected error during task execution:', error);
    }
}

async function runAgent01() {
    console.log('Starting Agent 01 - Content Strategist (Daemon Mode)');
    
    try {
        await redisClient.connect();
        
        while (true) {
            await processTask();
            console.log('Agent 01: Task complete. Sleeping for 4 hours to fetch next trend...');
            await new Promise(resolve => setTimeout(resolve, 4 * 60 * 60 * 1000));
        }
    } catch (error) {
        console.error('Daemon crashed:', error);
    } finally {
        console.log('Disconnecting from Redis...');
        try { await redisClient.disconnect(); } catch (e) {}
    }
}

runAgent01();
