// ============================================================
// DifficultyConfig — Structured difficulty tiers + rewards
// ============================================================

export type DifficultyTier = "EASY" | "HARD" | "EXTREME" | "RANKED";

export interface DifficultyConfig {
    entryCost: number;
    aiMaxSpeed: number;
    aiAggression: number;
    rewards: {
        1: number;
        2: number;
        3: number;
    };
}

// --- Tier definitions ---

export const DIFFICULTIES: Record<DifficultyTier, DifficultyConfig> = {
    EASY: {
        entryCost: 10,
        aiMaxSpeed: 280,
        aiAggression: 0.3,
        rewards: { 1: 25, 2: 12, 3: 5 },
    },
    HARD: {
        entryCost: 25,
        aiMaxSpeed: 350,
        aiAggression: 0.6,
        rewards: { 1: 75, 2: 35, 3: 10 },
    },
    EXTREME: {
        entryCost: 50,
        aiMaxSpeed: 420,
        aiAggression: 0.9,
        rewards: { 1: 150, 2: 60, 3: 0 },
    },
    RANKED: {
        entryCost: 0, // Free entry, RP at stake
        aiMaxSpeed: 300, // Dynamic
        aiAggression: 0.5, // Dynamic
        rewards: { 1: 50, 2: 25, 3: 10 }, // Base rewards
    },
};

// --- Display metadata (colors, labels) ---

export interface DifficultyMeta {
    label: string;
    emoji: string;
    color: string;
    glowColor: string;
    description: string;
}

export const DIFFICULTY_META: Record<DifficultyTier, DifficultyMeta> = {
    EASY: {
        label: 'EASY',
        emoji: '🟢',
        color: '#22c55e',
        glowColor: 'rgba(34, 197, 94, 0.3)',
        description: 'Low risk. Good for beginners.',
    },
    HARD: {
        label: 'HARD',
        emoji: '🟡',
        color: '#eab308',
        glowColor: 'rgba(234, 179, 8, 0.3)',
        description: 'Higher risk, higher payout.',
    },
    EXTREME: {
        label: 'EXTREME',
        emoji: '🔴',
        color: '#ef4444',
        glowColor: 'rgba(239, 68, 68, 0.3)',
        description: 'Big risk. Big reward.',
    },
    RANKED: {
        label: 'RANKED',
        emoji: '🏆',
        color: '#a855f7',
        glowColor: 'rgba(126, 34, 206, 0.5)',
        description: 'Compete for RP and glory.',
    },
};

// --- Helpers ---

/** Calculate reward for a position and tier. Returns 0 for 4th+ */
export function calculateReward(position: number, tier: DifficultyTier): number {
    const config = DIFFICULTIES[tier];
    if (position === 1) return config.rewards[1];
    if (position === 2) return config.rewards[2];
    if (position === 3) return config.rewards[3];
    return 0;
}

/** All tier keys in order */
export const TIER_ORDER: DifficultyTier[] = ["EASY", "HARD", "EXTREME"];
