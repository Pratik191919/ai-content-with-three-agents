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
let redisClient;

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

async function fetchGSCData(url) {
    console.log(`Agent 03: Simulating dynamic GSC data for ${url}...`);
    return {
        avg_position: Number((Math.random() * 20 + 1).toFixed(1)), // 1.0 to 21.0
        clicks: Math.floor(Math.random() * 500),
        ctr: Number((Math.random() * 5).toFixed(1)), // 0.0 to 5.0
        impressions: Math.floor(Math.random() * 20000),
        content_freshness: Math.random() > 0.5 ? 'high' : 'low',
        word_count_diff: Math.floor(Math.random() * 600) - 300
    };
}

function calculatePerformanceScore(gscData, seoScore) {
    console.log('Agent 03: Calculating performance score...');
    let score = 100;
    if (gscData.ctr < 3.0) score -= 15;
    if (gscData.avg_position > 10) score -= 20;
    if (gscData.content_freshness === 'low') score -= 15;
    if (gscData.word_count_diff < 0) score -= 10;

    return Math.floor((score + seoScore) / 2);
}

async function createRewriteBrief(postId, postData, metrics, score) {
    console.log(`Agent 03: Performance score ${score} < 60. Alerting for rewrite for ${postId}...`);

    console.log(`Agent 03: Sending rewrite task back to Agent 02...`);

    const eventData = {
        event: 'audit_complete',
        post_id: postId,
        action: 'rewrite',
        reason: `Low CTR (${metrics.ctr}%) and poor rank.`
    };

    if (!isValidRedisUrl(REDIS_URL)) {
        console.warn('Agent 03: Redis disabled — skipping rewrite event emit.');
        return;
    }
    const publishClient = redis.createClient({ url: REDIS_URL });
    publishClient.on('error', err => console.error('Agent 03 Publish Error:', err.message));
    await publishClient.connect();
    await publishClient.publish('content_events', JSON.stringify(eventData));
    await publishClient.disconnect();
}

async function processAudit(postId) {
    try {
        const { data: responseData, error } = await supabase.from('content').select('*').eq('id', postId);

        if (error || !responseData || responseData.length === 0) {
            console.log(`Agent 03: Post ${postId} not found!`);
            return;
        }

        const post = responseData[0];
        const liveUrl = post.live_url;
        const seoScore = post.seo_score || 0;

        const metrics = await fetchGSCData(liveUrl);
        const score = calculatePerformanceScore(metrics, seoScore);

        console.log(`Agent 03: Calculated score ${score} for post ${post.title}`);

        // ALWAYS RECORD AUDIT DATA
        await supabase.from('post_performance').insert({
            post_id: postId,
            avg_position: metrics.avg_position,
            clicks: metrics.clicks,
            ctr: metrics.ctr,
            impressions: metrics.impressions,
            score: score
        });

        if (score < 60) {
            await createRewriteBrief(postId, post, metrics, score);
            await logActivity('Auditor (Agent 03)', 'ERROR', `SEO Alert! Low performance for: ${post.title}`, { score, postId });
        } else {
            console.log("Agent 03: Score is 60 or higher. No rewrite needed.");
            await logActivity('Auditor (Agent 03)', 'SUCCESS', `SEO Audit Complete for: ${post.title}`, { score, postId });
        }
    } catch (err) {
        console.error(`Error auditing post ${postId}:`, err);
        await logActivity('Auditor (Agent 03)', 'ERROR', `Audit failed for post ID ${postId}`, { error: err.message });
    }
}

async function listenForEvents() {
    console.log('Agent 03 - Content Auditor listening for events...');
    if (!isValidRedisUrl(REDIS_URL)) {
        console.warn('Agent 03: Redis disabled — REDIS_URL invalid. Auditor will be inactive.');
        return;
    }
    try {
        redisClient = redis.createClient({ url: REDIS_URL });
        redisClient.on('error', err => console.error('Agent 03 Listen Error:', err.message));
        await redisClient.connect();

        await redisClient.subscribe('content_events', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.event === 'post_published') {
                    processAudit(data.post_id);
                }
            } catch (err) {
                console.error('Agent 03: Mismatch event data parsing', err);
            }
        });
    } catch (err) {
        console.error('Agent 03 listener failed:', err);
    }
}

async function runPeriodicAudit() {
    console.log('Agent 03: Starting periodic 4-hour SEO audit...');
    try {
        const { data: posts, error } = await supabase.from('content').select('id').eq('status', 'PUBLISHED');
        if (!error && posts) {
            for (const post of posts) {
                await processAudit(post.id);
            }
        }
    } catch (e) { console.error('Periodic audit fail', e); }
}

async function startAuditor() {
    listenForEvents();
    
    // Periodic audit every 4 hours
    while (true) {
        await logActivity('Auditor (Agent 03)', 'INFO', 'Starting system-wide SEO performance sweep');
        await runPeriodicAudit();
        console.log('Agent 03: Sweep complete. Sleeping for 4 hours...');
        await new Promise(res => setTimeout(res, 4 * 60 * 60 * 1000));
    }
}

startAuditor();
