import { insforge } from '../lib/insforge';
// Cast to any to avoid TS error with missing 'from' property in current binding
const db = insforge as any;

export interface RaceResult {
    wallet_address: string;
    track_id: string;
    difficulty: string;
    time_ms: number;
    created_at?: string;
}

export class LeaderboardManager {
    static async submitScore(wallet: string, track: string, diff: string, time: number): Promise<void> {
        try {
            const { error } = await db
                .from('race_results')
                .insert([
                    {
                        wallet_address: wallet,
                        track_id: track,
                        difficulty: diff,
                        time_ms: Math.floor(time) // Ensure integer
                    }
                ]);

            if (error) {
                console.error('Error submitting score:', error);
            }
        } catch (e) {
            console.error('Failed to submit score:', e);
        }
    }

    static async getTopScores(track: string, diff: string, limit: number = 10): Promise<RaceResult[]> {
        try {
            const { data, error } = await db
                .from('race_results')
                .select('*')
                .eq('track_id', track)
                .eq('difficulty', diff)
                .order('time_ms', { ascending: true })
                .limit(limit);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return [];
            }

            return data as RaceResult[];
        } catch (e) {
            console.error('Failed to fetch leaderboard:', e);
            return [];
        }
    }

    static async getTournamentWinners(track: string, diff: string, start: number, end: number, limit: number = 3): Promise<RaceResult[]> {
        try {
            const startISO = new Date(start).toISOString();
            const endISO = new Date(end).toISOString();

            const { data, error } = await db
                .from('race_results')
                .select('*')
                .eq('track_id', track)
                .eq('difficulty', diff)
                .gte('created_at', startISO)
                .lte('created_at', endISO)
                .order('time_ms', { ascending: true })
                .limit(limit);

            if (error) {
                console.error('Error fetching tournament winners:', error);
                return [];
            }
            return data as RaceResult[];
        } catch (e) {
            console.error('Failed to fetch tournament winners:', e);
            return [];
        }
    }

    // ==============================================================================
    // NEW: Global Stats Leaderboard (Simulated with localStorage for now)
    // ==============================================================================

    static updatePlayerStats(stats: PlayerStats): void {
        const key = 'neon_player_stats';
        const raw = localStorage.getItem(key);
        let allStats: PlayerStats[] = raw ? JSON.parse(raw) : [];

        // Update or insert
        const idx = allStats.findIndex(p => p.playerId === stats.playerId);
        if (idx >= 0) {
            allStats[idx] = stats;
        } else {
            allStats.push(stats);
        }
        localStorage.setItem(key, JSON.stringify(allStats));
    }

    static recordRaceCompletion(playerId: string, isWin: boolean, neon: number, rp: number, seasonId: number): void {
        const key = 'neon_player_stats';
        const raw = localStorage.getItem(key);
        let allStats: PlayerStats[] = raw ? JSON.parse(raw) : [];
        let player = allStats.find(p => p.playerId === playerId);

        if (!player) {
            player = {
                playerId,
                neonBalance: neon,
                rankPoints: rp,
                wins: 0,
                losses: 0,
                totalRaces: 0,
                seasonId: seasonId
            };
            allStats.push(player);
        }

        player.neonBalance = neon;
        player.rankPoints = rp;
        player.totalRaces++;
        if (isWin) player.wins++;
        else player.losses++;
        player.seasonId = seasonId; // Update season ID if changed

        // Mock Data Seeding (if empty)
        if (allStats.length === 1) {
            allStats = allStats.concat(this.generateMockPlayers(15));
        }

        localStorage.setItem(key, JSON.stringify(allStats));
    }

    static getTopNeonHolders(limit = 100): PlayerStats[] {
        const all = this.getAllStats();
        return all.sort((a, b) => b.neonBalance - a.neonBalance).slice(0, limit);
    }

    static getTopRankedPlayers(limit = 100): PlayerStats[] {
        const all = this.getAllStats();
        return all.sort((a, b) => b.rankPoints - a.rankPoints).slice(0, limit);
    }

    static getTopWinRatePlayers(limit = 100): PlayerStats[] {
        const all = this.getAllStats();
        return all.sort((a, b) => {
            const rateA = a.totalRaces > 0 ? a.wins / a.totalRaces : 0;
            const rateB = b.totalRaces > 0 ? b.wins / b.totalRaces : 0;
            return rateB - rateA;
        }).slice(0, limit);
    }

    static resetForNewSeason(newSeasonId: number): void {
        const all = this.getAllStats();

        // Reset Logic
        all.forEach(p => {
            p.rankPoints = 1000; // Reset to base
            p.wins = 0;          // Reset seasonal stats
            p.losses = 0;
            p.totalRaces = 0;
            p.seasonId = newSeasonId;
        });

        localStorage.setItem('neon_player_stats', JSON.stringify(all));
    }

    private static getAllStats(): PlayerStats[] {
        const raw = localStorage.getItem('neon_player_stats');
        return raw ? JSON.parse(raw) : [];
    }

    private static generateMockPlayers(count: number): PlayerStats[] {
        const mocks: PlayerStats[] = [];
        const names = ['SpeedDemon', 'NeonDrifter', 'CyberRacer', 'FluxMaster', 'DriftKing', 'TurboCharger', 'Velocity', 'ApexPredator', 'RedLine', 'Overdrive'];

        for (let i = 0; i < count; i++) {
            const wins = Math.floor(Math.random() * 50);
            const losses = Math.floor(Math.random() * 50);
            mocks.push({
                playerId: `${names[i % names.length]}_${Math.floor(Math.random() * 999)}`,
                neonBalance: Math.floor(Math.random() * 5000) + 100,
                rankPoints: 1000 + Math.floor(Math.random() * 2000),
                wins: wins,
                losses: losses,
                totalRaces: wins + losses,
                seasonId: 1
            });
        }
        return mocks;
    }
}

export interface PlayerStats {
    playerId: string;
    neonBalance: number;
    rankPoints: number;
    wins: number;
    losses: number;
    totalRaces: number;
    seasonId: number;
}
