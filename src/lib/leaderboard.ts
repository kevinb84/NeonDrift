import { insforge } from './insforge';

// Cast to any to avoid TS errors if types are not perfectly synced
const db = insforge as any;

export interface RaceResult {
    id?: string;
    track_id: string;
    difficulty: string;
    car_id: string;
    race_time: number;
    position: number;
    created_at?: string;
    // Joined profile data (optional)
    profiles?: {
        username: string | null;
    };
}

export class LeaderboardManager {
    /**
     * Submit a new race result to the database
     */
    static async submitScore(
        trackId: string,
        difficulty: string,
        carId: string,
        raceTimeMs: number,
        position: number
    ): Promise<boolean> {
        try {
            const { error } = await db
                .from('race_results')
                .insert([
                    {
                        track_id: trackId,
                        difficulty: difficulty,
                        car_id: carId,
                        race_time: Math.floor(raceTimeMs),
                        position: position
                    }
                ]);

            if (error) {
                console.error('Error submitting race score to DB:', error);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Failed to submit race score:', e);
            return false;
        }
    }

    /**
     * Fetch top scores for a specific track and difficulty
     */
    static async getTopScores(trackId: string, difficulty: string, limit: number = 10): Promise<RaceResult[]> {
        try {
            const { data, error } = await db
                .from('race_results')
                .select('*')
                .eq('track_id', trackId)
                .eq('difficulty', difficulty)
                .order('race_time', { ascending: true })
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

    // ==============================================================================
    // Local Session Personal Bests (PBs)
    // ==============================================================================

    /**
     * Returns the previous best time for this track and difficulty.
     * Returns null if no previous record exists.
     */
    static getLocalBest(trackId: string, difficulty: string): number | null {
        try {
            const key = `neon_pb_${trackId}_${difficulty}`;
            const val = localStorage.getItem(key);
            return val ? parseInt(val, 10) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Record a time locally. Returns true if it's a NEW personal best.
     */
    static recordLocalTime(trackId: string, difficulty: string, raceTimeMs: number): boolean {
        try {
            const key = `neon_pb_${trackId}_${difficulty}`;
            const existing = this.getLocalBest(trackId, difficulty);

            if (existing === null || raceTimeMs < existing) {
                localStorage.setItem(key, raceTimeMs.toString());
                return true; // New PB
            }
            return false;
        } catch (e) {
            return false;
        }
    }
}
