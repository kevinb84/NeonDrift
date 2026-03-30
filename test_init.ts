import * as anchor from '@coral-xyz/anchor';
import { IDL } from './src/idl/neon_contracts'; 
import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey("ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi");

const connection = new Connection("https://api.devnet.solana.com");
const wallet = {
    publicKey: new PublicKey("11111111111111111111111111111111"),
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
};

const provider = new anchor.AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' });

try {
    const program = new anchor.Program(IDL as any, PROGRAM_ID, provider);
    console.log("SUCCESS! Program initialized!");
    console.log("Available accounts:", Object.keys(program.account));
} catch (err) {
    console.error("FAIL:", err);
}
