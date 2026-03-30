const anchor = require('@coral-xyz/anchor');
const { IDL } = require('./src/idl/neon_contracts.js'); 
const { Connection, PublicKey } = require('@solana/web3.js');

const connection = new Connection("https://api.devnet.solana.com");
const wallet = {
    publicKey: new PublicKey("11111111111111111111111111111111"),
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
};

const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });

try {
    const program = new anchor.Program(IDL, provider);
    console.log("Program initialized successfully!");
    console.log("Available accounts:", Object.keys(program.account));
} catch (err) {
    console.error("FAIL", err);
}
