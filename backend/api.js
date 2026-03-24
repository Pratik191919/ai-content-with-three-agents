const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createServer } = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
require('dotenv').config({ path: '../frontend/.env' });

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 8000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'))
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

app.use(cors());
app.use(express.json());

function requireSupabase(res) {
    if (!supabase) {
        res.status(500).json({ error: 'Supabase URL/Key missing. Configure .env first.' });
        return false;
    }
    return true;
}

// ─── Endpoints ───────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/content/briefs', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('content_briefs')
        .select('id, title, target_keyword, status, category, created_at')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/posts', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('content')
        .select('id, brief_id, title, status, category, seo_score, live_url, created_at, featured_image_url, content_image, content_image_1, content_image_2, html_content')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/performance', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('post_performance')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// New Endpoint: Fetch Agent Activity Logs
app.get('/api/content/logs', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── WebSocket & Startup ────────────────────────────────────

io.on('connection', (socket) => {
    console.log('Client connected to Vision Board');
});

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ API & WebSocket server running on port ${PORT}`);
    
    // Redis Subscriber for Realtime WebSocket Events
    try {
        const subscriber = redis.createClient({ url: REDIS_URL });
        subscriber.on('error', err => console.error('API Redis Error:', err.message));
        await subscriber.connect();
        await subscriber.subscribe('content_events', (message) => {
            try {
                const parsed = JSON.parse(message);
                io.emit('agent_event', parsed);
            } catch (e) { }
        });
    } catch (err) {
        console.error('Redis connection failed (non-fatal):', err.message);
    }
});
