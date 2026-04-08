import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { insforge } from '../lib/insforge';
import bs58 from 'bs58';

// ─── Network Mode ───────────────────────────────────────────────
// Bags API only works on Solana mainnet.
// When IS_MAINNET = false, all calls return mock data for UI testing.
export const IS_MAINNET = true;

// Use Vite proxy locally to bypass Bags API strict CORS on step 2 and Deno SNI bug
const BAGS_API_BASE = '/bags-api';
const BAGS_API_KEY = import.meta.env.VITE_BAGS_API_KEY || '';

// ─── Types ──────────────────────────────────────────────────────
export interface BlueprintState {
    price: number;
    supply: number;
    marketCap: number;
    curveProgress: number; // 0-1 (how far along the bonding curve)
}

export interface TradeQuote {
    estimatedAmount: number; // tokens received (buy) or SOL received (sell)
    priceImpact: number;     // percentage
    fee: number;             // SOL fee
    totalCost: number;       // total SOL spent (buy) or total tokens spent (sell)
}

export interface BlueprintService {
    getCurveState(tokenAddress: string): Promise<BlueprintState>;
    getTradeQuote(tokenAddress: string, amount: number, action: 'buy' | 'sell'): Promise<TradeQuote>;
    buildBuyTransaction(
        tokenAddress: string,
        buyer: PublicKey,
        amount: number,
        slippage: number
    ): Promise<VersionedTransaction | Transaction>;
    buildSellTransaction(
        tokenAddress: string,
        seller: PublicKey,
        amount: number,
        slippage: number
    ): Promise<VersionedTransaction | Transaction>;
    createToken(
        creator: PublicKey,
        name: string,
        symbol: string,
        image: string,
        description: string,
        socials: { twitter?: string; website?: string; telegram?: string },
        initialBuyLamports: number,
        signAndSend: (tx: VersionedTransaction | Transaction) => Promise<string>
    ): Promise<{ success: boolean; transaction?: string; mint?: string; error?: string }>;
}

// ─── Mock Data Generator ────────────────────────────────────────
const mockState: BlueprintState = {
    price: 0.000001,
    supply: 1_000_000_000,
    marketCap: 1000,
    curveProgress: 0.15,
};

function getMockState(): BlueprintState {
    // Add slight jitter for "liveness" feel
    return {
        ...mockState,
        price: mockState.price + (Math.random() * 0.0000002 - 0.0000001),
        curveProgress: mockState.curveProgress + (Math.random() * 0.005 - 0.0025),
    };
}

function getMockQuote(amount: number, action: 'buy' | 'sell'): TradeQuote {
    const price = mockState.price;
    if (action === 'buy') {
        const solCost = amount * price;
        return {
            estimatedAmount: amount,
            priceImpact: Math.min(amount * 0.00001, 5),
            fee: solCost * 0.01,
            totalCost: solCost + solCost * 0.01,
        };
    } else {
        const solReceived = amount * price * 0.99; // 1% fee
        return {
            estimatedAmount: solReceived,
            priceImpact: Math.min(amount * 0.00001, 5),
            fee: amount * price * 0.01,
            totalCost: amount,
        };
    }
}

// ─── Implementation ─────────────────────────────────────────────
export class BagsBlueprintService implements BlueprintService {

