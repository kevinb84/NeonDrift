import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { NeonContracts } from "../target/types/neon_contracts";
import { assert } from "chai";
import nacl from "tweetnacl";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Transaction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";

describe("neon-contracts", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.NeonContracts as Program<NeonContracts>;

  const admin = Keypair.generate();
  const oracle = Keypair.generate();
  const player = Keypair.generate();

  const matchId = "race-123";
  const entryFee = new anchor.BN(1_000_000); // 0.001 SOL

  let configPubkey: PublicKey;
  let matchPubkey: PublicKey;
  let entryPubkey: PublicKey;
  let vaultPubkey: PublicKey;

  before(async () => {
    // Airdrop SOL
    const airdropAdmin = await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    const airdropPlayer = await provider.connection.requestAirdrop(player.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    await provider.connection.confirmTransaction(airdropAdmin);
    await provider.connection.confirmTransaction(airdropPlayer);

    [configPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    [matchPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from("match"), Buffer.from(matchId)],
      program.programId
    );

    [entryPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), matchPubkey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    [vaultPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), matchPubkey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the program", async () => {
    await program.methods
      .initializeProgram(500, oracle.publicKey) // 5% fee
      .accounts({
        config: configPubkey,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const config = await program.account.programConfig.fetch(configPubkey);
    assert.ok(config.admin.equals(admin.publicKey));
    assert.ok(config.oracle.equals(oracle.publicKey));
    assert.equal(config.feeBasisPoints, 500);
  });

  it("Creates a match", async () => {
    await program.methods
      .createMatch(matchId, entryFee, 2)
      .accounts({
        matchAccount: matchPubkey,
        funder: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const matchAcc = await program.account.matchAccount.fetch(matchPubkey);
    assert.equal(matchAcc.matchId, matchId);
    assert.ok(matchAcc.entryFee.eq(entryFee));
    assert.equal(matchAcc.playerCount, 0);
  });

  it("Player joins match", async () => {
    await program.methods
      .joinMatch()
      .accounts({
        matchAccount: matchPubkey,
        playerEntry: entryPubkey,
        player: player.publicKey,
        escrowVault: vaultPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const matchAcc = await program.account.matchAccount.fetch(matchPubkey);
    assert.equal(matchAcc.playerCount, 1);
    assert.ok(matchAcc.totalPot.eq(entryFee));

    const vaultBalance = await provider.connection.getBalance(vaultPubkey);
    assert.equal(vaultBalance, entryFee.toNumber());
  });

  it("Locks the match", async () => {
    await program.methods
      .lockMatch()
      .accounts({
        matchAccount: matchPubkey,
        signer: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const matchAcc = await program.account.matchAccount.fetch(matchPubkey);
    assert.deepEqual(matchAcc.state, { locked: {} });
  });

  it("Distributes rewards via Oracle Signature", async () => {
    // 1. Backend creates message: matchId + winner pubkey
    const matchIdBytes = Buffer.from(matchId);
    const winnerBytes = player.publicKey.toBuffer();
    const message = Buffer.concat([matchIdBytes, winnerBytes]);

    // 2. Oracle signs the message
    const signature = nacl.sign.detached(message, oracle.secretKey);

    // 3. Create Ed25519 instruction
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: oracle.publicKey.toBytes(),
      message: message,
      signature: signature,
    });

    // 4. Create distribute rewards instruction
    const distributeIx = await program.methods
      .distributeRewards(matchId, player.publicKey, Array.from(signature))
      .accounts({
        config: configPubkey,
        matchAccount: matchPubkey,
        winner: player.publicKey,
        treasury: admin.publicKey, // default treasury set in init
        escrowVault: vaultPubkey,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // 5. Send transaction with BOTH instructions together
    const tx = new Transaction().add(ed25519Ix).add(distributeIx);

    tx.feePayer = player.publicKey;
    const blockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.sign(player);

    const txSignature = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction(txSignature);

    // Check outputs
    const matchAcc = await program.account.matchAccount.fetch(matchPubkey);
    assert.deepEqual(matchAcc.state, { completed: {} });

    const vaultBalance = await provider.connection.getBalance(vaultPubkey);
    assert.equal(vaultBalance, 0); // Vault completely drained to payout + fee
  });
});
