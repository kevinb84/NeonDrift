const fs = require('fs');
const idl = require('./neon-contracts/target/idl/neon_contracts.json');

// Deep copy
const newIdl = JSON.parse(JSON.stringify(idl));

// Add address and metadata
newIdl.address = 'ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi';
newIdl.metadata = { name: 'neon_contracts', version: '0.1.0', spec: '0.1.0', description: 'Ranked Racing Smart Contract' };

// The original JSON IDL from Anchor build already has the correct format for v0.29:
// - accounts have { name, type: { kind, fields } }
// - types has MatchState
// We just need to write it as TS with proper types

const tsContent = `export type NeonContracts = ${JSON.stringify(newIdl, null, 2)};

export const IDL: NeonContracts = ${JSON.stringify(newIdl, null, 2)};
`;

fs.writeFileSync('./src/idl/neon_contracts.ts', tsContent);
console.log('IDL file generated successfully');
console.log('Accounts:', newIdl.accounts.map(a => a.name));
console.log('Types:', newIdl.types ? newIdl.types.map(t => t.name) : 'none');
