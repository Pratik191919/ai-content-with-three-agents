require('dotenv').config({ path: '../frontend/.env' });
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
console.log('Groq API Key:', GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : '❌ MISSING — Add GROQ_API_KEY to .env');

if (!GROQ_API_KEY) process.exit(1);

const groq = new Groq({ apiKey: GROQ_API_KEY });

groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Say "Groq AI is working perfectly!" in exactly 5 words.' }]
}).then(r => console.log('✅ Groq Response:', r.choices[0].message.content))
  .catch(e => console.error('❌ Error:', e.message));
