import { LeaderboardManager, PlayerStats } from './LeaderboardManager';
import { SeasonArchiveManager } from './SeasonArchiveManager';

export interface SeasonData {
    seasonId: number;
    startDate: number;
    endDate: number;
    isActive: boolean;
}

const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class SeasonManager {
    private static STORAGE_KEY = 'neon_season_current';

    static getCurrentSeason(): SeasonData {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) return JSON.parse(stored);

        // Init first season
        const newSeason: SeasonData = {
            seasonId: 1,
            startDate: Date.now(),
            endDate: Date.now() + SEASON_DURATION_MS,
            isActive: true
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newSeason));
        return newSeason;
    }

    static checkSeasonEnd(): void {
        const current = this.getCurrentSeason();
        if (Date.now() > current.endDate && current.isActive) {
            this.endSeason(current);
        }
    }

    static getTimeRemaining(): string {
        const current = this.getCurrentSeason();
        const diff = current.endDate - Date.now();
        if (diff <= 0) return "Season Ended";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
    }

    private static endSeason(current: SeasonData): void {
        console.log(`[SeasonManager] Ending Season ${current.seasonId}...`);

        // 1. Snapshot & Archive
        const topPlayers = LeaderboardManager.getTopRankedPlayers(100);
        // We need total count, let's just use length of top 100 for now or fetch all if possible
        // LeaderboardManager 'getAllStats' is private, but getTopRanked calls it.
        // Let's assume topPlayers is good enough for the archive.
        SeasonArchiveManager.archive(current.seasonId, topPlayers, topPlayers.length);

        // 2. Distribute Rewards (Update Simulated Backend Stats)
        this.distributeRewards(topPlayers);

        // 3. Reset RP
        LeaderboardManager.resetForNewSeason(current.seasonId + 1);

        // 4. Start New Season
        const newSeason: SeasonData = {
            seasonId: current.seasonId + 1,
            startDate: Date.now(),
            endDate: Date.now() + SEASON_DURATION_MS,
            isActive: true
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newSeason));
        console.log(`[SeasonManager] Season ${newSeason.seasonId} Started!`);
    }

    private static distributeRewards(sortedPlayers: PlayerStats[]): void {
        const total = sortedPlayers.length;
        if (total === 0) return;

        sortedPlayers.forEach((p, index) => {
            const percentile = (index + 1) / total;
            let reward = 0;

            if (percentile <= 0.01) reward = 500;      // Top 1%
            else if (percentile <= 0.05) reward = 200; // Top 5%
            else if (percentile <= 0.20) reward = 50;  // Top 20%

            if (reward > 0) {
                p.neonBalance += reward;
                // Note: We need to write this back. 
                // Since this is a reference to the array we are about to reset, 
                // we should update it BEFORE reset. 
                // LeaderboardManager.resetForNewSeason expects 'getAllStats' to retrieve fresh data.
                // We must update the stats in storage first.
                LeaderboardManager.updatePlayerStats(p);
                console.log(`[SeasonManager] Awarded position #${index + 1} (${p.playerId}) +${reward} Neon`);
            }
        });
    }
}
