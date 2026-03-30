/**
 * Distribute Rewards Oracle Function
 * 
 * This InsForge edge function handles oracle-signed reward distribution.
 * It signs the (matchId + winnerPubkey) message with the oracle keypair,
 * then submits a transaction with Ed25519 verification + distributeRewards.
 * 
 * Environment variables needed:
 *   ORACLE_SECRET_KEY - JSON array of oracle secret key bytes
 *   SOLANA_RPC_URL - Solana RPC endpoint (default: devnet)
 */

export default async function(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { matchId, winnerPubkey } = await req.json();

    if (!matchId || !winnerPubkey) {
      return new Response(
        JSON.stringify({ error: 'Missing matchId or winnerPubkey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import Solana libraries (available in Deno runtime)
    const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY } = await import('npm:@solana/web3.js');
    const anchor = await import('npm:@coral-xyz/anchor@0.29.0');
    const { Buffer } = await import('node:buffer');

    // Load oracle keypair - env var or devnet fallback
    const DEVNET_ORACLE_KEY = [243,187,126,153,151,119,51,205,145,139,202,142,245,99,118,52,9,81,73,15,253,28,98,57,192,79,97,207,185,63,195,148,173,21,20,234,78,100,80,104,185,133,184,159,30,134,89,7,162,173,107,187,39,109,7,79,124,223,165,89,9,0,238,192];
    const oracleSecretKey = JSON.parse(Deno.env.get('ORACLE_SECRET_KEY') || 'null') || DEVNET_ORACLE_KEY;
    const oracleKeypair = Keypair.fromSecretKey(Uint8Array.from(oracleSecretKey));

    // Connect to Solana
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const PROGRAM_ID = new PublicKey(Deno.env.get('PROGRAM_ID') || 'ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi');
    const winnerPubkeyObj = new PublicKey(winnerPubkey);

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

    // Build the message: matchId bytes + winnerPubkey bytes
    const message = Buffer.concat([
      Buffer.from(seedStr),
      winnerPubkeyObj.toBuffer()
    ]);

    // Sign the message with the oracle keypair using ed25519
    const { sign } = await import('npm:tweetnacl');
    const signature = sign.detached(message, oracleKeypair.secretKey);

    // Create Ed25519 instruction (Instruction 0 - verified by the smart contract)
    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: oracleKeypair.secretKey.slice(0, 32),
      message: message,
    });

    // Fetch the config to get the treasury address
    // We need to read the ProgramConfig account manually
    const configAccountInfo = await connection.getAccountInfo(configPubkey);
    if (!configAccountInfo) {
      return new Response(
        JSON.stringify({ error: 'ProgramConfig not found. Call initializeProgram first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse treasury from config account data
    // Layout: 8 (discriminator) + 32 (admin) + 32 (oracle) + 2 (feeBasisPoints) + 32 (treasury)
    const treasuryOffset = 8 + 32 + 32 + 2;
    const treasuryBytes = configAccountInfo.data.slice(treasuryOffset, treasuryOffset + 32);
    const treasuryPubkey = new PublicKey(treasuryBytes);

    // Build the distributeRewards instruction manually
    // Since we're calling from Deno and not a browser, we'll build the transaction manually
    // using Anchor's IDL
    
    // Anchor instruction discriminator for "distributeRewards"
    const { createHash } = await import('node:crypto');
    const discriminator = createHash('sha256')
      .update('global:distribute_rewards')
      .digest()
      .slice(0, 8);

    // Serialize args: matchId (string) + winnerPubkey (pubkey) + signature ([u8; 64])
    // Borsh string: 4-byte length + utf8 bytes
    const matchIdBytes = Buffer.from(seedStr, 'utf8');
    const matchIdLen = Buffer.alloc(4);
    matchIdLen.writeUInt32LE(matchIdBytes.length);

    const instructionData = Buffer.concat([
      discriminator,
      matchIdLen,
      matchIdBytes,
      winnerPubkeyObj.toBuffer(),
      Buffer.from(signature),
    ]);

    const distributeIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPubkey, isSigner: false, isWritable: false },
        { pubkey: matchPubkey, isSigner: false, isWritable: true },
        { pubkey: winnerPubkeyObj, isSigner: false, isWritable: true },
        { pubkey: treasuryPubkey, isSigner: false, isWritable: true },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    // Build and send transaction
    const tx = new Transaction();
    tx.add(ed25519Ix);      // Instruction 0: Ed25519 signature verification
    tx.add(distributeIx);   // Instruction 1: distributeRewards

    // The oracle signs the transaction (it needs SOL for fees!)
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = oracleKeypair.publicKey;

    tx.sign(oracleKeypair);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txSig, 'confirmed');

    console.log('Rewards distributed! TX:', txSig);

    return new Response(
      JSON.stringify({
        success: true,
        signature: txSig,
        matchId: matchId,
        winner: winnerPubkey,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Distribute rewards error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
