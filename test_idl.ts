import * as anchor from '@coral-xyz/anchor';
import { IDL } from './src/idl/neon_contracts';

try {
  const coder = new anchor.BorshAccountsCoder(IDL as any);
  console.log('Accounts loaded successfully:', Array.from(coder.accountLayouts.keys()));
} catch (e) {
  console.error('Error:', e);
}
