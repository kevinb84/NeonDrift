export class PlatformReserveManager {
    private readonly STORAGE_KEY = 'neon_platform_reserve';
    private totalCollected: number = 0;

    constructor() {
        this.load();
    }

    private load(): void {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.totalCollected = parseFloat(stored);
        }
    }

    private save(): void {
        localStorage.setItem(this.STORAGE_KEY, this.totalCollected.toString());
    }

    addFee(amount: number): void {
        this.totalCollected += amount;
        this.save();
    }

    getTotalCollected(): number {
        return this.totalCollected;
    }
}
