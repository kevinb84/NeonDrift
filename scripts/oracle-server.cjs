/**
 * Local Oracle Script for Distributing Rewards
 * 
 * This runs a tiny Express server on port 3001 that handles
 * oracle-signed reward distribution for testing.
 * 
 * Usage: node scripts/oracle-server.cjs
 * 
 * The frontend calls POST http://localhost:3001/distribute-rewards
 * with { matchId, winnerPubkey }
 */

const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY } = require('@solana/web3.js');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const nacl = require('tweetnacl');

// Load oracle keypair
const keypairPath = path.resolve(__dirname, 'oracle-keypair.json');
const oracleSecretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
const oracleKeypair = Keypair.fromSecretKey(Uint8Array.from(oracleSecretKey));

console.log('Oracle Public Key:', oracleKeypair.publicKey.toBase58());

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || 'ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi');
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');

async function distributeRewards(matchId, winnerPubkeyStr) {
    const winnerPubkey = new PublicKey(winnerPubkeyStr);

    // Derive PDAs
    const seedStr = matchId.replace(/-/g, '').substring(0, 32);
    const [matchPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from('match'), Buffer.from(seedStr)],
        PROGRAM_ID
    );
    const [vaultPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), matchPubkey.toBuffer()],
        PROGRAM_ID
    );
    const [configPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        PROGRAM_ID
    );

    console.log('Match PDA:', matchPubkey.toBase58());
    console.log('Vault PDA:', vaultPubkey.toBase58());
    console.log('Config PDA:', configPubkey.toBase58());

    // Build the message: matchId bytes + winnerPubkey bytes
    const message = Buffer.concat([
        Buffer.from(seedStr),
        winnerPubkey.toBuffer()
    ]);

    // Sign the message with oracle keypair
    const signature = nacl.sign.detached(message, oracleKeypair.secretKey);
    console.log('Oracle signature created, length:', signature.length);

    // Create Ed25519 instruction
    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
        privateKey: oracleKeypair.secretKey,
        message: message,
    });

    // Fetch config to get treasury
    const configAccountInfo = await connection.getAccountInfo(configPubkey);
    if (!configAccountInfo) {
        throw new Error('ProgramConfig not found. Call initializeProgram first.');
    }

    // Parse treasury: 8 (disc) + 32 (admin) + 32 (oracle) + 2 (feeBasisPoints) + 32 (treasury)
    const treasuryOffset = 8 + 32 + 32 + 2;
    const treasuryBytes = configAccountInfo.data.slice(treasuryOffset, treasuryOffset + 32);
    const treasuryPubkey = new PublicKey(treasuryBytes);
    console.log('Treasury:', treasuryPubkey.toBase58());

    // Build distributeRewards instruction
    const discriminator = createHash('sha256')
        .update('global:distribute_rewards')
        .digest()
        .slice(0, 8);

    const matchIdBytes = Buffer.from(seedStr, 'utf8');
    const matchIdLen = Buffer.alloc(4);
    matchIdLen.writeUInt32LE(matchIdBytes.length);

    const instructionData = Buffer.concat([
        discriminator,
        matchIdLen,
        matchIdBytes,
        winnerPubkey.toBuffer(),
        Buffer.from(signature),
    ]);

    const distributeIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: configPubkey, isSigner: false, isWritable: false },
            { pubkey: matchPubkey, isSigner: false, isWritable: true },
            { pubkey: winnerPubkey, isSigner: false, isWritable: true },
            { pubkey: treasuryPubkey, isSigner: false, isWritable: true },
            { pubkey: vaultPubkey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
    });

    // Build and send transaction
    const tx = new Transaction();
    tx.add(ed25519Ix);
    tx.add(distributeIx);

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = oracleKeypair.publicKey;

    tx.sign(oracleKeypair);

    console.log('Sending transaction...');
    const txSig = await connection.sendRawTransaction(tx.serialize());
    console.log('TX sent:', txSig);
    
    await connection.confirmTransaction(txSig, 'confirmed');
    console.log('TX confirmed!');

    return txSig;
}

// HTTP Server & Multiplayer Sync
const { WebSocketServer } = require('ws');

