const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../frontend/.env' });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/**
 * Attempts to generate text using Groq first. 
 * If a 429 Rate Limit error occurs, it automatically falls back to Gemini.
 */
async function generateWithFallback(prompt, temperature = 0.7) {
    let groqError = null;
    
    // Attempt 1: Groq
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature
            });
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Groq API Error:', error.message);
            // Check if it's a 429 rate limit or tokens issue
            if (error.status === 429 || error.message.includes('429') || error.message.includes('rate_limit') || error.message.includes('tokens')) {
                console.log('⚠️ Groq Rate Limit Reached! Falling back to Gemini AI...');
                groqError = error;
            } else {
                throw error; // Throw other types of errors (e.g. auth failed)
            }
        }
    } else {
        console.log('No GROQ_API_KEY found, defaulting to Gemini...');
    }

    // Attempt 2: Gemini Fallback
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: temperature }
            });
            return result.response.text();
        } catch (geminiError) {
            console.error('Gemini API Error:', geminiError.message);
            throw new Error('Both Groq and Gemini failed. Groq: ' + (groqError ? groqError.message : 'N/A') + ' | Gemini: ' + geminiError.message);
        }
    }

    throw new Error('No AI configured! Please set GROQ_API_KEY or GEMINI_API_KEY in .env');
}

module.exports = { generateWithFallback };
