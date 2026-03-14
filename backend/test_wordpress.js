require('dotenv').config({ path: '../frontend/.env' });

const WP_COM_SITE = process.env.WP_COM_SITE || 'myaiagentblog09.wordpress.com';
const WP_COM_TOKEN = process.env.WP_COM_TOKEN ? decodeURIComponent(process.env.WP_COM_TOKEN) : null;

async function testWordPressCom() {
    console.log('Testing WordPress.com API...');
    console.log('Site:', WP_COM_SITE);
    console.log('Token:', WP_COM_TOKEN ? 'SET ✅' : 'MISSING ❌');

    const endpoint = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_COM_SITE}/posts/new`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WP_COM_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: '🤖 AI Test Post - ' + new Date().toLocaleString(),
                content: '<h2>This is AI Generated Content</h2><p>This post was automatically published by the AI Content Agent. The three-agent system is working correctly!</p><p>Agent 01 (Strategist) → Agent 02 (Writer) → Agent 03 (Auditor)</p>',
                status: 'publish'
            })
        });

        const data = await response.json();

        if (data.ID) {
            console.log('\n✅ SUCCESS! Post published to WordPress.com!');
            console.log('Post ID:', data.ID);
            console.log('Live URL:', data.URL);
            console.log('\nVisit your blog: https://' + WP_COM_SITE);
        } else {
            console.log('\n❌ FAILED. Response:');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('\n❌ Error:', err.message);
    }
}

testWordPressCom();
