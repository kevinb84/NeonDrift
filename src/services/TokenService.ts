import { IS_MAINNET } from './BlueprintService';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const BAGS_API_KEY = import.meta.env.VITE_BAGS_API_KEY || '';

// ─── Types ──────────────────────────────────────────────────────
export interface BagsToken {
    name: string;
    symbol: string;
    description: string;
    image: string;
    tokenMint: string;
    status: 'PRE_LAUNCH' | 'LAUNCHED' | 'GRADUATED';
    twitter?: string;
    website?: string;
}

export interface TokenPrice {
    price: number;
    marketCap: number;
    supply: number;
    curveProgress: number;
}

// ─── Mock Token Data ────────────────────────────────────────────
const MOCK_TOKENS: BagsToken[] = [
    {
        name: 'Neon Drift',
        symbol: 'NDRIFT',
        description: 'The in-game token for NeonDrift racing.',
        image: '',
        tokenMint: 'NDRIFTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
        twitter: 'https://x.com/NeonDrift',
        website: 'https://neondrift.gg',
    },
    {
        name: 'SolPunk',
        symbol: 'SPUNK',
        description: 'Community-driven cyberpunk memes on Solana.',
        image: '',
        tokenMint: 'SPUNKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
    {
        name: 'NeonCat',
        symbol: 'NCAT',
        description: 'The first neon cat on the blockchain.',
        image: '',
        tokenMint: 'NCATxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
    {
        name: 'DriftKing',
        symbol: 'DKING',
        description: 'Racing governance token. Vote on tracks and rules.',
        image: '',
        tokenMint: 'DKINGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
    {
        name: 'GridRunner',
        symbol: 'GRID',
        description: 'Virtual world exploration token.',
        image: '',
        tokenMint: 'GRIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
    {
        name: 'Nitro Fuel',
        symbol: 'NITRO',
        description: 'Burn NITRO for in-game speed boosts.',
        image: '',
        tokenMint: 'NITROxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
    {
        name: 'CyberDAO',
        symbol: 'CYBER',
        description: 'Decentralized autonomous organization for gamers.',
        image: '',
        tokenMint: 'CYBERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'PRE_LAUNCH',
    },
    {
        name: 'WarpSpeed',
        symbol: 'WARP',
        description: 'Instant cross-chain swaps at warp speed.',
        image: '',
        tokenMint: 'WARPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        status: 'LAUNCHED',
    },
];

function getMockPrice(tokenMint: string): TokenPrice {
    // Generate deterministic-ish mock data from mint
    const seed = tokenMint.charCodeAt(0) + tokenMint.charCodeAt(1);
    const base = (seed % 100) / 100000;
    return {
        price: base + Math.random() * base * 0.1,
        marketCap: Math.floor(500 + seed * 50 + Math.random() * 1000),
        supply: 1_000_000_000,
        curveProgress: Math.min(0.05 + (seed % 80) / 100, 0.95),
    };
}

// ─── Service ────────────────────────────────────────────────────
export class TokenService {

    /** Fetch trending / recent tokens from Bags feed */
    async getTokenFeed(): Promise<BagsToken[]> {
        if (!IS_MAINNET) return MOCK_TOKENS;

        try {
            const res = await fetch(`${BAGS_API_BASE}/token-launch/feed`, {
                headers: { 'x-api-key': BAGS_API_KEY },
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json.response as BagsToken[];
        } catch (e) {
            console.warn('[TokenService] Feed fetch failed:', e);
            return []; 
        }
    }

    /** Search tokens by name/symbol (client-side filter for now) */
    async searchTokens(query: string): Promise<BagsToken[]> {
        const feed = await this.getTokenFeed();
        if (!query.trim()) return feed;

        const q = query.toLowerCase();
        return feed.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.tokenMint.toLowerCase().includes(q)
        );
    }

    /** Get price data for a specific token */
    async getTokenPrice(tokenMint: string): Promise<TokenPrice> {
        if (!IS_MAINNET) return getMockPrice(tokenMint);

        try {
            const res = await fetch(`${BAGS_API_BASE}/token/${tokenMint}/state`, {
                headers: { 'x-api-key': BAGS_API_KEY },
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json.response as TokenPrice;
        } catch (e) {
            console.warn('[TokenService] Price fetch failed:', e);
            throw e; 
        }
    }
}

export const tokenService = new TokenService();