    // ── Curve State ──────────────────────────────────────────────
    async getCurveState(tokenAddress: string): Promise<BlueprintState> {
        if (!IS_MAINNET) return getMockState();

        try {
            const res = await fetch(`${BAGS_API_BASE}/token/${tokenAddress}/state`, {
                headers: { 'x-api-key': BAGS_API_KEY },
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to fetch state');

            const data = json.response;
            return {
                price: data.price || 0,
                supply: data.supply || 0,
                marketCap: data.marketCap || 0,
                curveProgress: data.curveProgress || 0,
            };
        } catch (e) {
            console.warn('[Bags] getCurveState failed, using mock:', e);
            return getMockState();
        }
    }

    // ── Trade Quote ──────────────────────────────────────────────
    async getTradeQuote(tokenAddress: string, amount: number, action: 'buy' | 'sell'): Promise<TradeQuote> {
        if (!IS_MAINNET) return getMockQuote(amount, action);

        try {
            const res = await fetch(`${BAGS_API_BASE}/trade/quote`, {
                method: 'POST',
                headers: {
                    'x-api-key': BAGS_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenMint: tokenAddress,
                    amount,
                    action,
                }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Quote failed');

            return json.response as TradeQuote;
        } catch (e) {
            console.warn('[Bags] getTradeQuote failed, using mock:', e);
            return getMockQuote(amount, action);
        }
    }

    // ── Buy Transaction ──────────────────────────────────────────
    async buildBuyTransaction(
        tokenAddress: string,
        buyer: PublicKey,
        amount: number,
        slippage: number
    ): Promise<VersionedTransaction | Transaction> {
        if (!IS_MAINNET) {
            throw new Error('Token trading is only available on mainnet. Switch to mainnet to trade $NDRIFT.');
        }

        const { data, error } = await insforge.functions.invoke('buy-token', {
            body: {
                tokenAddress,
                amount,
                buyerAddress: buyer.toBase58(),
                slippage
            }
        });

        if (error || !data) throw error || new Error('No data returned');

        const txString = data.transaction || data;
        try {
            const txData = bs58.decode(txString);
            return VersionedTransaction.deserialize(txData);
        } catch {
            return Transaction.from(bs58.decode(txString));
        }
    }

    // ── Sell Transaction ─────────────────────────────────────────
    async buildSellTransaction(
        tokenAddress: string,
        seller: PublicKey,
        amount: number,
        slippage: number
    ): Promise<VersionedTransaction | Transaction> {
        if (!IS_MAINNET) {
            throw new Error('Token trading is only available on mainnet. Switch to mainnet to trade $NDRIFT.');
        }

        const { data, error } = await insforge.functions.invoke('sell-token', {
            body: {
                tokenAddress,
                amount,
                sellerAddress: seller.toBase58(),
                slippage
            }
        });

        if (error || !data) throw error || new Error('No data returned');

        const txString = data.transaction || data;
        try {
            const txData = bs58.decode(txString);
            return VersionedTransaction.deserialize(txData);
        } catch {
            return Transaction.from(bs58.decode(txString));
        }
    }

    // ── Create Token (Bags SDK) ──────────────────────────────────
    // Uses @bagsfm/bags-sdk for full token launch flow:
    //   1. Create metadata → 2. Fee share config → 3. Launch tx → 4. Sign & broadcast
    //
    // MAINNET ONLY — devnet returns a mock result.
    async createToken(
        creator: PublicKey,
        name: string,
        symbol: string,
        image: string,
        description: string,
        socials: { twitter?: string; website?: string; telegram?: string },
        initialBuyLamports: number,
        _signAndSend: (tx: VersionedTransaction | Transaction) => Promise<string>
    ): Promise<{ success: boolean; transaction?: string; mint?: string; error?: string }> {

        if (!IS_MAINNET) {
            console.log(`[CreateToken] DEVNET MOCK — Simulating launch...`);
            console.log(`[CreateToken] Name: ${name}, Symbol: ${symbol}, Creator: ${creator.toBase58()}`);
            await new Promise(r => setTimeout(r, 2000));

            const fakeMint = `MOCK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            console.log(`[CreateToken] ✅ Mock token created: ${fakeMint}`);
            console.log(`[CreateToken] ⚠️ Switch IS_MAINNET=true and set VITE_BAGS_API_KEY for real launch.`);

            return { success: true, mint: fakeMint };
        }

        // ── Direct Browser Execution (Native fetch) ─────────────────────────
        try {
            console.log('[Bags] Starting Token Launch natively in browser...');
            
            if (!BAGS_API_KEY) {
                throw new Error("Missing VITE_BAGS_API_KEY in environment");
            }

            // --- STEP 1: Create Token Info ---
            console.log(`[CreateToken] Step 1: Info for ${name} by ${creator.toBase58()}`);
            
            const formData = new FormData();
            formData.append("name", name);
            formData.append("symbol", symbol.toUpperCase().replace('$', ''));
            formData.append("imageUrl", image);
            formData.append("description", description || `Powered by Neon Drift: ${name}`);
            if(socials?.twitter) formData.append("twitter", socials.twitter);
            if(socials?.website) formData.append("website", socials.website);
            if(socials?.telegram) formData.append("telegram", socials.telegram);

            // Note: Native browser fetch AUTOMATICALLY sets Content-Type boundary
            const step1Response = await fetch(`${BAGS_API_BASE}/token-launch/create-token-info`, {
                method: "POST",
                headers: { "x-api-key": BAGS_API_KEY },
                body: formData,
            });

            if (!step1Response.ok) {
                const errText = await step1Response.text();
                throw new Error(`Step 1 Failed: ${step1Response.status} - ${errText}`);
            }

            const step1Data = await step1Response.json();
            if (!step1Data.success) {
                throw new Error(step1Data.error || `Step 1 Logic Failed`);
            }
            
            const { tokenMint, tokenMetadata } = step1Data.response;

            // --- STEP 2: Fee Share Config ---
            console.log(`[CreateToken] Step 2: Fee config for ${tokenMint}`);
            const feePayload = {
                payer: creator.toBase58(),
                baseMint: tokenMint,
                claimersArray: [creator.toBase58()], 
                basisPointsArray: [10000] // 100% to creator
            };

            const step2Response = await fetch(`${BAGS_API_BASE}/fee-share/config`, {
                method: "POST",
                headers: { "x-api-key": BAGS_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify(feePayload),
            });

            if (!step2Response.ok) {
                const errText = await step2Response.text();
                throw new Error(`Step 2 Failed: ${step2Response.status} - ${errText}`);
            }

            const step2Data = await step2Response.json();
            if (!step2Data.success) {
                throw new Error(step2Data.error || `Step 2 Logic Failed`);
            }
            
            console.log("=== STEP 2 SUCCESS DATA ===", step2Data.response);
            const configTransactions = step2Data.response.transactions || [];
            
            // Bags V2 renamed 'meteoraConfigKey' internally to just 'configKey' or 'publicKey'
            const configKey = step2Data.response.configKey || step2Data.response.meteoraConfigKey || step2Data.response.publicKey;

            // --- STEP 3: Launch Transaction ---
            console.log(`[CreateToken] Step 3: Launch transaction`);
            const launchPayload = {
                tokenMint: tokenMint,
                ipfs: tokenMetadata,
                wallet: creator.toBase58(),
                initialBuyLamports: initialBuyLamports || 0,
                configKey: configKey,
            };

            const step3Response = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
                method: "POST",
                headers: { "x-api-key": BAGS_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify(launchPayload),
            });

            if (!step3Response.ok) {
                const errText = await step3Response.text();
                throw new Error(`Step 3 Failed: ${step3Response.status} - ${errText}`);
            }

            const step3Data = await step3Response.json();
            if (!step3Data.success) {
                throw new Error(step3Data.error || `Step 3 Logic Failed`);
            }
            const launchTx = step3Data.response; 

            // --- STEP 4: SIGN AND SEND ---
            const allTransactions = [...configTransactions, launchTx];
            console.log(`[Bags] Server returned ${allTransactions.length} logic steps. Signing...`);
            
            let lastSignature = '';
            for (const txBase58 of allTransactions) {
                let txToSign;
                try {
                    const txData = bs58.decode(txBase58);
                    txToSign = VersionedTransaction.deserialize(txData);
                } catch {
                    txToSign = Transaction.from(bs58.decode(txBase58));
                }
                lastSignature = await _signAndSend(txToSign);
            }

            console.log('[Bags] 🎉 Token launched! Mint:', tokenMint);
            console.log(`[Bags] View at: https://bags.fm/${tokenMint}`);

            return {
                success: true,
                mint: tokenMint,
                transaction: lastSignature, 
            };
        } catch (error: any) {
            console.error('[Bags] Token launch failed:', error);
            return {
                success: false,
                error: error.message || String(error),
            };
        }
    }
}

export const blueprintService = new BagsBlueprintService();
