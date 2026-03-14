const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../frontend/.env');
if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
} else {
    require('dotenv').config(); // Fallback to standard .env in same dir or just process.env
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('FATAL ERROR: SUPABASE_URL or SUPABASE_KEY is missing!');
    console.log('Current SUPABASE_URL:', SUPABASE_URL ? 'PRESENT' : 'MISSING');
}

const supabase = createClient(SUPABASE_URL || 'http://placeholder', SUPABASE_KEY || 'placeholder');
const redisClient = redis.createClient({ url: REDIS_URL });

app.get('/', (req, res) => {
    res.json({ message: 'Content Engine API is running.' });
});

app.get('/api/content/briefs', async (req, res) => {
    const { data, error } = await supabase
        .from('content_briefs')
        .select('id, title, target_keyword, status, created_at')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/posts', async (req, res) => {
    const { data, error } = await supabase
        .from('content')
        .select('id, title, seo_score, live_url, status, created_at')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/content/posts/:briefId', async (req, res) => {
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
    try {
        await redisClient.connect();
        console.log(`✅ API & WebSocket server running on http://localhost:${PORT}`);

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
        console.error('Failed to start:', err);
    }
});
