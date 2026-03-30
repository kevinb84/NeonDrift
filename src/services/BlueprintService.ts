import { PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';
import { insforge } from '../lib/insforge';
import bs58 from 'bs58';

// ─── Network Mode ───────────────────────────────────────────────
// Bags API only works on Solana mainnet.
// When IS_MAINNET = false, all calls return mock data for UI testing.
export const IS_MAINNET = true;

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
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

        // ── Real Bags SDK Flow (mainnet) ─────────────────────────
        try {
            const { BagsSDK } = await import('@bagsfm/bags-sdk');
            const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
            const sdk = new BagsSDK(BAGS_API_KEY, connection, 'processed');

            // Step 1: Create token metadata
            console.log('[Bags] Step 1: Creating token metadata...');
            const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
                imageUrl: image,
                name,
                description,
                symbol: symbol.toUpperCase().replace('$', ''),
                twitter: socials.twitter,
                website: socials.website,
                telegram: socials.telegram,
            });

            console.log('[Bags] Token mint:', tokenInfo.tokenMint);

            // Step 2: Create fee share config (creator gets 100%)
            console.log('[Bags] Step 2: Creating fee share config...');
            const tokenMint = new PublicKey(tokenInfo.tokenMint);
            const configResult = await sdk.config.createBagsFeeShareConfig({
                payer: creator,
                baseMint: tokenMint,
                feeClaimers: [{ user: creator, userBps: 10000 }], // 100% to creator
            });

            // Sign and send config transactions
            for (const tx of configResult.transactions || []) {
                await _signAndSend(tx);
            }

            // Step 3: Create launch transaction
            console.log('[Bags] Step 3: Creating launch transaction...');
            const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
                metadataUrl: tokenInfo.tokenMetadata,
                tokenMint,
                launchWallet: creator,
                initialBuyLamports: initialBuyLamports,
                configKey: configResult.meteoraConfigKey,
            });

            // Step 4: Sign and broadcast
            console.log('[Bags] Step 4: Signing and broadcasting...');
            const signature = await _signAndSend(launchTx);

            console.log('[Bags] 🎉 Token launched! Mint:', tokenInfo.tokenMint);
            console.log(`[Bags] View at: https://bags.fm/${tokenInfo.tokenMint}`);

            return {
                success: true,
                mint: tokenInfo.tokenMint,
                transaction: signature,
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
