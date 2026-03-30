const { createClient } = require('@insforge/sdk');
require('dotenv').config();

async function test() {
    const baseUrl = process.env.VITE_INSFORGE_BASE_URL;
    const anonKey = process.env.VITE_INSFORGE_ANON_KEY;
    
    if (!baseUrl || !anonKey) {
        console.error('Missing .env variables!');
        return;
    }

    const insforge = createClient({ baseUrl, anonKey });

    console.log('Connecting to:', baseUrl);
    await insforge.realtime.connect();
    
    console.log('Subscribing to game:test-123...');
    const result = await insforge.realtime.subscribe('game:test-123');
    
    console.log('Subscribe result:', JSON.stringify(result, null, 2));
    
    insforge.realtime.disconnect();
}

test().catch(console.error);
