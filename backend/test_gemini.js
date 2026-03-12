const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function test() {
    console.log("Key length:", GEMINI_API_KEY.length);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    try {
        const result = await model.generateContent("Say hello");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
test();
