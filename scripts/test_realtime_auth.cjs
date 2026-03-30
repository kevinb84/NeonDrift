const { createClient } = require('@insforge/sdk');
require('dotenv').config();

async function test() {
    const baseUrl = process.env.VITE_INSFORGE_BASE_URL;
    const anonKey = process.env.VITE_INSFORGE_ANON_KEY;
    const insforge = createClient({ baseUrl, anonKey });

    console.log('Signing up dummy user...');
    await insforge.auth.signUp({
        email: 'test_realtime_dummy@neon.project',
        password: 'Password123!',
        name: 'Dummy'
    });

    const { data, error } = await insforge.auth.signInWithPassword({
        email: 'test_realtime_dummy@neon.project',
        password: 'Password123!'
    });

    console.log('Logged in:', !!data?.session);
    
    await insforge.realtime.connect();
    console.log('Subscribing to game:test-123...');
    const result = await insforge.realtime.subscribe('game:test-123');
    console.log('Subscribe result:', JSON.stringify(result, null, 2));
    
    insforge.realtime.disconnect();
}
test().catch(console.error);
