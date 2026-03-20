require('dotenv').config({ path: '../frontend/.env' });
const axios = require('axios');
const FormData = require('form-data');

async function testFreepik() {
    try {
        console.log("FREEPIK_API_KEY:", process.env.FREEPIK_API_KEY ? "Loaded" : "Missing");
        console.log("Connecting to Freepik...");
        const freepikRes = await axios.post('https://api.freepik.com/v1/ai/text-to-image', {
            prompt: "A beautiful futuristic smartwatch on a table, 4k, dynamic lighting"
        }, {
            headers: {
                'x-freepik-api-key': process.env.FREEPIK_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log("Freepik Response HTTP Status:", freepikRes.status);
        console.log("Freepik Data preview:", JSON.stringify(freepikRes.data).substring(0, 150));
        
        const base64Data = freepikRes.data?.data?.[0]?.base64 || freepikRes.data?.data?.[0]?.url;
        console.log("Extracted base64/url length:", base64Data ? base64Data.length : "None extracting");

        if (base64Data) {
            console.log("✅ Freepik generation successful.");
        }
    } catch (e) {
        console.error("❌ Freepik request failed:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

testFreepik();
