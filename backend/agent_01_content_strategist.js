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
    : { from: () => ({ select: () => ({ eq: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };

// Guard: only create Redis client if URL is valid (redis:// or rediss://)
const redisClient = isValidRedisUrl(REDIS_URL)
    ? redis.createClient({ url: REDIS_URL })
    : null;
if (!redisClient) console.warn('Agent 01: Redis disabled — REDIS_URL is missing or invalid. Events will be skipped.');

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
    console.log(`Agent 01: Requesting unique trends from Groq AI...`);
    if (!groq) throw new Error('GROQ_API_KEY is missing. Add it to your .env file.');

    const seed = Date.now();
    let attempts = 0;
    while (attempts < 5) {
        try {
            const prompt = `You are a content strategist. Generate 1 hot, trending blog topic for 2026.
Seed: ${seed}

Choose the BEST category for this topic from this list:
[${BLOG_CATEGORIES.join(', ')}]

Return ONLY a valid JSON array with exactly 1 object.
Format: [{"topic": "...", "category": "...", "trend_score": 87}]

Rules:
- topic must be a specific, catchy blog title.
- category MUST be one from the provided list.
- trend_score must be 60-100.`;

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
            attempts++;
            await new Promise(res => setTimeout(res, 5000));
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
                category: brief.category,
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
