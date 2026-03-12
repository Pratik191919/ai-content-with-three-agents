const { createClient } = require('redis');
require('dotenv').config({ path: 'frontend/.env' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`Testing connection to Redis using URL:\n${REDIS_URL}\n`);

async function testRedis() {
    const client = createClient({
        url: REDIS_URL
    });

    client.on('error', (err) => {
        console.error('❌ CONNECTION ERROR! Could not connect to Redis at that URL.');
        console.error(`Details: ${err.message}`);
        process.exit(1);
    });

    try {
        await client.connect();
        const pingResponse = await client.ping();
        if (pingResponse === 'PONG') {
            console.log('✅ SUCCESS! Redis is running and successfully connected!');
            process.exit(0);
        } else {
            console.log('❌ FAILED! Redis did not respond properly to ping.');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ UNEXPECTED ERROR: ', err);
        process.exit(1);
    }
}

testRedis();
