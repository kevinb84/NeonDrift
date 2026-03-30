import { createClient } from '@insforge/sdk';

const insforge = createClient(process.env.VITE_INSFORGE_BASE_URL || '', process.env.VITE_INSFORGE_ANON_KEY || '');

async function createReplaysBucket() {
    const { data, error } = await insforge.storage.createBucket('replays', { public: true });
    console.log("Create Bucket Result:", data, error);
}

createReplaysBucket();
