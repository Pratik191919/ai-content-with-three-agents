const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const { isValidRedisUrl } = require('./redis-helper');
const FEATURES = require('./features');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || '';

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try { await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata }); } catch (err) {}
}

async function discoverTrends() {
    if (!FEATURES.trend_enabled) {
        console.log(`Agent Trend: Feature disabled. Skipping.`);
        return;
    }

    console.log(`Agent Trend: Searching for trending topics...`);
    try {
        // Simulating Google Trends API fetch
        const mockTrends = [
            { keyword: 'AI Agents in 2026', volume: 50000 },
            { keyword: 'Sustainable Tech Trends', volume: 45000 },
            { keyword: 'Quantum Computing Startups', volume: 30000 }
        ];

        for (const trend of mockTrends) {
            if (supabase) {
                await supabase.from('trending_topics').insert([
                    { keyword: trend.keyword, search_volume: trend.volume, source: 'Google Trends' }
                ]);
            }
        }
        
        await logActivity('Trend Agent', 'SUCCESS', `Discovered ${mockTrends.length} new trending topics.`);

        // Notify Topic Agent to start generating briefs based on these trends
        if (isValidRedisUrl(REDIS_URL)) {
            const publishClient = redis.createClient({ url: REDIS_URL });
            await publishClient.connect();
            await publishClient.publish('content_events', JSON.stringify({ event: 'trends_discovered' }));
            await publishClient.disconnect();
        }
    } catch (err) {
        console.error(`Agent Trend Error:`, err);
        await logActivity('Trend Agent', 'ERROR', `Failed discovering trends: ${err.message}`);
    }
}

// Run every 24 hours (86400000 ms)
setInterval(discoverTrends, 24 * 60 * 60 * 1000);

// Run once on startup
setTimeout(discoverTrends, 5000);
console.log('Agent Trend started. Running daily schedule.');
