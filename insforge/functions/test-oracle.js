import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.73.0';

// Note: In production, ORACLE_SECRET_KEY is a base58 encoded string in env vars
// representing the 64-byte Ed25519 secret key. 

async function testOracleSign() {
    console.log("Running Oracle Signing Simulation Test...");

    // 1. Generate a mock Oracle Keypair
    const oracleKeypair = nacl.sign.keyPair();
    const oracleSecretArray = Array.from(oracleKeypair.secretKey);
    const oracleSecretArrayStr = oracleSecretArray.join(',');
    console.log("Mock Oracle Public Key:", new PublicKey(oracleKeypair.publicKey).toBase58());

    // Simulate setting the environment variable in InsForge
    Deno.env.set('ORACLE_SECRET_KEY', oracleSecretArrayStr);

    // 2. Prepare mock request data
    const matchId = "MATCH-123-TEST";
    const winnerPublicKeyString = new PublicKey(nacl.sign.keyPair().publicKey).toBase58();
    console.log("Mock Match ID:", matchId);
    console.log("Mock Winner Public Key:", winnerPublicKeyString);

    const requestPayload = {
        matchId,
        winnerPubkey: winnerPublicKeyString,
        raceInputs: [{ player: "test", finishTime: 120000 }] // Mock data
    };

    // 3. Simulate the HTTP Request to the Deno edge function logic
    console.log("\\n--- Calling Oracle Edge Function Logic ---");

    // Exact logic from oracle-sign.js extracted here for testing
    const ORACLE_SECRET_KEY_ENV = Deno.env.get('ORACLE_SECRET_KEY');

    const { matchId: reqMatchId, winnerPubkey, raceInputs } = requestPayload;

    console.log(`[Oracle] Verifying race ${reqMatchId}. Winner: ${winnerPubkey}`);

    // 2. Oracle Data Preparation
    const matchIdBytes = new TextEncoder().encode(reqMatchId);
    let winnerPublicKey;
    winnerPublicKey = new PublicKey(winnerPubkey);
    const winnerBytes = winnerPublicKey.toBytes();

    // Concat message: [matchId bytes] + [winner pubkey bytes]
    const message = new Uint8Array(matchIdBytes.length + winnerBytes.length);
    message.set(matchIdBytes, 0);
    message.set(winnerBytes, matchIdBytes.length);

    console.log("Message Bytes to Sign (Length):", message.length);

    // 3. Oracle Cryptographic Sign
    let secretKeyArray;
    if (ORACLE_SECRET_KEY_ENV.includes(',')) {
        secretKeyArray = new Uint8Array(ORACLE_SECRET_KEY_ENV.split(',').map(Number));
    } else {
        throw new Error("Expected comma separated Uint8Array string for ORACLE_SECRET_KEY");
    }

    const signature = nacl.sign.detached(message, secretKeyArray);

    console.log("\\n--- Oracle Response Payload ---");
    const responsePayload = {
        success: true,
        matchId: reqMatchId,
        winnerPubkey,
        signature: Array.from(signature)
    };

    console.log(JSON.stringify(responsePayload, null, 2));

    // 4. Verification Step (Simulating what the Smart Contract does)
    console.log("\\n--- Verification Step (Simulating Smart Contract) ---");

    // Reconstruct the message
    const verifyMatchIdBytes = new TextEncoder().encode(responsePayload.matchId);
    const verifyWinnerPublicKey = new PublicKey(responsePayload.winnerPubkey);
    const verifyWinnerBytes = verifyWinnerPublicKey.toBytes();

    const verifyMessage = new Uint8Array(verifyMatchIdBytes.length + verifyWinnerBytes.length);
    verifyMessage.set(verifyMatchIdBytes, 0);
    verifyMessage.set(verifyWinnerBytes, verifyMatchIdBytes.length);

    const signatureUint8Array = new Uint8Array(responsePayload.signature);

    const isSignatureValid = nacl.sign.detached.verify(verifyMessage, signatureUint8Array, oracleKeypair.publicKey);

    if (isSignatureValid) {
        console.log("✅ SUCCESS: Oracle Signature is valid and verifies the Winner Pubkey and Match ID.");
    } else {
        console.log("❌ ERROR: Oracle Signature verification MATCH FAILED.");
    }
}

testOracleSign().catch(console.error);
