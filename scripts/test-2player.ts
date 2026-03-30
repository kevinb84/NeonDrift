import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_INSTRUCTIONS_PUBKEY, Ed25519Program } from '@solana/web3.js';
import * as fs from 'fs';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';
import BN from 'bn.js';

import * as os from 'os';

const idl = JSON.parse(fs.readFileSync('./src/idl/neon_contracts.json', 'utf8'));

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  console.log("Connected to devnet");
  
  const walletJsonPath = os.homedir() + '/.config/solana/id.json';
  if (!fs.existsSync(walletJsonPath)) {
      throw new Error(`Wallet file not found at ${walletJsonPath}. Make sure $HOME is set.`);
  }
  const walletJson = JSON.parse(fs.readFileSync(walletJsonPath, 'utf-8'));
  const playerA = Keypair.fromSecretKey(new Uint8Array(walletJson));
  
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(playerA), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const programId = new PublicKey("ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi");
  // Cast idl to any first to avoid type mismatch
  idl.metadata = idl.metadata || {};
  idl.metadata.address = programId.toBase58();
  const program = new anchor.Program(idl as any, programId, provider);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const config: any = await program.account.programConfig.fetch(configPda);
  console.log("Treasury Address:", config.treasury.toBase58());

  // Player B
  const playerB = Keypair.generate();
  console.log("Player B created:", playerB.publicKey.toBase58());
  
  // Fund Player B from Player A
  console.log("Funding Player B with 0.15 SOL from Player A to cover entry fee + tx fees...");
  const fundTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
          fromPubkey: playerA.publicKey,
          toPubkey: playerB.publicKey,
          lamports: 0.15 * LAMPORTS_PER_SOL,
      })
  );
  await anchor.web3.sendAndConfirmTransaction(connection, fundTx, [playerA]);
  
  // Strip hyphens so the UUID fits into Solana's 32-byte PDA seed limit
  const fullMatchId = crypto.randomUUID();
  const matchId = fullMatchId.replace(/-/g, '').substring(0, 32);
  console.log("\n==============================================");
  console.log("Starting 2-Player Match Flow for Match ID:", matchId);
  console.log("==============================================");

  const entryFeeLamports = new BN(0.1 * LAMPORTS_PER_SOL);
  const maxPlayers = 2;

  const [matchPda] = PublicKey.findProgramAddressSync([Buffer.from("match"), Buffer.from(matchId)], programId);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), matchPda.toBuffer()], programId);

  // 1. Create Match
  console.log("\n1. Creating Match...");
  await program.methods.createMatch(matchId, entryFeeLamports, maxPlayers)
      .accounts({
          matchAccount: matchPda,
          funder: playerA.publicKey,
          systemProgram: SystemProgram.programId,
      })
      .rpc();
  
  // 2. Join Match (Player A)
  console.log("2a. Player A joining (0.1 SOL entry fee)...");
  const [entryPdaA] = PublicKey.findProgramAddressSync([Buffer.from("entry"), matchPda.toBuffer(), playerA.publicKey.toBuffer()], programId);
  await program.methods.joinMatch()
      .accounts({
          matchAccount: matchPda,
          playerEntry: entryPdaA,
          player: playerA.publicKey,
          escrowVault: vaultPda,
          systemProgram: SystemProgram.programId,
      })
      .rpc();

  // 2. Join Match (Player B)
  console.log("2b. Player B joining (0.1 SOL entry fee)...");
  const [entryPdaB] = PublicKey.findProgramAddressSync([Buffer.from("entry"), matchPda.toBuffer(), playerB.publicKey.toBuffer()], programId);
  await program.methods.joinMatch()
      .accounts({
          matchAccount: matchPda,
          playerEntry: entryPdaB,
          player: playerB.publicKey,
          escrowVault: vaultPda,
          systemProgram: SystemProgram.programId,
      })
      .signers([playerB])
      .rpc();

  // Check Escrow Balance
  let escrowBal = await connection.getBalance(vaultPda);
  console.log(`\n✅ Escrow Vault Balance after joins: ${(escrowBal / LAMPORTS_PER_SOL).toFixed(2)} SOL (Expected: 0.2 SOL)`);

  // 3. Lock Match
  console.log("\n3. Locking match to prevent more players from joining...");
  await program.methods.lockMatch()
      .accounts({
          matchAccount: matchPda,
          signer: playerA.publicKey,
      })
      .rpc();

  // Print Balances before payout
  console.log("\n--- BALANCES BEFORE PAYOUT ---");
  const aBefore = await connection.getBalance(playerA.publicKey);
  const bBefore = await connection.getBalance(playerB.publicKey);
  const tBefore = await connection.getBalance(config.treasury);
  console.log(`Player A (Winner): ${aBefore / LAMPORTS_PER_SOL} SOL`);
  console.log(`Player B (Loser):  ${bBefore / LAMPORTS_PER_SOL} SOL`);
  console.log(`Treasury:          ${tBefore / LAMPORTS_PER_SOL} SOL`);
  console.log(`Escrow Vault:      ${escrowBal / LAMPORTS_PER_SOL} SOL`);

  // 4. Distribute Rewards
  console.log("\n4. Oracle simulating result (Player A wins) and distributing rewards...");
  // Load Oracle Keypair
  const oracleKeypairData = JSON.parse(fs.readFileSync('./scripts/oracle-keypair.json', 'utf8'));
  const oracleKeypair = Keypair.fromSecretKey(new Uint8Array(oracleKeypairData));

  // Sign message
  const winnerPubkey = playerA.publicKey;
  const messageBytes = Buffer.concat([
      Buffer.from(matchId, 'utf8'),
      winnerPubkey.toBuffer()
  ]);
  const signature = nacl.sign.detached(messageBytes, oracleKeypair.secretKey);

  const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: oracleKeypair.secretKey,
      message: messageBytes,
  });

  const distributeIx = await program.methods.distributeRewards(matchId, winnerPubkey, Array.from(signature))
      .accounts({
          config: configPda,
          matchAccount: matchPda,
          winner: winnerPubkey,
          treasury: config.treasury,
          escrowVault: vaultPda,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
      })
      .instruction();

  const distributeTx = new anchor.web3.Transaction().add(ed25519Ix, distributeIx);
  const distributeSig = await anchor.web3.sendAndConfirmTransaction(connection, distributeTx, [playerA]);
  console.log("✅ Distribute Transaction Success! Signature:", distributeSig);

  // Print Balances after payout
  console.log("\n--- BALANCES AFTER PAYOUT ---");
  const aAfter = await connection.getBalance(playerA.publicKey);
  const bAfter = await connection.getBalance(playerB.publicKey);
  const tAfter = await connection.getBalance(config.treasury);
  const escrowAfter = await connection.getBalance(vaultPda);
  console.log(`Player A (Winner): ${aAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`Player B (Loser):  ${bAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`Treasury:          ${tAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`Escrow Vault:      ${escrowAfter / LAMPORTS_PER_SOL} SOL`);
  
  console.log(`\n==============================================`);
  console.log(`📈 RESULTS:`);
  console.log(`Player A net gain (payout - tx fees): ${((aAfter - aBefore) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Treasury net gain (fee): ${((tAfter - tBefore) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Player B cannot claim because they lost in state "Completed".`);

  const matchState: any = await program.account.matchAccount.fetch(matchPda);
  console.log(`Final Match State:`, Object.keys(matchState.state)[0]);
  console.log(`==============================================`);
}

main().catch(err => {
  console.error("Error during flow:", err);
});
