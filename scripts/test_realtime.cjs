const { createClient } = require('@insforge/sdk');
require('dotenv').config();

async function test() {
    const insforge = createClient({
        baseUrl: process.env.VITE_SUPERBASE_URL || process.env.VITE_INSFORGE_URL,
        anonKey: process.env.VITE_SUPERBASE_ANON_KEY || process.env.VITE_INSFORGE_ANON_KEY
    });

    console.log('Connecting...');
    await insforge.realtime.connect();
    
    console.log('Subscribing...');
    const result = await insforge.realtime.subscribe('test_channel');
    console.log('Subscribe result:', result);
    
    insforge.realtime.disconnect();
}

test().catch(console.error);
