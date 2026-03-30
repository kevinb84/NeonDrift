

export interface EsportsMatch {
    id: string;
    tournamentId: string;
    round: number; // 0 = Finals, 1 = Semis, 2 = Quarters (Standard convention: 0 is highest)
    // Or: 1 = Round of 16, ... Max = Finals. 
    // Let's use: 1 = First Round, ..., N = Finals. 
    // Actually, tree depth is easier. 
    // Let's use: round 1 = First Round. 

    matchIndex: number; // Position in the round (0, 1, 2...)
    player1: string | null; // Null if waiting for previous round
    player2: string | null;
    winner: string | null;
    score1: number;
    score2: number;
    status: 'PENDING' | 'READY' | 'ACTIVE' | 'FINISHED';
}

export interface EsportsBracket {
    tournamentId: string;
    matches: EsportsMatch[];
    champion: string | null;
    rounds: number; // Total rounds
}

export class EsportsManager {
    private static STORAGE_KEY = 'neon_esports_brackets';
    private brackets: Map<string, EsportsBracket> = new Map();
    // private balanceManager: NeonBalanceManager;

    constructor() {
        this.load();
    }

    private load() {
        const raw = localStorage.getItem(EsportsManager.STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            this.brackets = new Map(Object.entries(data));
        }
    }

    private save() {
        const obj = Object.fromEntries(this.brackets);
        localStorage.setItem(EsportsManager.STORAGE_KEY, JSON.stringify(obj));
    }

    public getBracket(tournamentId: string): EsportsBracket | undefined {
        return this.brackets.get(tournamentId);
    }

    public generateBracket(tournamentId: string, participants: string[]): EsportsBracket {
        // 1. Shuffle participants
        const shuffled = [...participants].sort(() => Math.random() - 0.5);

        // 2. Determine size (power of 2)
        // If 6 players, we need 8 slots. 2 byes.
        let size = 2;
        while (size < shuffled.length) size *= 2;

        // Fill with "BYE" placeholders if needed, or nulls
        // Actually, "BYE" means automatic win. 
        // For simplicity in this version, we'll just truncate or fill with bots if strictly required.
        // `TournamentManager` fills bots, so we assume `participants` is decent.
        // If we have 10 players, next power is 16. 6 BYEs.

        // Let's stick to strict powers of 2 for MVP simplicity or fill with "Bot_Filler"
        while (shuffled.length < size) {
            shuffled.push(`Bot_${Math.floor(Math.random() * 10000)}`);
        }

        const totalRounds = Math.log2(size);
        const matches: EsportsMatch[] = [];

        // Generate Round 1
        for (let i = 0; i < size / 2; i++) {
            matches.push({
                id: `${tournamentId}_r1_m${i}`,
                tournamentId,
                round: 1,
                matchIndex: i,
                player1: shuffled[i * 2],
                player2: shuffled[i * 2 + 1],
                winner: null,
                score1: 0,
                score2: 0,
                status: 'READY'
            });
        }

        // Generate subsequent rounds (empty placeholders)
        let currentSize = size / 2;
        for (let r = 2; r <= totalRounds; r++) {
            currentSize /= 2;
            for (let i = 0; i < currentSize; i++) {
                matches.push({
                    id: `${tournamentId}_r${r}_m${i}`,
                    tournamentId,
                    round: r,
                    matchIndex: i,
                    player1: null,
                    player2: null,
                    winner: null,
                    score1: 0,
                    score2: 0,
                    status: 'PENDING'
                });
            }
        }

        const bracket: EsportsBracket = {
            tournamentId,
            matches,
            champion: null,
            rounds: totalRounds
        };

        this.brackets.set(tournamentId, bracket);
        this.save();
        return bracket;
    }

    public simulateMatch(matchId: string): { success: boolean, winner: string } {
        // Find match in all brackets? Or we need bracket ID.
        // For now, search all (inefficient but fine for MVP)
        for (const [, bracket] of this.brackets.entries()) {
            const match = bracket.matches.find(m => m.id === matchId);
            if (match && match.status === 'READY') {
                return this.resolveMatch(bracket, match);
            }
        }
        return { success: false, winner: '' };
    }

    // Auto-resolve a match (Simulated)
    private resolveMatch(bracket: EsportsBracket, match: EsportsMatch): { success: boolean, winner: string } {
        if (!match.player1 || !match.player2) return { success: false, winner: '' };

        // Logic: Random weighted? Or pure 50/50?
        // If player is real, maybe they have higher weight?
        const p1IsPlayer = match.player1 === 'Guest' || !match.player1.startsWith('Bot');
        const p2IsPlayer = match.player2 === 'Guest' || !match.player2.startsWith('Bot');

        let p1WinProb = 0.5;
        if (p1IsPlayer && !p2IsPlayer) p1WinProb = 0.7;
        if (!p1IsPlayer && p2IsPlayer) p1WinProb = 0.3;

        const p1Wins = Math.random() < p1WinProb;

        match.winner = p1Wins ? match.player1 : match.player2;
        match.score1 = p1Wins ? 1 : 0; // Simple score
        match.score2 = p1Wins ? 0 : 1;
        match.status = 'FINISHED';

        this.advanceWinner(bracket, match.round, match.matchIndex, match.winner);
        this.save();

        return { success: true, winner: match.winner };
    }

    private advanceWinner(bracket: EsportsBracket, currentRound: number, matchIndex: number, winner: string) {
        // Next round match index = floor(current / 2)
        // Position: even index -> player1, odd index -> player2
        const nextRound = currentRound + 1;
        if (nextRound > bracket.rounds) {
            // Champion!
            bracket.champion = winner;
            return;
        }

        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatch = bracket.matches.find(m => m.round === nextRound && m.matchIndex === nextMatchIndex);

        if (nextMatch) {
            if (matchIndex % 2 === 0) {
                nextMatch.player1 = winner;
            } else {
                nextMatch.player2 = winner;
            }

            if (nextMatch.player1 && nextMatch.player2) {
                nextMatch.status = 'READY';
            }
        }
    }

    // Advance all possible AI vs AI matches
    public simulateRound(tournamentId: string) {
        const bracket = this.brackets.get(tournamentId);
        if (!bracket) return;

        bracket.matches.forEach(m => {
            if (m.status === 'READY') {
                // If both are bots, auto-sim instantly
                // Or if we want to sim everything for "Esports Mode" viewing
                // For MVP, sim all ready matches
                this.resolveMatch(bracket, m);
            }
        });
        this.save();
    }
}
