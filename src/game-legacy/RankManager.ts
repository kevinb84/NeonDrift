export type RankTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'NEON';

export interface RankInfo {
    tier: RankTier;
    division: number; // 4, 3, 2, 1? Or just raw RP. Let's keep it simple: Tier based on RP.
    rp: number;
    color: string;
    icon: string; // Emoji
}

const RANK_THRESHOLDS: Record<RankTier, number> = {
    BRONZE: 0,
    SILVER: 500,
    GOLD: 1000,
    PLATINUM: 1500,
    DIAMOND: 2000,
    NEON: 2500
};

const TIER_META: Record<RankTier, { color: string; icon: string }> = {
    BRONZE: { color: '#cd7f32', icon: '🥉' },
    SILVER: { color: '#c0c0c0', icon: '🥈' },
    GOLD: { color: '#ffd700', icon: '🥇' },
    PLATINUM: { color: '#00e5ff', icon: '💠' },
    DIAMOND: { color: '#b9f2ff', icon: '💎' },
    NEON: { color: '#ff00ff', icon: '👑' }
};

const STORAGE_KEY = 'neon_rank_rp';

export class RankManager {
    private currentRP: number = 0;
    private premiumManager?: any;

    constructor(premiumManager?: any) {
        this.premiumManager = premiumManager;
        this.currentRP = this.loadRP();
    }

    getRP(): number {
        return this.currentRP;
    }

    addRP(amount: number): void {
        this.currentRP = Math.max(0, this.currentRP + amount);
        this.saveRP();
    }

    getRankInfo(): RankInfo {
        let tier: RankTier = 'BRONZE';
        if (this.currentRP >= RANK_THRESHOLDS.NEON) tier = 'NEON';
        else if (this.currentRP >= RANK_THRESHOLDS.DIAMOND) tier = 'DIAMOND';
        else if (this.currentRP >= RANK_THRESHOLDS.PLATINUM) tier = 'PLATINUM';
        else if (this.currentRP >= RANK_THRESHOLDS.GOLD) tier = 'GOLD';
        else if (this.currentRP >= RANK_THRESHOLDS.SILVER) tier = 'SILVER';

        return {
            tier,
            division: 1,
            rp: this.currentRP,
            ...TIER_META[tier]
        };
    }

    // ...

    calculateRPChange(finishPosition: number): number {
        // Simple RP distribution
        // 1st: +25
        // 2nd: +10
        // 3rd: -5
        // 4th: -10
        // 5th: -15
        // DNF: -20
        let change = 0;
        switch (finishPosition) {
            case 1: change = 25; break;
            case 2: change = 10; break;
            case 3: change = -5; break;
            case 4: change = -10; break;
            case 5: change = -15; break;
            default: change = -20; break;
        }

        // Apply Premium Bonus (Only on positive gains)
        if (change > 0 && this.premiumManager && this.premiumManager.isActive()) {
            change = Math.floor(change * 1.1); // +10%
        }

        return change;
    }

    processRaceResult(finishPosition: number): { oldRP: number; newRP: number; change: number } {
        const change = this.calculateRPChange(finishPosition);
        const oldRP = this.currentRP;
        this.currentRP = Math.max(0, this.currentRP + change); // No negative RP
        this.saveRP();
        return { oldRP, newRP: this.currentRP, change };
    }

    // Get AI settings based on RP
    getAIDifficultyMultiplier(): number {
        // Base is 1.0 (Intermediate)
        // Bronze: 0.8 - 0.9
        // Silver: 0.9 - 1.0
        // Gold: 1.0 - 1.1
        // Plat: 1.1 - 1.2
        // Diamond: 1.2 - 1.3
        // Neon: 1.3+

        // Linear interpolation: 0 RP = 0.8, 2500 RP = 1.3
        const base = 0.8;
        const max = 1.4;
        const ratio = Math.min(this.currentRP / 2500, 1);
        return base + (max - base) * ratio;
    }

    private loadRP(): number {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            return v ? parseInt(v) : 0;
        } catch { return 0; }
    }

    private saveRP(): void {
        try { localStorage.setItem(STORAGE_KEY, String(this.currentRP)); } catch { }
    }
}
