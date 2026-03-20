require('dotenv').config({ path: '../frontend/.env' });
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Replicating exactly the publishToCMS logic
const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testLocalGeneration() {
    console.log("🚀 FORCING LOCAL GENERATION TO PROVE FREEPIK FIX...");
    const postData = {
        title: "Test: Bypassing Render Ghost Server",
        html_content: "<p>This is a test block to prove Freepik works.</p><p>Second paragraph for splicing.</p><p>Third paragraph for splicing.</p><p>Final conclusion.</p>",
        category: "Technology"
    };
    
    let prompts = [
        "Test thumbnail concept, highly futuristic beautiful",
        "Test visualization inside article, modern digital art",
        "Test analytics chart, data infographic concept"
    ];

    const uploadedMedia = [];
    
    for (let i = 0; i < prompts.length; i++) {
        try {
            process.stdout.write(`Local Agent 02: 🤖 Generating Image ${i+1}/3 via Freepik... `);
            const freepikRes = await axios.post('https://api.freepik.com/v1/ai/text-to-image', { prompt: prompts[i] }, {
                headers: { 'x-freepik-api-key': process.env.FREEPIK_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            let imageBuffer;
            const base64Data = freepikRes.data?.data?.[0]?.base64;
            if (base64Data) {
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (freepikRes.data?.data?.[0]?.url) {
                const imgRes = await axios.get(freepikRes.data.data[0].url, { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(imgRes.data);
            } else throw new Error('Invalid response');
            console.log(`Success!`);

            const form = new FormData();
            form.append('media[]', imageBuffer, { filename: `freepik-test-${i}-${Date.now()}.jpg`, contentType: 'image/jpeg' });

            const uploadRes = await axios.post(`https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/media/new`, form, {
                headers: { ...form.getHeaders(), 'Authorization': `Bearer ${WP_COM_TOKEN}` }
            });

            const mediaItem = uploadRes.data.media?.[0];
            if (mediaItem && mediaItem.ID) {
                uploadedMedia.push({ id: mediaItem.ID, url: mediaItem.URL || mediaItem.url || mediaItem.source_url });
                console.log(`Local Agent 02: ✅ Uploaded (ID: ${mediaItem.ID})`);
            }
        } catch (err) {
            console.log("❌ Failed:", err.response?.data || err.message);
        }
        
        if (i < prompts.length - 1) {
            console.log("Local Agent 02: Waiting 4 seconds for Freepik API...");
            await new Promise(r => setTimeout(r, 4000));
        }
    }

    console.log(`\n🎉 Test Complete! Generated Images: ${uploadedMedia.length}`);
    if (uploadedMedia.length >= 3) {
        console.log(`Featured Image URL: ${uploadedMedia[0].url}`);
        console.log(`Content Image 1 URL: ${uploadedMedia[1].url}`);
        console.log(`Content Image 2 URL: ${uploadedMedia[2].url}`);
        console.log("Your local code works perfectly! Render was just stealing the DB tasks.");
    }
}

testLocalGeneration();
