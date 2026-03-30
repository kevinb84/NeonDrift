const fs = require('fs');
let content = fs.readFileSync('./src/idl/neon_contracts.ts', 'utf8');
content = content.replace(/"publicKey"/g, '"pubkey"');
fs.writeFileSync('./src/idl/neon_contracts.ts', content);
