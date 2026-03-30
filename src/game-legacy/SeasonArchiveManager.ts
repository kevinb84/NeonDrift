import { PlayerStats } from './LeaderboardManager';

export interface ArchivedSeason {
    seasonId: number;
    endDate: number;
    topPlayers: PlayerStats[];
    totalParticipants: number;
}

export class SeasonArchiveManager {
    private static STORAGE_KEY = 'neon_season_archive';

    static archive(seasonId: number, topPlayers: PlayerStats[], totalParticipants: number): void {
        const archives = this.getArchives();
        // Prevent duplicate archive for same season
        if (archives.find(s => s.seasonId === seasonId)) {
            console.warn(`Season ${seasonId} already archived.`);
            return;
        }

        archives.push({
            seasonId,
            endDate: Date.now(),
            topPlayers,
            totalParticipants
        });
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(archives));
    }

    static getArchives(): ArchivedSeason[] {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    static getSeason(seasonId: number): ArchivedSeason | undefined {
        return this.getArchives().find(s => s.seasonId === seasonId);
    }
}
