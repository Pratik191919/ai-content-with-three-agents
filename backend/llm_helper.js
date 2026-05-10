const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Attempts to generate text using Gemini first. 
 * If it fails (rate limit, unavailable, etc), it automatically falls back to Groq.
 */
async function generateWithFallback(prompt, temperature = 0.7) {
    let geminiError = null;
    
    // Attempt 1: Gemini (Primary)
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: temperature }
            });
            return result.response.text();
        } catch (error) {
            console.error('Gemini API Error:', error.message);
            geminiError = error;
            console.log('⚠️ Gemini Failed! Falling back to Groq AI...');
        }
    } else {
        console.log('No GEMINI_API_KEY found, defaulting to Groq...');
    }

    // Attempt 2: Groq Fallback
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature
            });
            return completion.choices[0].message.content;
        } catch (groqError) {
            console.error('Groq API Error:', groqError.message);
            throw new Error('Both Gemini and Groq failed. Gemini: ' + (geminiError ? geminiError.message : 'N/A') + ' | Groq: ' + groqError.message);
        }
    }

    throw new Error('No AI configured! Please set GROQ_API_KEY or GEMINI_API_KEY in .env');
}

module.exports = { generateWithFallback };
