const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const FEATURES = require('./features');
require('dotenv').config({ path: '../frontend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

async function logActivity(agentName, eventType, message, metadata = {}) {
    if (!supabase) return;
    try { await supabase.from('agent_logs').insert({ agent_name: agentName, event_type: eventType, message: message, metadata: metadata }); } catch (err) {}
}

async function analyzePerformance() {
    if (!FEATURES.analytics_enabled) {
        console.log(`Agent Analytics: Feature disabled. Skipping.`);
        return;
    }

    console.log(`Agent Analytics: Analyzing blog performance...`);
    try {
        if (!supabase) return;

        // Fetch top performing posts (mocking views/clicks logic)
        const { data: topPosts } = await supabase.from('content')
            .select('title, views, clicks')
            .eq('status', 'PUBLISHED')
            .order('views', { ascending: false })
            .limit(5);

        if (!topPosts || topPosts.length === 0) return;

        const performanceData = topPosts.map(p => `${p.title} (Views: ${p.views})`).join('\n');

        const prompt = `You are a Content Data Analyst. Based on the following top performing blog posts, suggest 3 new high-level topics or categories we should write about next to maximize traffic.
        
        Top Posts:
        ${performanceData}
        
        Output ONLY the 3 suggested categories/topics as a comma-separated list.`;

        const { generateWithFallback } = require('./llm_helper');
        const rawResult = await generateWithFallback(prompt, 0.5);

        const suggestions = rawResult.trim();
        
        await logActivity('Analytics Agent', 'SUCCESS', `Analyzed data. Suggested focus areas: ${suggestions}`);

    } catch (err) {
        console.error(`Agent Analytics Error:`, err);
        await logActivity('Analytics Agent', 'ERROR', `Failed running analytics: ${err.message}`);
    }
}

// Run every 24 hours (86400000 ms)
setInterval(analyzePerformance, 24 * 60 * 60 * 1000);

// Run once on startup to test
setTimeout(analyzePerformance, 15000);
console.log('Agent Analytics started. Running daily schedule.');
