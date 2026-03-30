/**
 * Oracle Keypair Generator
 * Run this ONCE to generate a new oracle keypair.
 * The private key is saved to oracle-keypair.json (NEVER commit this to git!)
 * The public key is printed so you can use it in initializeProgram.
 */
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const keypair = Keypair.generate();

const keypairPath = path.resolve(__dirname, 'oracle-keypair.json');
fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));

console.log('='.repeat(60));
console.log('Oracle Keypair Generated!');
console.log('='.repeat(60));
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Secret Key saved to:', keypairPath);
console.log('');
console.log('IMPORTANT: Add oracle-keypair.json to .gitignore!');
console.log('='.repeat(60));
