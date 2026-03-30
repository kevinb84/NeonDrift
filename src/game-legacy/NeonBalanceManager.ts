// ============================================================
// NeonBalanceManager — Persistent Neon balance (localStorage)
// ============================================================
//
// Responsibilities:
//   getBalance, setBalance, add, subtract, canAfford
//   Prevents negative balance. Persists across sessions.
//
// Security note: In production, balance should be
// server-verified. This is client-side only for now.
// ============================================================

const STORAGE_KEY = 'neon_balance';
const INITIAL_BALANCE = 100;

export class NeonBalanceManager {
    private balance: number;

    constructor() {
        this.balance = this.load();
    }

    // --- Public API ---

    getBalance(): number {
        return this.balance;
    }

    setBalance(amount: number): void {
        this.balance = Math.max(0, amount);
        this.save();
    }

    add(amount: number): void {
        if (amount <= 0) return;
        this.balance += amount;
        this.save();
    }

    subtract(amount: number): boolean {
        if (amount <= 0) return true;
        if (this.balance < amount) return false; // Prevent negative
        this.balance -= amount;
        this.save();
        return true;
    }

    canAfford(amount: number): boolean {
        return this.balance >= amount;
    }

    reset(): void {
        this.balance = INITIAL_BALANCE;
        this.save();
    }

    // --- Persistence ---

    private load(): number {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored !== null) {
                const val = parseFloat(stored);
                if (!isNaN(val) && val >= 0) return val;
            }
        } catch {
            // localStorage unavailable
        }
        return INITIAL_BALANCE;
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, String(this.balance));
        } catch {
            // Silently fail
        }
    }
}
