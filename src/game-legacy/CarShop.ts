// ============================================================
// CarShop — Car customization with Neon-based unlocks
// ============================================================
//
// Paint jobs: Colors purchasable with Neon
// Each has a name, base body color, accent, stripe, unlock cost
// Ownership persisted in localStorage
//
// Default car is free ("Stock Neon")
// ============================================================

export interface CarPaint {
    id: string;
    name: string;
    emoji: string;
    bodyColor: string;         // Main body
    accentColor: string;       // Fenders, wing
    stripeColor: string;       // Racing stripe
    windowTint: string;        // Window color
    unlockCost: number;        // Neon cost (0 = free)
    description: string;
}

// ========== Paint Catalog ==========

export const CAR_PAINTS: CarPaint[] = [
    {
        id: 'stock_neon',
        name: 'Stock Neon',
        emoji: '🔵',
        bodyColor: '#2266cc',
        accentColor: '#1a4a99',
        stripeColor: '#00e5ff',
        windowTint: 'rgba(0,180,255,0.4)',
        unlockCost: 0,
        description: 'Default racer. Clean and classic.',
    },
    {
        id: 'crimson_fury',
        name: 'Crimson Fury',
        emoji: '🔴',
        bodyColor: '#cc2233',
        accentColor: '#991a2a',
        stripeColor: '#ff6644',
        windowTint: 'rgba(255,60,60,0.35)',
        unlockCost: 30,
        description: 'Fire-red speed machine.',
    },
    {
        id: 'emerald_drift',
        name: 'Emerald Drift',
        emoji: '🟢',
        bodyColor: '#22aa44',
        accentColor: '#188833',
        stripeColor: '#66ff88',
        windowTint: 'rgba(0,200,100,0.35)',
        unlockCost: 30,
        description: 'Green and mean.',
    },
    {
        id: 'golden_apex',
        name: 'Golden Apex',
        emoji: '🟡',
        bodyColor: '#cc9922',
        accentColor: '#aa7711',
        stripeColor: '#ffdd44',
        windowTint: 'rgba(255,200,50,0.3)',
        unlockCost: 50,
        description: 'Luxury gold finish.',
    },
    {
        id: 'phantom_black',
        name: 'Phantom Black',
        emoji: '⚫',
        bodyColor: '#1a1a1a',
        accentColor: '#0d0d0d',
        stripeColor: '#444444',
        windowTint: 'rgba(30,30,30,0.6)',
        unlockCost: 50,
        description: 'Stealth mode activated.',
    },
    {
        id: 'arctic_white',
        name: 'Arctic White',
        emoji: '⚪',
        bodyColor: '#e8e8e8',
        accentColor: '#cccccc',
        stripeColor: '#ffffff',
        windowTint: 'rgba(200,220,255,0.35)',
        unlockCost: 50,
        description: 'Clean white perfection.',
    },
    {
        id: 'neon_purple',
        name: 'Neon Purple',
        emoji: '🟣',
        bodyColor: '#7722cc',
        accentColor: '#5511aa',
        stripeColor: '#bb66ff',
        windowTint: 'rgba(150,50,255,0.35)',
        unlockCost: 75,
        description: 'Ultraviolet glow.',
    },
    {
        id: 'solar_orange',
        name: 'Solar Orange',
        emoji: '🟠',
        bodyColor: '#ee6600',
        accentColor: '#cc5500',
        stripeColor: '#ffaa33',
        windowTint: 'rgba(255,150,30,0.3)',
        unlockCost: 75,
        description: 'Sunset on wheels.',
    },
    {
        id: 'chrome_shift',
        name: 'Chrome Shift',
        emoji: '💎',
        bodyColor: '#8899aa',
        accentColor: '#667788',
        stripeColor: '#00e5ff',
        windowTint: 'rgba(100,200,255,0.4)',
        unlockCost: 150,
        description: 'Legendary chrome finish.',
    },
    {
        id: 'inferno_gradient',
        name: 'Inferno',
        emoji: '🔥',
        bodyColor: '#ff3300',
        accentColor: '#cc2200',
        stripeColor: '#ffcc00',
        windowTint: 'rgba(255,100,0,0.35)',
        unlockCost: 200,
        description: 'Rare fire gradient. Win streaks.',
    },
];

// ========== Trail Catalog ==========

export interface TrailStyle {
    id: string; // 'none', 'flux', 'fire', 'sparkle'
    name: string;
    emoji: string;
    color: string;
    unlockCost: number;
    description: string;
}

