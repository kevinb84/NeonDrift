import { GameEngine } from './GameEngine';
import { EsportsManager, EsportsBracket, EsportsMatch } from './EsportsManager';

export class EsportsScreen {
    private engine: GameEngine;
    private manager: EsportsManager;
    private currentBracket: EsportsBracket | null = null;
    private buttons: Array<{ x: number, y: number, w: number, h: number, text: string, action: () => void }> = [];

    constructor(engine: GameEngine, manager: EsportsManager) {
        this.engine = engine;
        this.manager = manager;
    }

    public open(tournamentId: string) {
        this.currentBracket = this.manager.getBracket(tournamentId) || null;
    }

    public handleClick(x: number, y: number) {
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                this.engine['soundManager'].playUIClick();
                btn.action();
                return;
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        this.buttons = [];

        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillText("TOURNAMENT BRACKET", w / 2, 50);

        if (!this.currentBracket) {
            ctx.fillStyle = '#888';
            ctx.font = '24px "Inter", sans-serif';
            ctx.fillText("No bracket data available.", w / 2, h / 2);
            this.drawBackButton(ctx);
            return;
        }

        this.drawBracket(ctx, w, h);
        this.drawBackButton(ctx);
    }

    private drawBackButton(ctx: CanvasRenderingContext2D) {
        this.drawButton(ctx, 20, 20, 100, 40, "BACK", () => {
            this.engine.phase = 'tournament'; // Go back to tournament screen
            // Or 'select-difficulty' if tournament screen is also a phase?
            // TournamentScreen is rendered when phase arg is 'tournament' in GameEngine.
            // So this is correct.
        });
    }

    private drawBracket(ctx: CanvasRenderingContext2D, w: number, h: number) {
        if (!this.currentBracket) return;

        const rounds = this.currentBracket.rounds;
        const columnWidth = w / (rounds + 1); // +1 prevents edge crowding

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        for (let r = 1; r <= rounds; r++) {
            const matches = this.currentBracket.matches.filter(m => m.round === r);
            const x = 50 + (r - 1) * columnWidth;

            // Distribute vertically
            const slotHeight = (h - 100) / matches.length;

            matches.forEach((m, i) => {
                const y = 100 + i * slotHeight + slotHeight / 2;

                // Draw Match Box
                this.drawMatchBox(ctx, x, y - 30, columnWidth - 40, 60, m);

                // Draw connecting lines to next round
                if (r < rounds) {
                    const nextMatchIndex = Math.floor(m.matchIndex / 2);
                    const nextMatches = this.currentBracket!.matches.filter(nm => nm.round === r + 1);
                    const nextMatch = nextMatches.find(nm => nm.matchIndex === nextMatchIndex);

                    if (nextMatch) {
                        // Calculate next match Y position
                        // A bit tricky without pre-calculating, but essentially:
                        // Next match is roughly centered between its two sources.
                        // For simplistic rendering: 
                        // We can just draw a line from this box right side to... somewhere?

                        // Let's rely on standard tree drawing logic:
                        // Or just draw straight lines if we align grid correctly.

                        // Using grid alignment:
                        const nextX = 50 + r * columnWidth;
                        const nextSlotHeight = (h - 100) / nextMatches.length;
                        const nextY = 100 + nextMatchIndex * nextSlotHeight + nextSlotHeight / 2;

                        ctx.beginPath();
                        ctx.moveTo(x + columnWidth - 40, y);
                        ctx.lineTo(x + columnWidth - 20, y);
                        ctx.lineTo(x + columnWidth - 20, nextY);
                        ctx.lineTo(nextX, nextY);
                        ctx.strokeStyle = '#555';
                        ctx.stroke();
                    }
                }
            });
        }

        // Champion Box
        if (this.currentBracket.champion) {
            const x = 50 + rounds * columnWidth;
            const y = h / 2;

            ctx.fillStyle = '#ffd700'; // Gold
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.fillText(`🏆 ${this.currentBracket.champion}`, x + 50, y);
        }
    }

    private drawMatchBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, match: EsportsMatch) {
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, w, h);

        // Highlights
        if (match.status === 'FINISHED') ctx.strokeStyle = '#444';
        else if (match.status === 'READY') ctx.strokeStyle = '#00e5ff';
        else ctx.strokeStyle = '#333';

        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'left';

        const p1 = match.player1 || 'TBD';
        const p2 = match.player2 || 'TBD';

        ctx.fillText(p1, x + 10, y + 20);
        ctx.fillText(p2, x + 10, y + 45);

        // Scores
        ctx.textAlign = 'right';
        ctx.fillText(match.score1.toString(), x + w - 10, y + 20);
        ctx.fillText(match.score2.toString(), x + w - 10, y + 45);

        // Winner highlight
        if (match.winner) {
            ctx.fillStyle = '#00ff00';
            if (match.winner === match.player1) ctx.fillText('★', x + w - 25, y + 20);
            if (match.winner === match.player2) ctx.fillText('★', x + w - 25, y + 45);
        }
    }

    private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, action: () => void, color: string = '#444'): void {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);

        this.buttons.push({ x, y, w, h, text, action });
    }
}
