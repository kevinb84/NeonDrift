import { NeonBalanceManager } from './NeonBalanceManager';

export interface CarUpgrades {
    engineLevel: number; // 1-5
    tiresLevel: number;  // 1-5
    nitroLevel: number;  // 1-5
}

export type UpgradeType = 'ENGINE' | 'TIRES' | 'NITRO';



const UPGRADE_DATA = {
    ENGINE: {
        costs: [50, 120, 250, 500], // Cost to go to L2, L3, L4, L5
        multipliers: [0, 1.00, 1.05, 1.10, 1.15, 1.22] // Index matches level
    },
    TIRES: {
        costs: [40, 100, 200, 400],
        multipliers: [0, 1.00, 1.10, 1.18, 1.25, 1.35]
    },
    NITRO_DURATION: {
        // Multipliers are actual values in seconds here
        values: [0, 1.5, 2.0, 2.5, 3.0, 3.5]
    },
    NITRO_BOOST: {
        values: [0, 1.3, 1.4, 1.5, 1.6, 1.75]
    },
    NITRO_COSTS: [60, 150, 300, 600]
};

const STORAGE_KEY = 'neon_car_upgrades';

export class UpgradeManager {
    private upgrades: CarUpgrades;
    private balanceManager: NeonBalanceManager;

    constructor(balanceManager: NeonBalanceManager) {
        this.balanceManager = balanceManager;
        this.upgrades = this.loadUpgrades();
    }

    private loadUpgrades(): CarUpgrades {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            engineLevel: 1,
            tiresLevel: 1,
            nitroLevel: 1
        };
    }

    private saveUpgrades(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.upgrades));
    }

    getUpgrades(): CarUpgrades {
        return { ...this.upgrades };
    }

    getUpgradeCost(type: UpgradeType): number | null {
        const level = this.getUpgradeLevel(type);
        if (level >= 5) return null; // Maxed

        // Costs array is 0-indexed: cost[0] is price for Level 2
        // Level 1 -> wants index 0
        // Level 2 -> wants index 1
        const index = level - 1;

        switch (type) {
            case 'ENGINE': return UPGRADE_DATA.ENGINE.costs[index];
            case 'TIRES': return UPGRADE_DATA.TIRES.costs[index];
            case 'NITRO': return UPGRADE_DATA.NITRO_COSTS[index];
        }
    }

    getUpgradeLevel(type: UpgradeType): number {
        switch (type) {
            case 'ENGINE': return this.upgrades.engineLevel;
            case 'TIRES': return this.upgrades.tiresLevel;
            case 'NITRO': return this.upgrades.nitroLevel;
        }
    }

    canAffordUpgrade(type: UpgradeType): boolean {
        const cost = this.getUpgradeCost(type);
        if (cost === null) return false;
        return this.balanceManager.canAfford(cost);
    }

    purchaseUpgrade(type: UpgradeType): boolean {
        const cost = this.getUpgradeCost(type);
        if (cost === null) return false; // Already maxed

        if (this.balanceManager.subtract(cost)) {
            switch (type) {
                case 'ENGINE': this.upgrades.engineLevel++; break;
                case 'TIRES': this.upgrades.tiresLevel++; break;
                case 'NITRO': this.upgrades.nitroLevel++; break;
            }
            this.saveUpgrades();
            return true;
        }
        return false;
    }

    // --- Effect Getters ---

    getEngineMultiplier(): number {
        return UPGRADE_DATA.ENGINE.multipliers[this.upgrades.engineLevel];
    }

    getTiresMultiplier(): number {
        return UPGRADE_DATA.TIRES.multipliers[this.upgrades.tiresLevel];
    }

    getNitroDuration(): number {
        return UPGRADE_DATA.NITRO_DURATION.values[this.upgrades.nitroLevel];
    }

    getNitroBoostMultiplier(): number {
        return UPGRADE_DATA.NITRO_BOOST.values[this.upgrades.nitroLevel];
    }

    // --- Preview Getters (for UI) ---

    getNextLevelPreview(type: UpgradeType): string {
        const lvl = this.getUpgradeLevel(type);
        if (lvl >= 5) return "MAX";

        const nextLvl = lvl + 1;
        switch (type) {
            case 'ENGINE':
                return `Speed: +${Math.round((UPGRADE_DATA.ENGINE.multipliers[nextLvl] - 1) * 100)}%`;
            case 'TIRES':
                return `Grip: +${Math.round((UPGRADE_DATA.TIRES.multipliers[nextLvl] - 1) * 100)}%`;
            case 'NITRO':
                return `${UPGRADE_DATA.NITRO_DURATION.values[nextLvl]}s / ${UPGRADE_DATA.NITRO_BOOST.values[nextLvl]}x`;
        }
        return "";
    }
}
