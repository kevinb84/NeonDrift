"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const os = __importStar(require("os"));
const idl = JSON.parse(fs.readFileSync('./src/idl/neon_contracts.json', 'utf8'));
async function main() {
    const connection = new web3_js_1.Connection("https://api.devnet.solana.com", "confirmed");
    console.log("Connected to devnet");
    const walletJsonPath = os.homedir() + '/.config/solana/id.json';
    if (!fs.existsSync(walletJsonPath)) {
        throw new Error(`Wallet file not found at ${walletJsonPath}. Make sure $HOME is set.`);
    }
    const walletJson = JSON.parse(fs.readFileSync(walletJsonPath, 'utf-8'));
    const playerA = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletJson));
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(playerA), { commitment: "confirmed" });
    anchor.setProvider(provider);
    const programId = new web3_js_1.PublicKey("ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi");
    // Cast idl to any first to avoid type mismatch
    idl.metadata = idl.metadata || {};
    idl.metadata.address = programId.toBase58();
    const program = new anchor.Program(idl, provider);
    // Derive PDAs
    const [configPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
    const config = await program.account.programConfig.fetch(configPda);
    console.log("Treasury Address:", config.treasury.toBase58());
    // Player B
    const playerB = web3_js_1.Keypair.generate();
    console.log("Player B created:", playerB.publicKey.toBase58());
    // Fund Player B from Player A
    console.log("Funding Player B with 0.15 SOL from Player A to cover entry fee + tx fees...");
    const fundTx = new anchor.web3.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: playerA.publicKey,
        toPubkey: playerB.publicKey,
        lamports: 0.15 * web3_js_1.LAMPORTS_PER_SOL,
    }));
    await anchor.web3.sendAndConfirmTransaction(connection, fundTx, [playerA]);
    const matchId = crypto.randomUUID();
    console.log("\n==============================================");
    console.log("Starting 2-Player Match Flow for Match ID:", matchId);
    console.log("==============================================");
    const entryFeeLamports = new anchor.BN(0.1 * web3_js_1.LAMPORTS_PER_SOL);
    const maxPlayers = 2;
    const [matchPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("match"), Buffer.from(matchId)], programId);
    const [vaultPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("vault"), matchPda.toBuffer()], programId);
    // 1. Create Match
    console.log("\n1. Creating Match...");
    await program.methods.createMatch(matchId, entryFeeLamports, maxPlayers)
        .accounts({
        matchAccount: matchPda,
        funder: playerA.publicKey,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    // 2. Join Match (Player A)
    console.log("2a. Player A joining (0.1 SOL entry fee)...");
    const [entryPdaA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("entry"), matchPda.toBuffer(), playerA.publicKey.toBuffer()], programId);
    await program.methods.joinMatch()
        .accounts({
        matchAccount: matchPda,
        playerEntry: entryPdaA,
        player: playerA.publicKey,
        escrowVault: vaultPda,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    // 2. Join Match (Player B)
    console.log("2b. Player B joining (0.1 SOL entry fee)...");
    const [entryPdaB] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("entry"), matchPda.toBuffer(), playerB.publicKey.toBuffer()], programId);
    await program.methods.joinMatch()
        .accounts({
        matchAccount: matchPda,
        playerEntry: entryPdaB,
        player: playerB.publicKey,
        escrowVault: vaultPda,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .signers([playerB])
        .rpc();
    // Check Escrow Balance
    let escrowBal = await connection.getBalance(vaultPda);
    console.log(`\n✅ Escrow Vault Balance after joins: ${(escrowBal / web3_js_1.LAMPORTS_PER_SOL).toFixed(2)} SOL (Expected: 0.2 SOL)`);
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
    console.log(`Player A (Winner): ${aBefore / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Player B (Loser):  ${bBefore / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Treasury:          ${tBefore / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Escrow Vault:      ${escrowBal / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    // 4. Distribute Rewards
    console.log("\n4. Oracle simulating result (Player A wins) and distributing rewards...");
    // Load Oracle Keypair
    const oracleKeypairData = JSON.parse(fs.readFileSync('./scripts/oracle-keypair.json', 'utf8'));
    const oracleKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(oracleKeypairData));
    // Sign message
    const winnerPubkey = playerA.publicKey;
    const messageBytes = Buffer.concat([
        Buffer.from(matchId, 'utf8'),
        winnerPubkey.toBuffer()
    ]);
    const signature = tweetnacl_1.default.sign.detached(messageBytes, oracleKeypair.secretKey);
    const ed25519Ix = web3_js_1.Ed25519Program.createInstructionWithPrivateKey({
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
        instructionSysvar: web3_js_1.SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: web3_js_1.SystemProgram.programId,
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
    console.log(`Player A (Winner): ${aAfter / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Player B (Loser):  ${bAfter / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Treasury:          ${tAfter / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`Escrow Vault:      ${escrowAfter / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    console.log(`\n==============================================`);
    console.log(`📈 RESULTS:`);
    console.log(`Player A net gain (payout - tx fees): ${((aAfter - aBefore) / web3_js_1.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`Treasury net gain (fee): ${((tAfter - tBefore) / web3_js_1.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`Player B cannot claim because they lost in state "Completed".`);
    const matchState = await program.account.matchAccount.fetch(matchPda);
    console.log(`Final Match State:`, Object.keys(matchState.state)[0]);
    console.log(`==============================================`);
}
main().catch(err => {
    console.error("Error during flow:", err);
});
