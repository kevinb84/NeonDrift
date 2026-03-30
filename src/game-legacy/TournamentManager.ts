import { NeonBalanceManager } from './NeonBalanceManager';
import { TRACK_ORDER, TRACKS } from './TrackConfig';
import { DifficultyTier } from './DifficultyConfig';

export type TournamentType = 'DAILY' | 'WEEKLY';
export type TournamentStatus = 'UPCOMING' | 'ACTIVE' | 'FINISHED';

export interface Tournament {
    id: string;
    type: TournamentType;
    name: string;
    entryFee: number;
    prizePool: number;
    participants: string[]; // Participants (Wallet)
    startTime: number; // MS
    endTime: number; // MS
    status: TournamentStatus;

    // Event Settings
    trackId: string;
    difficulty: DifficultyTier;
}

export class TournamentManager {
    private static STORAGE_KEY = 'neon_tournaments';
    private static PLATFORM_BONUS_DAILY = 200;
    private static PLATFORM_BONUS_WEEKLY = 2000;

    static getTournaments(esportsManager?: any): Tournament[] {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        let tournaments: Tournament[] = raw ? JSON.parse(raw) : [];

        // Maintenance: Check if we need new ones
        tournaments = this.maintainTournaments(tournaments, esportsManager);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tournaments));

        return tournaments;
    }

    static enterTournament(tournamentId: string, balanceManager: NeonBalanceManager, wallet: string): { success: boolean, message: string } {
        const tournaments = this.getTournaments();
        const t = tournaments.find(x => x.id === tournamentId);

        if (!t) return { success: false, message: 'Tournament not found' };
        if (t.status !== 'ACTIVE') return { success: false, message: 'Tournament not active' };
        if (t.participants.includes(wallet)) return { success: false, message: 'Already entered' };

        if (!balanceManager.canAfford(t.entryFee)) return { success: false, message: 'Insufficient Neon' };

        // Transaction
        balanceManager.subtract(t.entryFee);
        t.participants.push(wallet);
        t.prizePool += t.entryFee;

        this.save(tournaments);
        return { success: true, message: 'Joined successfully!' };
    }

    private static maintainTournaments(current: Tournament[], esportsManager?: any): Tournament[] {
        const now = Date.now();

        // 1. Check for Ended Tournaments
        current.forEach(t => {
            if (t.status === 'ACTIVE' && now >= t.endTime) {
                t.status = 'FINISHED';
                this.distributePrizes(t);
            }
        });

        // 2. Ensure Active Daily
        const activeDaily = current.find(t => t.type === 'DAILY' && t.status === 'ACTIVE');
        if (!activeDaily) {
            current.push(this.createTournament('DAILY'));
        }

        // 3. Ensure Active Weekly
        const activeWeekly = current.find(t => t.type === 'WEEKLY' && t.status === 'ACTIVE');
        if (!activeWeekly) {
            const newWeekly = this.createTournament('WEEKLY');
            current.push(newWeekly);
            // Generate Bracket immediately for new weekly? 
            // Usually we generate brackets AFTER signups close? 
            // For MVP, lets say Weekly is "Running" and people join, and bracket is for the "Playoffs" at the end?
            // OR: It's a bracket tournament from the start?
            // If from start, we need participants. 
            // Let's assume: Weekly tournament has a "Register" phase, then "Active" phase.
            // For simplicity, we stick to: Active = Running. 
            // We can generate bracket if we have participants.
            // Let's generate bracket if it doesn't exist AND we have participants.
        }

        // 3b. Maintain Weekly Bracket
        if (activeWeekly && esportsManager) {
            // Check if bracket exists
            const bracket = esportsManager.getBracket(activeWeekly.id);
            if (!bracket && activeWeekly.participants.length >= 4) {
                esportsManager.generateBracket(activeWeekly.id, activeWeekly.participants);
            }
            // Auto-sim rounds if needed (e.g. daily updates)
            if (bracket) {
                esportsManager.simulateRound(activeWeekly.id);
            }
        }

        // 4. Simulate Bot Joins (to grow pool)
        current.forEach(t => {
            if (t.status === 'ACTIVE') {
                // Determine expected bots based on elapsed time
                const elapsed = now - t.startTime;
                const duration = t.endTime - t.startTime;
                const progress = elapsed / duration;

                // Target participants: Daily ~50, Weekly ~200
                const target = t.type === 'DAILY' ? 50 : 200;
                const expected = Math.floor(target * progress);

                if (t.participants.length < expected) {
                    const toAdd = expected - t.participants.length;
                    for (let i = 0; i < toAdd; i++) {
                        t.participants.push(`Bot_${Math.floor(Math.random() * 9999)}`);
                        t.prizePool += t.entryFee;
                    }
                }
            }
        });

        return current;
    }

    private static createTournament(type: TournamentType): Tournament {
        const now = Date.now();
        const isDaily = type === 'DAILY';
        const duration = isDaily ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

        // Randomize Track & Difficulty
        const diffs: DifficultyTier[] = ['EASY', 'HARD', 'EXTREME'];
        // Bias towards HARD for tournaments
        const difficulty = diffs[Math.floor(Math.random() * diffs.length)];

        const validTracks = TRACK_ORDER.filter(id => TRACKS[id].availableDifficulties.includes(difficulty));
        const trackId = validTracks.length > 0 ? validTracks[Math.floor(Math.random() * validTracks.length)] : 'neon_city';

        return {
            id: `${type}_${now}`,
            type,
            name: isDaily ? `Daily Sprint` : `Weekly Championship`,
            entryFee: isDaily ? 20 : 100,
            prizePool: isDaily ? this.PLATFORM_BONUS_DAILY : this.PLATFORM_BONUS_WEEKLY,
            participants: [],
            startTime: now,
            endTime: now + duration,
            status: 'ACTIVE',
            trackId,
            difficulty
        };
    }

    private static distributePrizes(t: Tournament): void {
        console.log(`[Tournament] Distributing prizes for ${t.id}. Pool: ${t.prizePool}`);
        // In a real system, we'd pick winners based on Race Results during the window.
        // here, checking race_results from DB or simulating?
        // "Leaderboard for event" implies we track race times for this tournament.
        // For simulation, we'll pick random winners from participants? 
        // Or if the PLAYER entered, we check their best time?
        // Since we don't have a linked Tournament <-> Race system yet,
        // we will simulate: If player is in participants, they have a X% chance to win?
        // Or better: Logic for "Event-specific Leaderboard" implies we need to Query `LeaderboardManager`
        // filtering by time window.

        // For this MVP step: Auto-resolve. 
        // If Player is in list, give them a random rank?
        // TODO: Implement actual prize distribution logic
    }

    private static save(tournaments: Tournament[]) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tournaments));
    }
}
