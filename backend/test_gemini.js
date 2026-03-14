require('dotenv').config({ path: '../frontend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('API Key:', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

model.generateContent('Say "API is working!" in exactly 5 words.')
    .then(r => console.log('✅ Gemini Response:', r.response.text()))
    .catch(e => console.error('❌ Error:', e.message));