const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    } else if (req.method === 'POST' && req.url === '/wallet-auth') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { publicKey, signature, message } = JSON.parse(body);
                
                if (!publicKey || !signature || !message) {
                    throw new Error('Missing parameters');
                }

                // Verify signature natively in Node
                const bs58Module = require('bs58');
                const bs58 = bs58Module.default || bs58Module;
                const sigUint8 = bs58.decode(signature);
                const msgUint8 = new TextEncoder().encode(message);
                const pubUint8 = bs58.decode(publicKey);

                if (!nacl.sign.detached.verify(msgUint8, sigUint8, pubUint8)) {
                    throw new Error('Invalid signature');
                }

                const crypto = require('crypto');
                require('dotenv').config();
                
                // We'll use VITE_BAGS_API_KEY as our private secure server salt for HMAC
                const API_KEY = process.env.VITE_BAGS_API_KEY || 'local-fallback-salt';

                const email = `${publicKey}@neon.local`;
                
                // Deterministic secure password using HMAC
                const hmac = crypto.createHmac('sha256', API_KEY);
                hmac.update(publicKey);
                const securePassword = hmac.digest('hex') + "A!1a";

                // We don't call admin create user here anymore (since we don't have a Service Role Key).
                // We just securely return the deterministically salted password back to the frontend
                // which successfully mathematically binds the wallet signature to this specific password!
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, email, password: securePassword }));
            } catch (err) {
                console.error('Wallet Auth Error:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/distribute-rewards') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { matchId, winnerPubkey } = JSON.parse(body);
                console.log(`\n=== Distribute Rewards ===`);
                console.log(`Match: ${matchId}`);
                console.log(`Winner: ${winnerPubkey}`);

                const txSig = await distributeRewards(matchId, winnerPubkey);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    signature: txSig,
                    matchId,
                    winner: winnerPubkey,
                }));
            } catch (err) {
                console.error('Error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/sign-reward') {
        // Return the signature, so frontend can send the transaction!
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { matchId, winnerPubkey } = JSON.parse(body);
                console.log(`\n=== Sign Reward (Frontend Mode) ===`);
                console.log(`Match: ${matchId}`);
                console.log(`Winner: ${winnerPubkey}`);

                // --- SECURITY CHECK: Validate match state via InsForge REST API ---
                require('dotenv').config();
                const INSFORGE_BASE_URL = process.env.VITE_INSFORGE_BASE_URL;
                const ANON_KEY = process.env.VITE_INSFORGE_ANON_KEY;
                
                if (INSFORGE_BASE_URL && ANON_KEY) {
                    console.log(`Validating match state on Supabase...`);
                    const dbRes = await fetch(`${INSFORGE_BASE_URL}/rest/v1/matches?id=eq.${matchId}&select=*`, {
                        headers: {
                            'apikey': ANON_KEY,
                            'Authorization': `Bearer ${ANON_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!dbRes.ok) throw new Error('Failed to query match from database');
                    const matches = await dbRes.json();
                    
                    if (!matches || matches.length === 0) {
                        throw new Error('Match does not exist in database.');
                    }
                    
                    const match = matches[0];
                    if (match.status === 'completed' || match.status === 'cancelled') {
                        throw new Error(`Match is already ${match.status}. Cannot issue new signature!`);
                    }

                    // For extra security, check if winnerPubkey is match.player1 or match.player2
                    if (match.player1 !== winnerPubkey && match.player2 !== winnerPubkey) {
                         throw new Error(`Winner ${winnerPubkey} is not a registered player in this match!`);
                    }
                    // ----------------------------------------------------------------

                    // Mark match as completed securely via REST (optional but recommended!)
                    await fetch(`${INSFORGE_BASE_URL}/rest/v1/matches?id=eq.${matchId}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': ANON_KEY,
                            'Authorization': `Bearer ${ANON_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 'completed', winner: winnerPubkey })
                    });
                } else {
                    console.warn(`[WARNING] Skipping DB validation. VITE_INSFORGE_BASE_URL or VITE_INSFORGE_ANON_KEY not set!`);
                }

                const winnerKey = new PublicKey(winnerPubkey);
                const seedStr = matchId.replace(/-/g, '').substring(0, 32);
                
                // Build the message: matchId bytes + winnerPubkey bytes
                const message = Buffer.concat([
                    Buffer.from(seedStr),
                    winnerKey.toBuffer()
                ]);

                // Sign the message with oracle keypair
                const signatureBytes = nacl.sign.detached(message, oracleKeypair.secretKey);
                // Convert signature to Array of numbers so JSON.stringify can send it easily
                const signature = Array.from(signatureBytes);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    signature: signature,
                    matchId,
                    winner: winnerPubkey,
                }));
            } catch (err) {
                console.error('Error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'Oracle & Multiplayer Sync Server running',
            oracle: oracleKeypair.publicKey.toBase58(),
            endpoint: 'POST /distribute-rewards or POST /sign-reward. WS /sync',
        }));
    }
});

// ─── Multiplayer WebSocket Relay ───
const wss = new WebSocketServer({ server });

// Room state: matchId -> Set of WebSockets
const rooms = new Map();

wss.on('connection', (ws, req) => {
    // Parse URL to find the match ID
    // Client connects like: ws://localhost:3001/?matchId=...
    const url = new URL(req.url, 'http://localhost');
    const matchId = url.searchParams.get('matchId');

    if (!matchId) {
        ws.close();
        return;
    }

    console.log(`[WS] Client joined match ${matchId}`);

    if (!rooms.has(matchId)) {
        rooms.set(matchId, new Set());
    }
    rooms.get(matchId).add(ws);

    ws.on('message', (data) => {
        // Broadcast the message to EVERY OTHER client in the same room
        const room = rooms.get(matchId);
        if (!room) return;

        for (const client of room) {
            if (client !== ws && client.readyState === 1 /* OPEN */) {
                client.send(data, { binary: false });
            }
        }
    });

    ws.on('close', () => {
        console.log(`[WS] Client disconnected from ${matchId}`);
        const room = rooms.get(matchId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) {
                rooms.delete(matchId); // cleanup empty rooms
            }
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n🔮 Oracle Server running at http://localhost:${PORT}`);
    console.log(`   POST /sign-reward         { matchId, winnerPubkey }`);
    console.log(`   WS   /?matchId=123        (Multiplayer realtime sync)`);
    console.log(`   Oracle: ${oracleKeypair.publicKey.toBase58()}`);
    console.log(`   Program: ${PROGRAM_ID.toBase58()}`);
    console.log(`   RPC: ${RPC_URL}\n`);
});