export const CAR_TRAILS: TrailStyle[] = [
    {
        id: 'none',
        name: 'No Trail',
        emoji: '🚫',
        color: '#000000',
        unlockCost: 0,
        description: 'Clean run. No distractions.',
    },
    {
        id: 'neon_flux',
        name: 'Neon Flux',
        emoji: '💠',
        color: '#00e5ff',
        unlockCost: 500,
        description: 'Leave a trace of pure energy.',
    },
    {
        id: 'solar_flare',
        name: 'Solar Flare',
        emoji: '🔥',
        color: '#ff4400',
        unlockCost: 1200,
        description: 'Scorching hot plasma trail.',
    },
    {
        id: 'quantum_spark',
        name: 'Quantum Spark',
        emoji: '✨',
        color: '#ffd700',
        unlockCost: 3000,
        description: 'Gold sparkles from the void.',
    },
    {
        id: 'matrix_glitch',
        name: 'The Glitch',
        emoji: '👾',
        color: '#00ff00',
        unlockCost: 5000,
        description: 'Reality is breaking down.',
    }
];

// ========== Garage Manager ==========

const GARAGE_STORAGE_KEY = 'neon_garage';
const EQUIPPED_STORAGE_KEY = 'neon_equipped_car';

export class GarageManager {
    private owned: Set<string>;
    private equippedId: string;
    private ownedTrails: Set<string>;
    private equippedTrailId: string;

    constructor() {
        this.owned = this.loadOwned();
        this.equippedId = this.loadEquipped();
        this.ownedTrails = this.loadOwnedTrails();
        this.equippedTrailId = this.loadEquippedTrail();

        // Ensure defaults are always owned
        this.owned.add('stock_neon');
        this.ownedTrails.add('none');
    }

    // --- Queries ---

    isOwned(paintId: string): boolean {
        return this.owned.has(paintId);
    }

    isTrailOwned(trailId: string): boolean {
        return this.ownedTrails.has(trailId);
    }

    getEquipped(): CarPaint {
        return CAR_PAINTS.find(p => p.id === this.equippedId) || CAR_PAINTS[0];
    }

    getEquippedId(): string {
        return this.equippedId;
    }

    getEquippedTrail(): TrailStyle {
        return CAR_TRAILS.find(t => t.id === this.equippedTrailId) || CAR_TRAILS[0];
    }

    getEquippedTrailId(): string {
        return this.equippedTrailId;
    }

    getOwnedPaints(): CarPaint[] {
        return CAR_PAINTS.filter(p => this.owned.has(p.id));
    }

    getOwnedTrails(): TrailStyle[] {
        return CAR_TRAILS.filter(t => this.ownedTrails.has(t.id));
    }

    // --- Actions ---

    /** Purchase a paint. Returns true if successful. */
    purchase(paintId: string, deductFn: (cost: number) => boolean): boolean {
        if (this.owned.has(paintId)) return false;
        const paint = CAR_PAINTS.find(p => p.id === paintId);
        if (!paint) return false;
        if (!deductFn(paint.unlockCost)) return false;

        this.owned.add(paintId);
        this.saveOwned();
        return true;
    }

    equip(paintId: string): boolean {
        if (!this.owned.has(paintId)) return false;
        this.equippedId = paintId;
        this.saveEquipped();
        return true;
    }

    purchaseTrail(trailId: string, deductFn: (cost: number) => boolean): boolean {
        if (this.ownedTrails.has(trailId)) return false;
        const trail = CAR_TRAILS.find(t => t.id === trailId);
        if (!trail) return false;
        if (!deductFn(trail.unlockCost)) return false;

        this.ownedTrails.add(trailId);
        this.saveOwnedTrails();
        return true;
    }

    equipTrail(trailId: string): boolean {
        if (!this.ownedTrails.has(trailId)) return false;
        this.equippedTrailId = trailId;
        this.saveEquippedTrail();
        return true;
    }

    // --- Persistence ---

    private loadOwned(): Set<string> {
        try {
            const raw = localStorage.getItem(GARAGE_STORAGE_KEY);
            if (raw) return new Set(JSON.parse(raw));
        } catch { /* */ }
        return new Set(['stock_neon']);
    }

    private saveOwned(): void {
        try { localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify([...this.owned])); } catch { /* */ }
    }

    private loadEquipped(): string {
        try {
            const v = localStorage.getItem(EQUIPPED_STORAGE_KEY);
            if (v) return v;
        } catch { /* */ }
        return 'stock_neon';
    }

    private saveEquipped(): void {
        try { localStorage.setItem(EQUIPPED_STORAGE_KEY, this.equippedId); } catch { /* */ }
    }

    private loadOwnedTrails(): Set<string> {
        try {
            const raw = localStorage.getItem('neon_owned_trails');
            if (raw) return new Set(JSON.parse(raw));
        } catch { /* */ }
        return new Set(['none']);
    }

    private saveOwnedTrails(): void {
        try { localStorage.setItem('neon_owned_trails', JSON.stringify([...this.ownedTrails])); } catch { /* */ }
    }

    private loadEquippedTrail(): string {
        try { return localStorage.getItem('neon_equipped_trail') || 'none'; } catch { return 'none'; }
    }

    private saveEquippedTrail(): void {
        try { localStorage.setItem('neon_equipped_trail', this.equippedTrailId); } catch { /* */ }
    }
}
