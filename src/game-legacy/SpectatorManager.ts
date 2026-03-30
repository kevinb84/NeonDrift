
import { NeonBalanceManager } from './NeonBalanceManager';

export interface Bet {
    bettorId: string;
    targetCarId: string;
    amount: number;
    timestamp: number;
}

export interface RaceOdds {
    totalPool: number;
    carPools: { [carId: string]: number };
}

const MIN_BET = 10;
const MAX_BET = 1000;
const PLATFORM_FEE = 0.05; // 5% fee

export class SpectatorManager {
    private balanceManager: NeonBalanceManager;
    private currentBets: Bet[] = [];
    private isBettingOpen: boolean = true;
    private pool: { [id: string]: number } = {};
    private participants: string[] = [];

    constructor(balanceManager: NeonBalanceManager) {
        this.balanceManager = balanceManager;
    }

    public initRace(participantIds: string[]) {
        this.participants = participantIds;
        this.currentBets = [];
        this.pool = {};
        this.participants.forEach(id => this.pool[id] = 0);
        this.isBettingOpen = true;
    }

    public closeBetting() {
        this.isBettingOpen = false;
    }

    public placeBet(bettorId: string, targetId: string, amount: number): { success: boolean; message: string } {
        if (!this.isBettingOpen) return { success: false, message: "Betting is closed" };
        if (!this.participants.includes(targetId)) return { success: false, message: "Invalid car ID" };
        if (amount < MIN_BET) return { success: false, message: `Min bet is ${MIN_BET}` };
        if (amount > MAX_BET) return { success: false, message: `Max bet is ${MAX_BET}` };

        if (!this.balanceManager.canAfford(amount)) return { success: false, message: "Insufficient Neon" };

        this.balanceManager.subtract(amount);

        this.currentBets.push({
            bettorId,
            targetCarId: targetId,
            amount,
            timestamp: Date.now()
        });

        if (!this.pool[targetId]) this.pool[targetId] = 0;
        this.pool[targetId] += amount;

        return { success: true, message: `Bet ${amount} on Car ${targetId}` };
    }

    public getPoolStatus(): RaceOdds {
        let total = 0;
        for (const k in this.pool) total += this.pool[k];
        return {
            totalPool: total,
            carPools: { ...this.pool }
        };
    }

    // Calculate payout multiplier for a specific car
    public getMultiplier(carId: string): number {
        let total = 0;
        for (const k in this.pool) total += this.pool[k];

        const carTotal = this.pool[carId] || 0;
        if (carTotal === 0) return 1.0; // Fallback

        // Total Pot * (1 - fee) / Car Pot
        const netPot = total * (1 - PLATFORM_FEE);
        return parseFloat((netPot / carTotal).toFixed(2));
    }

    public resolveRace(winnerId: string): { winnings: number; message: string } {
        this.isBettingOpen = false;

        const myBets = this.currentBets.filter(b => b.targetCarId === winnerId);

        if (myBets.length === 0) {
            return { winnings: 0, message: "No winning bets." };
        }

        const multiplier = this.getMultiplier(winnerId);
        let totalWinnings = 0;

        myBets.forEach(bet => {
            const payout = Math.floor(bet.amount * multiplier);
            totalWinnings += payout;
        });

        if (totalWinnings > 0) {
            this.balanceManager.add(totalWinnings);
            return { winnings: totalWinnings, message: `You won ${totalWinnings} Neon! (x${multiplier})` };
        }

        return { winnings: 0, message: "Bets settled." };
    }
}
