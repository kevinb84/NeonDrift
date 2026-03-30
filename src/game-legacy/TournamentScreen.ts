import { TournamentManager, Tournament } from './TournamentManager';
import { NeonBalanceManager } from './NeonBalanceManager';
import { GameEngine } from './GameEngine';

export class TournamentScreen {
    private engine: GameEngine;
    private tournaments: Tournament[] = [];
    private balanceManager: NeonBalanceManager;
    private mouseX = 0;
    private mouseY = 0;
    private buttons: Array<{ x: number, y: number, w: number, h: number, text: string, action: () => void }> = [];

    constructor(engine: GameEngine, balanceManager: NeonBalanceManager) {
        this.engine = engine;
        this.balanceManager = balanceManager;
    }

    refresh() {
        this.tournaments = TournamentManager.getTournaments(this.engine.esportsManager);
    }

    handleInput(input: any) {
        if (input.mouse) {
            this.mouseX = input.mouse.x;
            this.mouseY = input.mouse.y;

            if (input.mouse.click) {
                for (const b of this.buttons) {
                    if (this.mouseX >= b.x && this.mouseX <= b.x + b.w &&
                        this.mouseY >= b.y && this.mouseY <= b.y + b.h) {
                        b.action();
                        break;
                    }
                }
            }
        }
    }

    render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillText('TOURNAMENTS', w / 2, 60);

        this.buttons = [];

        // Render Cards (Daily vs Weekly)
        const daily = this.tournaments.find(t => t.type === 'DAILY');
        const weekly = this.tournaments.find(t => t.type === 'WEEKLY');

        const cardW = 300;
        const cardH = 400;
        const gap = 50;
        const startX = (w - (cardW * 2 + gap)) / 2;
        const cardY = 120;

        if (daily) this.renderCard(ctx, daily, startX, cardY, cardW, cardH);
        if (weekly) this.renderCard(ctx, weekly, startX + cardW + gap, cardY, cardW, cardH);

        // Close Button
        this.drawButton(ctx, w / 2 - 60, h - 80, 120, 40, 'BACK', '#444444', () => {
            if (this.engine) this.engine['phase'] = 'select-difficulty'; // Hacky access? Or add method?
            // Actually usually screens have callbacks or GameEngine handles state.
            // GameEngine handles "phase".
            // We need a way to close this.
            // We'll rely on GameEngine.
        });
    }

    private renderCard(ctx: CanvasRenderingContext2D, t: Tournament, x: number, y: number, w: number, h: number) {
        // BG
        const isDaily = t.type === 'DAILY';
        ctx.fillStyle = isDaily ? '#1a0a2e' : '#1a1a0a';
        ctx.strokeStyle = isDaily ? '#00e5ff' : '#ffd700';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.name, x + w / 2, y + 40);

        // Info
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#cccccc';

        let startY = y + 80;
        const lineHeight = 30;

        ctx.fillText(`${t.trackId} (${t.difficulty})`, x + w / 2, startY); startY += lineHeight;

        // Time Remaining
        const diff = t.endTime - Date.now();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        ctx.fillStyle = '#00ff00';
        ctx.fillText(diff > 0 ? `Ends in: ${days}d ${hours}h ${mins}m` : 'ENDED', x + w / 2, startY); startY += lineHeight;

        ctx.fillStyle = '#cccccc';
        ctx.fillText(`Prize Pool: ${t.prizePool} Neon`, x + w / 2, startY); startY += lineHeight;
        ctx.fillText(`Participants: ${t.participants.length}`, x + w / 2, startY); startY += lineHeight;
        ctx.fillText(`Entry Fee: ${t.entryFee} Neon`, x + w / 2, startY); startY += lineHeight + 20;

        // Action Button
        const joined = t.participants.includes(this.engine['walletAddress'] || 'Guest'); // Access workaround
        if (joined) {
            // If Weekly, allow viewing bracket
            if (t.type === 'WEEKLY') {
                this.drawButton(ctx, x + 50, y + h - 120, w - 100, 40, 'VIEW BRACKET', '#6600cc', () => {
                    this.engine.esportsScreen.open(t.id);
                    this.engine.phase = 'esports-bracket';
                });
            }

            this.drawButton(ctx, x + 50, y + h - 70, w - 100, 40, 'RACE NOW', '#009900', () => {
                // Start Race
                this.engine['startTournamentRace'](t);
            });
        } else {
            // Join Button
            const canAfford = this.balanceManager.canAfford(t.entryFee);
            this.drawButton(ctx, x + 50, y + h - 70, w - 100, 40,
                canAfford ? 'JOIN' : 'INSUFFICIENT NEON',
                canAfford ? '#00e5ff' : '#555555',
                () => {
                    if (canAfford) {
                        const res = TournamentManager.enterTournament(t.id, this.balanceManager, this.engine['walletAddress'] || 'Guest');
                        if (res.success) {
                            this.engine['soundManager'].playUIClick();
                            this.refresh();
                        } else {
                            this.engine['soundManager'].playError();
                        }
                    } else {
                        this.engine['soundManager'].playError();
                    }
                }
            );
        }
    }

    private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, color: string, action: () => void) {
        ctx.fillStyle = color;
        if (this.mouseX >= x && this.mouseX <= x + w && this.mouseY >= y && this.mouseY <= y + h) {
            ctx.fillStyle = '#ffffff'; // Hover
        }
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
        ctx.textBaseline = 'alphabetic';

        this.buttons.push({ x, y, w, h, text, action });
    }
}
