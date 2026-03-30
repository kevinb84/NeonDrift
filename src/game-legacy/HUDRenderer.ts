// ============================================================
// HUDRenderer — Draws the heads-up display overlay
// ============================================================

import { HUDData } from './types';
import { InputManager } from './InputManager';

export class HUDRenderer {
    /** Render the full HUD overlay */
    render(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        hud: HUDData,
        inputManager: InputManager
    ): void {
        ctx.save();

        // --- Top Left: Position + Lap + Timer ---
        this.drawTopLeft(ctx, hud);

        // --- Top Right: Speed ---
        this.drawTopRight(ctx, width, hud);

        // --- Touch Controls (mobile only) ---
        if (inputManager.isTouchDevice()) {
            this.drawTouchControls(ctx, width, height, inputManager);
        }

        ctx.restore();
    }

    private drawTopLeft(ctx: CanvasRenderingContext2D, hud: HUDData): void {
        const x = 20;
        let y = 30;

        // Position
        ctx.font = 'bold 42px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Add glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';

        ctx.fillText(`${this.ordinal(hud.position)}`, x, y);

        ctx.shadowBlur = 0;
        ctx.font = 'bold 18px "Inter", sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(` / ${hud.totalRacers}`, x + ctx.measureText(`${this.ordinal(hud.position)}`).width + 5, y + 14);

        y += 50;

        // Lap
        ctx.font = 'bold 22px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`LAP`, x, y);
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${hud.lap}/${hud.totalLaps}`, x + 55, y);

        y += 32;

        // Timer
        const mins = Math.floor(hud.timer / 60);
        const secs = Math.floor(hud.timer % 60);
        const ms = Math.floor((hud.timer % 1) * 100);
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(
            `${String(mins).padStart(2, '0')}'${String(secs).padStart(2, '0')}"${String(ms).padStart(2, '0')}`,
            x, y
        );
    }

    private drawTopRight(ctx: CanvasRenderingContext2D, width: number, hud: HUDData): void {
        const x = width - 20;

        // Speed number
        ctx.font = 'bold 52px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
        ctx.fillText(`${Math.round(hud.speed)}`, x, 25);

        ctx.shadowBlur = 0;
        // KPH label
        ctx.font = 'bold 18px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('KPH', x, 80);

        // Speed bar (vertical)
        const barX = x - 10;
        const barY = 110;
        const barH = 80;
        const barW = 8;
        const fillRatio = Math.min(hud.speed / 300, 1);

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.roundedRect(ctx, barX - barW, barY, barW, barH, 4);

        // Fill
        const gradient = ctx.createLinearGradient(0, barY + barH, 0, barY);
        gradient.addColorStop(0, '#00e5ff');
        gradient.addColorStop(0.7, '#00ff88');
        gradient.addColorStop(1, '#ff4444');
        ctx.fillStyle = gradient;
        const fillH = barH * fillRatio;
        this.roundedRect(ctx, barX - barW, barY + barH - fillH, barW, fillH, 4);

        // Nitro indicator
        const nitroY = barY + barH + 20;
        if (hud.nitroAmount > 0) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00e5ff';
            ctx.font = 'bold 18px "Inter", sans-serif';
            ctx.fillStyle = '#00e5ff';
            ctx.textAlign = 'right';
            ctx.fillText('⚡ NITRO', x, nitroY);
            ctx.shadowBlur = 0;
        }
    }

    private drawTouchControls(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        inputManager: InputManager
    ): void {
        const buttons = inputManager.getTouchButtonRects(width, height);
        const input = inputManager.getState();

        // Left arrow
        this.drawTouchButton(ctx, buttons.left, '◀', input.left);

        // Right arrow
        this.drawTouchButton(ctx, buttons.right, '▶', input.right);

        // Nitro button
        this.drawTouchButton(ctx, buttons.nitro, '⚡', input.nitro, '#ff6600');

        // Pause button
        this.drawPauseButton(ctx, buttons.pause, input.pause || false);
    }

    private drawPauseButton(
        ctx: CanvasRenderingContext2D,
        rect: { x: number; y: number; w: number; h: number },
        active: boolean
    ): void {
        ctx.save();
        ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;

        // Circle
        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Icon (II)
        ctx.fillStyle = '#ffffff';
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const w = 4;
        const h = 12;
        this.roundedRect(ctx, cx - 5, cy - 6, w, h, 1);
        this.roundedRect(ctx, cx + 1, cy - 6, w, h, 1);
        ctx.restore();
    }

    private drawTouchButton(
        ctx: CanvasRenderingContext2D,
        rect: { x: number; y: number; w: number; h: number },
        label: string,
        active: boolean,
        color: string = '#00e5ff'
    ): void {
        ctx.fillStyle = active
            ? `rgba(0, 229, 255, 0.4)`
            : `rgba(255, 255, 255, 0.15)`;
        ctx.strokeStyle = active ? color : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = active ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowBlur = active ? 10 : 0;
        ctx.shadowColor = color;
        ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 2);
        ctx.shadowBlur = 0;
    }

    // --- Helpers ---

    private ordinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }
}
