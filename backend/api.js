const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const http = require('http');
const { Server } = require('socket.io');

// Safely load .env — works locally (../frontend/.env) and on Render (process.env directly)
const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../frontend/.env');
if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
} else {
    require('dotenv').config();
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Safe Supabase initialization — NEVER crash on bad/missing URL
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && /^https?:\/\//i.test(SUPABASE_URL)) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase connected:', SUPABASE_URL);
} else {
    console.error('⚠️  Supabase NOT connected — SUPABASE_URL or SUPABASE_KEY missing/invalid on this environment.');
    console.error('    Set SUPABASE_URL and SUPABASE_KEY in Render Environment Variables.');
}

// Helper: return 503 if supabase not configured
const requireSupabase = (res) => {
    if (!supabase) {
        res.status(503).json({ error: 'Database not configured. Set SUPABASE_URL and SUPABASE_KEY in environment variables.' });
        return false;
    }
    return true;
};

const redisClient = redis.createClient({ url: REDIS_URL });

app.get('/', (req, res) => {
    res.json({
        message: 'Content Engine API is running.',
        supabase: supabase ? 'connected' : 'not configured',
        redis: REDIS_URL
    });
});

app.get('/api/content/briefs', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('content_briefs')
        .select('id, title, target_keyword, status, created_at')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/posts', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('content')
        .select('id, title, seo_score, live_url, status, created_at')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/posts/:briefId', async (req, res) => {
    if (!requireSupabase(res)) return;
    const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('brief_id', req.params.briefId)
        .limit(1);

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Post not found' });

    res.json(data[0]);
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

const PORT = process.env.PORT || 8000;

server.listen(PORT, async () => {
    console.log(`✅ API & WebSocket server running on port ${PORT}`);
    try {
        await redisClient.connect();
        console.log('✅ Redis connected');

        // Subscribe to Redis events and stream to socket.io
        const subscriber = redis.createClient({ url: REDIS_URL });
        await subscriber.connect();
        await subscriber.subscribe('content_events', (message) => {
            try {
                const data = JSON.parse(message);
                io.emit('agent_event', data);
            } catch (err) { }
        });
    } catch (err) {
        console.error('Redis connection failed (non-fatal on Render free tier):', err.message);
    }
});
