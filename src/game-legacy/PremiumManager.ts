import { NeonBalanceManager } from './NeonBalanceManager';

export class PremiumManager {
    private static STORAGE_KEY = 'neon_premium_expiry';
    private balanceManager: NeonBalanceManager;
    private expiry: number = 0; // Timestamp

    constructor(balanceManager: NeonBalanceManager) {
        this.balanceManager = balanceManager;
        this.load();
    }

    private load() {
        const raw = localStorage.getItem(PremiumManager.STORAGE_KEY);
        this.expiry = raw ? parseInt(raw, 10) : 0;
    }

    public isActive(): boolean {
        return Date.now() < this.expiry;
    }

    public getTimeRemaining(): string {
        if (!this.isActive()) return 'Expired';
        const diff = this.expiry - Date.now();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
    }

    public purchasePremium(days: number): { success: boolean, message: string } {
        // Cost: 1000 Neon for 7 days (Base rate)
        // Let's say 150 Neon per day roughly? 
        // Plan: 7 Days = 1000 Neon. 30 Days = 3500 Neon.

        let cost = 1000;
        if (days === 30) cost = 3000; // Discount

        if (!this.balanceManager.canAfford(cost)) {
            return { success: false, message: `Insufficient Neon. Need ${cost}.` };
        }

        this.balanceManager.subtract(cost);

        // Extend if already active, else starts now
        const now = Date.now();
        if (this.isActive()) {
            this.expiry += days * 24 * 60 * 60 * 1000;
        } else {
            this.expiry = now + days * 24 * 60 * 60 * 1000;
        }

        localStorage.setItem(PremiumManager.STORAGE_KEY, this.expiry.toString());
        return { success: true, message: `Premium active! Expires in ${this.getTimeRemaining()}` };
    }
}
