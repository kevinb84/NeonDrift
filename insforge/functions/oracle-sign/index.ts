import { createClient } from "npm:@insforge/sdk";
import nacl from "npm:tweetnacl";
import { PublicKey } from "npm:@solana/web3.js";
import bs58 from "npm:bs58";

export default async function (req: Request): Promise<Response> {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { matchId, winnerPubkey } = body;

        if (!matchId || !winnerPubkey) {
            throw new Error('Missing matchId or winnerPubkey');
        }

        // Validate the requesting user is authenticated!
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const token = authHeader.replace('Bearer ', '');
        const baseUrl = Deno.env.get('INSFORGE_BASE_URL') || '';
        const API_KEY = Deno.env.get('API_KEY'); 

        // 1. Verify user identity
        const { createClient: createSupabase } = await import("npm:@supabase/supabase-js");
        const supabase = createSupabase(baseUrl, API_KEY);
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            throw new Error('Unauthorized user');
        }

        // 2. Validate match state in database before signing
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            throw new Error('Match not found');
        }

        // Prevent double signing (replay protection)
        if (match.status === 'completed' || match.winner_wallet) {
            throw new Error('Match is already completed or signed');
        }

        // 3. Optional: Add additional security checks here
        // (Is the winnerPubkey actually one of the participants?)
        if (match.creator_wallet !== winnerPubkey && match.opponent_wallet !== winnerPubkey) {
            throw new Error('Winner is not a participant of this match');
        }

        // 4. Generate Oracle Signature for Solana
        const oracleSecretB58 = Deno.env.get('ORACLE_SECRET_KEY');
        if (!oracleSecretB58) throw new Error('Oracle secret key not configured');

        // Note: Our oracle-server.cjs used an Array of numbers.
        // If the environment variable is base58 encoded from Phantom or custom generated:
        // Assume ORACLE_SECRET_KEY is base58 string.
        let secretKeyUint8: Uint8Array;
        try {
            // First check if it's JSON (array of numbers) - like the local json file
            if (oracleSecretB58.startsWith('[')) {
                secretKeyUint8 = Uint8Array.from(JSON.parse(oracleSecretB58));
            } else {
                secretKeyUint8 = bs58.decode(oracleSecretB58);
            }
        } catch (e) {
            throw new Error('Failed to decode ORACLE_SECRET_KEY');
        }

        const winnerKey = new PublicKey(winnerPubkey);
        const seedStr = matchId.replace(/-/g, '').substring(0, 32);

        // Build the message: matchId bytes + winnerPubkey bytes
        const messageBuf = new Uint8Array(seedStr.length + winnerKey.toBuffer().length);
        messageBuf.set(new TextEncoder().encode(seedStr));
        messageBuf.set(winnerKey.toBuffer(), seedStr.length);

        // Sign the message
        const signatureBytes = nacl.sign.detached(messageBuf, secretKeyUint8);
        const signature = Array.from(signatureBytes);

        // Update match status to prevent double-claiming
        await supabase
            .from('matches')
            .update({ 
                status: 'completed', 
                winner_wallet: winnerPubkey,
                updated_at: new Date().toISOString()
            })
            .eq('id', matchId);

        return new Response(JSON.stringify({ 
            success: true, 
            signature, 
            matchId, 
            winner: winnerPubkey 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
