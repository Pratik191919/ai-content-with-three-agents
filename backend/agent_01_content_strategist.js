const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) 
    ? createClient(SUPABASE_URL, SUPABASE_KEY) 
    : { from: () => ({ select: () => ({ eq: () => ({}) }), insert: () => ({ select: () => ({}) }), update: () => ({ eq: () => ({}) }) }) };
const redisClient = redis.createClient({ url: REDIS_URL });

let genAI;
let model;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function scanTrends() {
    console.log('Agent 01: Requesting dynamic trends from Gemini AI...');
    let attempts = 0;
    while (attempts < 5) {
        try {
            if (!model) throw new Error("Gemini model not initialized.");
            const prompt = "Generate 1 random hot trending topic in technology or marketing for 2026. Only return a valid JSON array of objects containing exactly 1 object. Each object must have a 'topic' (string) and a 'trend_score' (number between 50 and 100). Do not use markdown blocks, just raw JSON.";
            
            // Force pure JSON from the model if supported, otherwise just rely on prompt instructions
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            const cleaned = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [parsed];
            
        } catch (e) {
            attempts++;
            console.error(`Agent 01: Gemini API failed (Attempt ${attempts}/5). Retrying in 5 seconds... Error:`, e.message);
            await new Promise(res => setTimeout(res, 5000));
            if (attempts >= 5) {
                console.error("Agent 01: All retries failed. Giving up for this cycle.");
                throw new Error("Failed to scan trends. Free API exhausted.");
            }
        }
    }
}

async function deduplicateTrends(trends) {
    console.log('Agent 01: Deduplicating trends using mock approach...');
    return trends;
}

async function generateBrief(topicData) {
    console.log(`Agent 01: Generating brief for ${topicData.topic}...`);
    return {
        title: `Best ${topicData.topic} in 2026`,
        target_keyword: topicData.topic.toLowerCase(),
        secondary_keywords: ['guide', 'tutorial', 'best practices'],
        outline: 'H2 Introduction\nH2 Top Tools\nH2 Benefits\nH2 Use Cases\nH2 Conclusion',
        angle: 'Comprehensive review and ranking',
        word_count_target: 1500,
        trend_score: topicData.trend_score
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
