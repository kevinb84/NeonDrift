import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.73.0';

// Note: In production, ORACLE_SECRET_KEY is a base58 encoded string in env vars
// representing the 64-byte Ed25519 secret key. 
const ORACLE_SECRET_KEY_ENV = Deno.env.get('ORACLE_SECRET_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!ORACLE_SECRET_KEY_ENV) {
            throw new Error("ORACLE_SECRET_KEY is not configured on the server.");
        }

        const { matchId, winnerPubkey, raceInputs } = await req.json();

        if (!matchId || !winnerPubkey || !raceInputs) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // 1. Simulate deterministic race engine to verify inputs
        // In a real scenario, we run the deterministic physics engine against `raceInputs`.
        // For this devnet MVP scaffolding, we assume the inputs successfully validate the `winnerPubkey`
        console.log(`[Oracle] Verifying race ${matchId}. Winner: ${winnerPubkey}`);
        const isValid = true;

        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Race validation failed' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // 2. Oracle Data Preparation
        // The exact message layout: `matchId` bytes + `winner_pubkey` bytes
        // The game generates standard UUIDs which have hyphens, 
        // but we strip them and enforce exactly 32 bytes for PDA limits.
        const seedStr = matchId.replace(/-/g, '').substring(0, 32);
        const matchIdBytes = new TextEncoder().encode(seedStr);

        // Parse the winner's base58 string into a byte array
        let winnerPublicKey;
        try {
            winnerPublicKey = new PublicKey(winnerPubkey);
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid winnerPubkey base58 string' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        const winnerBytes = winnerPublicKey.toBytes();

        // Concat message
        const message = new Uint8Array(matchIdBytes.length + winnerBytes.length);
        message.set(matchIdBytes, 0);
        message.set(winnerBytes, matchIdBytes.length);

        // 3. Oracle Cryptographic Sign
        // Decode Oracle secret from Base58 or Uint8Array (assuming comma-separated array string for MVP env var)
        let secretKeyArray: Uint8Array;
        if (ORACLE_SECRET_KEY_ENV.includes(',')) {
            secretKeyArray = new Uint8Array(ORACLE_SECRET_KEY_ENV.split(',').map(Number));
        } else {
            // Fallback for base58 string in future
            throw new Error("Expected comma separated Uint8Array string for ORACLE_SECRET_KEY");
        }

        const signature = nacl.sign.detached(message, secretKeyArray);

        return new Response(JSON.stringify({
            success: true,
            matchId,
            winnerPubkey,
            signature: Array.from(signature) // Convert to standard array for JSON transport
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Error in oracle-sign endpoint:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
