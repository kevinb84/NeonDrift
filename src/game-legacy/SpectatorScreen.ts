
import { GameEngine } from './GameEngine';
import { SpectatorManager } from './SpectatorManager';

export class SpectatorScreen {
    private engine: GameEngine;
    private manager: SpectatorManager;

    private participants: string[] = [];
    private betAmount: number = 10;

    private buttons: Array<{ x: number, y: number, w: number, h: number, text: string, action: () => void }> = [];

    constructor(engine: GameEngine, manager: SpectatorManager) {
        this.engine = engine;
        this.manager = manager;
    }

    public init(participants: string[]) {
        this.participants = participants;
        this.manager.initRace(participants);
    }

    public handleClick(x: number, y: number) {
        this.buttons.forEach(btn => {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                this.engine['soundManager'].playUIClick();
                btn.action();
            }
        });
    }

    public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        this.buttons = [];

        // Dark Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText("PLACE YOUR BETS", w / 2, 60);

        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText("Race starting soon...", w / 2, 90);

        // const poolStatus = this.manager.getPoolStatus(); // Not used yet

        let y = 140;
        const x = w / 2;

        ctx.font = '20px "Inter", sans-serif';

        this.participants.forEach((id) => {
            const multiplier = this.manager.getMultiplier(id);

            ctx.fillStyle = '#222';
            ctx.fillRect(x - 200, y - 25, 400, 50);

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(`Car #${id} `, x - 180, y + 5);

            ctx.fillStyle = '#00e5ff';
            ctx.textAlign = 'right';
            ctx.fillText(`${multiplier.toFixed(2)}x`, x + 50, y + 5);

            // Bet Button
            this.drawButton(ctx, x + 80, y - 20, 100, 40, `BET ${this.betAmount}`, () => {
                const res = this.manager.placeBet('Guest', id, this.betAmount);
                alert(res.message);
            });

            y += 60;
        });

        // Bet Amount Toggles
        y += 20;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`Current Wager: ${this.betAmount} Neon`, w / 2, y);

        this.drawButton(ctx, w / 2 - 110, y + 20, 100, 40, "10", () => this.betAmount = 10);
        this.drawButton(ctx, w / 2 + 10, y + 20, 100, 40, "50", () => this.betAmount = 50);

        // Start Race (Spectate)
        this.drawButton(ctx, w / 2 - 100, h - 80, 200, 50, "WATCH RACE", () => {
            this.manager.closeBetting();
            this.engine.startSpectating();
        }, '#00ff00');

        // Back
        this.drawButton(ctx, 20, 20, 80, 40, "BACK", () => {
            this.engine.phase = 'select-difficulty';
        });
    }

    private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, action: () => void, color: string = '#444'): void {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
        this.buttons.push({ x, y, w, h, text, action });
    }
}
