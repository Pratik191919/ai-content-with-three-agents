const axios = require('axios');
const fs = require('fs');
const WP_URL = 'http://ai-content.lovestoblog.com';
const auth = Buffer.from('admin:fg6c JeUZ SQCN FJpC rx89 w40y').toString('base64');

async function test() {
    try {
        const res = await axios.get('https://picsum.photos/200/300', { responseType: 'arraybuffer' });
        
        const up = await axios.post(WP_URL + '/wp-json/wp/v2/media', res.data, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Disposition': 'attachment; filename="test.jpg"',
                'Content-Type': 'image/jpeg'
            }
        });
        console.log('Media Success raw data:', up.data);
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();
