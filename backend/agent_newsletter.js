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

async function generateNewsletter() {
    if (!FEATURES.newsletter_enabled) {
        console.log(`Agent Newsletter: Feature disabled. Skipping.`);
        return;
    }

    console.log(`Agent Newsletter: Compiling weekly newsletter...`);
    try {
        if (!supabase || !groq) return;

        // Fetch posts from the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: posts } = await supabase.from('content')
            .select('title, live_url')
            .eq('status', 'PUBLISHED')
            .gte('created_at', sevenDaysAgo.toISOString());

        if (!posts || posts.length === 0) {
            console.log('Agent Newsletter: No new posts this week.');
            return;
        }

        const blogList = posts.map(p => `- ${p.title}: ${p.live_url}`).join('\n');

        const prompt = `You are an expert Email Marketer. I need a weekly newsletter summarizing our latest AI blog posts.
        Write a catchy subject line, a brief engaging intro, and then present the following links in an exciting way.
        Output ONLY valid HTML code for an email body. Do NOT use markdown code blocks.
        
        Recent Posts:
        ${blogList}`;

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        });

        const htmlBody = completion.choices[0].message.content.replace(/```html/gi, '').replace(/```/gi, '').trim();
        
        // Extract a simple subject line (in a real scenario, could ask AI to structure it as JSON)
        const subjectLine = "Your Weekly AI & Tech Insights! 🚀";

        await supabase.from('newsletters').insert([{
            subject_line: subjectLine,
            html_body: htmlBody,
            status: 'DRAFT'
        }]);

        await logActivity('Newsletter Agent', 'SUCCESS', `Compiled weekly newsletter with ${posts.length} posts.`);
    } catch (err) {
        console.error(`Agent Newsletter Error:`, err);
        await logActivity('Newsletter Agent', 'ERROR', `Failed generating newsletter: ${err.message}`);
    }
}

// Run every 7 days (604800000 ms)
setInterval(generateNewsletter, 7 * 24 * 60 * 60 * 1000);

// Run once on startup to test
setTimeout(generateNewsletter, 10000);
console.log('Agent Newsletter started. Running weekly schedule.');
