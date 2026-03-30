// ============================================================
// CarRenderer — GT Race Car sprites with layered rendering
// ============================================================
//
// Layer order:
//   1. Shadow
//   2. Wheels (with speed blur)
//   3. Base body
//   4. Lower fenders / diffuser
//   5. Windows (dark tint)
//   6. Decals / racing stripes
//   7. Side air vents
//   8. Rear wing
//   9. Lights (headlights, brake flare, exhaust glow)
//
// Dynamic effects:
//   - Body tilt on steering
//   - Wheel blur at high speed
//   - Exhaust flame glow
//   - Brake light flare with bloom
// ============================================================

import { Car } from './types';
import { RoadRenderer } from './RoadRenderer';
import { PLAYER_MAX_SPEED, ROAD_WIDTH } from './constants';
import { CarPaint, CAR_PAINTS } from './CarShop';

export class CarRenderer {
    private paint: CarPaint = CAR_PAINTS[0]; // Default stock

    setPaint(paint: CarPaint): void {
        this.paint = paint;
    }

    render(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        cars: Car[],
        playerCar: Car | null,
        cameraZ: number,
        cameraX: number,
        roadRenderer: RoadRenderer,
        isPremium: boolean = false
    ): void {
        const sorted = [...cars].sort((a, b) => (b.z - cameraZ) - (a.z - cameraZ));
        for (const car of sorted) {
            this.drawAIGTCar(ctx, width, height, car, cameraX, cameraZ, roadRenderer);
        }
        if (playerCar) {
            this.drawPlayerGTCar(ctx, width, height, playerCar, isPremium);
        }
    }

    // ========== AI GT Car (rear view) ==========

    private drawAIGTCar(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        car: Car,
        cameraX: number,
        cameraZ: number,
        roadRenderer: RoadRenderer
    ): void {
        const proj = roadRenderer.projectZ(car.z, car.x, 0, cameraZ, 0, width, height, cameraX);
        if (!proj) return;

        const { screenX, screenY, scale } = proj;
        const s = Math.min(scale, 1.0);
        // Scale car relative to ROAD_WIDTH (approx 1/4 of road width as requested)
        const carW = (ROAD_WIDTH * 0.25) * s;
        const carH = carW * 0.45;       // Lower profile (25% lower roof)

        if (carW < 2 || screenX < -carW || screenX > width + carW || screenY < 0) return;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Body tilt on steering
        const tilt = car.steerOffset * 0.03;
        ctx.rotate(tilt);


        const by = -carH;
        const rearW = carW * 1.15; // 15% wider rear

        // --- Layer 1: Shadow ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 2, rearW * 0.5, carH * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Layer 2: Wheels (with blur) ---
        this.drawWheels(ctx, carW, carH, by, car.speed, s, true);

        // --- Layer 3: Base body (GT shape - wider at rear) ---
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.moveTo(-carW * 0.4, by);                     // Top left
        ctx.lineTo(carW * 0.4, by);                      // Top right
        ctx.lineTo(rearW * 0.5, by + carH * 0.5);        // Widen at rear
        ctx.lineTo(rearW * 0.5, by + carH);              // Bottom right
        ctx.lineTo(-rearW * 0.5, by + carH);             // Bottom left
        ctx.lineTo(-rearW * 0.5, by + carH * 0.5);       // Widen at rear
        ctx.closePath();
        ctx.fill();

        // --- Layer 4: Lower fenders / diffuser ---
        ctx.fillStyle = this.darken(car.color, 0.55);
        ctx.fillRect(-rearW * 0.5, by + carH * 0.7, rearW, carH * 0.3);

        // Rear diffuser fins
        ctx.fillStyle = this.darken(car.color, 0.3);
        for (let d = 0; d < 5; d++) {
            const dx = -rearW * 0.35 + d * (rearW * 0.7 / 4);
            ctx.fillRect(dx, by + carH * 0.92, Math.max(1, rearW * 0.02), carH * 0.08);
        }

        // --- Layer 5: Windows (dark tint) ---
        ctx.fillStyle = 'rgba(20, 40, 60, 0.7)';
        const winW = carW * 0.5;
        const winH = carH * 0.2;
        this.roundRect(ctx, -winW / 2, by + carH * 0.05, winW, winH, Math.max(1, s * 2));
        ctx.fill();

        // --- Layer 6: Racing stripes ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-carW * 0.05, by, carW * 0.04, carH * 0.4);
        ctx.fillRect(carW * 0.01, by, carW * 0.04, carH * 0.4);

        // --- Layer 7: Side air vents ---
        ctx.fillStyle = this.darken(car.color, 0.35);
        ctx.fillRect(-rearW * 0.48, by + carH * 0.35, rearW * 0.1, carH * 0.15);
        ctx.fillRect(rearW * 0.38, by + carH * 0.35, rearW * 0.1, carH * 0.15);

        // --- Layer 8: Large rear wing ---
        ctx.fillStyle = this.darken(car.color, 0.25);
        // Wing endplates
        ctx.fillRect(-rearW * 0.52, by - carH * 0.12, rearW * 0.06, carH * 0.18);
        ctx.fillRect(rearW * 0.46, by - carH * 0.12, rearW * 0.06, carH * 0.18);
        // Wing main element
        ctx.fillRect(-rearW * 0.52, by - carH * 0.12, rearW * 1.04, carH * 0.06);
        // Wing supports
        ctx.fillRect(-rearW * 0.12, by + carH * 0.06, Math.max(1, rearW * 0.03), carH * 0.08);
        ctx.fillRect(rearW * 0.09, by + carH * 0.06, Math.max(1, rearW * 0.03), carH * 0.08);

        // --- Layer 9: Tail lights with flare ---
        const braking = car.braking;
        ctx.fillStyle = braking ? '#ff0000' : '#cc2222';
        ctx.shadowBlur = braking ? 12 : 4;
        ctx.shadowColor = '#ff0000';
        // LED strip style taillights
        this.roundRect(ctx, -rearW * 0.45, by + carH * 0.72, rearW * 0.2, carH * 0.06, 1);
        ctx.fill();
        this.roundRect(ctx, rearW * 0.25, by + carH * 0.72, rearW * 0.2, carH * 0.06, 1);
        ctx.fill();
        ctx.shadowBlur = 0;

        // --- Exhaust glow ---
        if (car.speed > 50) {
            const glowAlpha = Math.min(car.speed / 500, 0.4);
            ctx.fillStyle = `rgba(255, 100, 30, ${glowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(-rearW * 0.15, by + carH + 2, Math.max(1, s * 4), Math.max(1, s * 2), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(rearW * 0.15, by + carH + 2, Math.max(1, s * 4), Math.max(1, s * 2), 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ========== Player GT Car (top-down view) ==========

    public drawPlayerGTCar(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        car: Car,
        isPremium: boolean = false
    ): void {
        // Match AI car scaling (approx 1/4 of road width at scale ~1.0)
        const carW = ROAD_WIDTH * 0.25;
        const carH = carW * 1.5;         // Long body
        const rearW = carW * 1.15;        // 15% wider rear
        const cx = width / 2 + car.steerOffset * 20;
        const cy = height - carH / 2 - 20;

        // Nameplate
        this.drawNameplate(ctx, cx, cy - carH * 0.8, "DRIVER", isPremium);

        ctx.save();
        ctx.translate(cx, cy);

        // Body tilt on steering
        const tilt = car.steerOffset * 0.6;
        ctx.rotate(tilt * 0.025);


        const by = -carH * 0.45;
        const bh = carH * 0.85;


        const speedRatio = car.speed / PLAYER_MAX_SPEED;

        // --- Layer 1: Shadow ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(3, carH * 0.42, carW * 0.7, carH * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Layer 2: Wheels (with speed blur) ---
        this.drawPlayerWheels(ctx, carW, bh, by, car.speed);

        // --- Layer 3: Base body (GT silhouette) ---
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.paint.bodyColor;
        ctx.fillStyle = this.paint.bodyColor;
        ctx.beginPath();
        // Nose (narrow, sharp)
        ctx.moveTo(0, by - bh * 0.02);
        ctx.quadraticCurveTo(carW * 0.3, by, carW * 0.4, by + bh * 0.15);
        // Right side (widens toward rear)
        ctx.lineTo(rearW * 0.5, by + bh * 0.5);
        ctx.lineTo(rearW * 0.5, by + bh * 0.95);
        ctx.quadraticCurveTo(rearW * 0.5, by + bh, rearW * 0.45, by + bh);
        // Bottom / rear
        ctx.lineTo(-rearW * 0.45, by + bh);
        ctx.quadraticCurveTo(-rearW * 0.5, by + bh, -rearW * 0.5, by + bh * 0.95);
        // Left side
        ctx.lineTo(-rearW * 0.5, by + bh * 0.5);
        ctx.lineTo(-carW * 0.4, by + bh * 0.15);
        ctx.quadraticCurveTo(-carW * 0.3, by, 0, by - bh * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // --- Layer 4: Lower fenders (darker, wider at rear) ---
        ctx.fillStyle = this.darken(this.paint.accentColor, 0.8);
        ctx.beginPath();
        ctx.moveTo(-rearW * 0.5, by + bh * 0.6);
        ctx.lineTo(rearW * 0.5, by + bh * 0.6);
        ctx.lineTo(rearW * 0.5, by + bh);
        ctx.lineTo(-rearW * 0.5, by + bh);
        ctx.closePath();
        ctx.fill();

        // Rear diffuser
        ctx.fillStyle = this.darken(this.paint.accentColor, 0.4);
        ctx.fillRect(-rearW * 0.4, by + bh * 0.95, rearW * 0.8, bh * 0.05);
        // Diffuser fins
        for (let d = 0; d < 7; d++) {
            const dx = -rearW * 0.35 + d * (rearW * 0.7 / 6);
            ctx.fillRect(dx, by + bh * 0.93, 1.5, bh * 0.07);
        }

        // --- Layer 5: Windows (dark tint) ---
        // Windshield
        ctx.fillStyle = this.paint.windowTint;
        const winW = carW * 0.65;
        const winH = bh * 0.15;
        ctx.beginPath();
        ctx.moveTo(-winW * 0.35, by + bh * 0.28);
        ctx.lineTo(winW * 0.35, by + bh * 0.28);
        ctx.lineTo(winW * 0.5, by + bh * 0.28 + winH);
        ctx.lineTo(-winW * 0.5, by + bh * 0.28 + winH);
        ctx.closePath();
        ctx.fill();

        // Windshield reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(-winW * 0.2, by + bh * 0.29, winW * 0.2, winH * 0.4);

        // Roof (lower — 25% reduced)
        ctx.fillStyle = this.darken(this.paint.bodyColor, 0.5);
        const roofW = carW * 0.55;
        this.roundRect(ctx, -roofW / 2, by + bh * 0.32, roofW, bh * 0.15, 3);
        ctx.fill();

        // Rear window
        ctx.fillStyle = 'rgba(30, 80, 140, 0.4)';
        this.roundRect(ctx, -roofW * 0.45, by + bh * 0.47, roofW * 0.9, bh * 0.08, 2);
        ctx.fill();

        // --- Layer 6: Racing stripes (twin) ---
        ctx.fillStyle = this.paint.stripeColor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(-carW * 0.08, by, carW * 0.05, bh * 0.28);
        ctx.fillRect(carW * 0.03, by, carW * 0.05, bh * 0.28);
        // Rear stripes continuing from roof
        ctx.fillRect(-carW * 0.08, by + bh * 0.55, carW * 0.05, bh * 0.4);
        ctx.fillRect(carW * 0.03, by + bh * 0.55, carW * 0.05, bh * 0.4);
        ctx.globalAlpha = 1.0;

        // --- Layer 7: Side air vents ---
        ctx.fillStyle = this.darken(this.paint.bodyColor, 0.3);
        // Left vent (3 slats)
        for (let v = 0; v < 3; v++) {
            const vy = by + bh * 0.38 + v * bh * 0.04;
            ctx.fillRect(-rearW * 0.48, vy, rearW * 0.08, bh * 0.02);
        }
        // Right vent (3 slats)
        for (let v = 0; v < 3; v++) {
            const vy = by + bh * 0.38 + v * bh * 0.04;
            ctx.fillRect(rearW * 0.4, vy, rearW * 0.08, bh * 0.02);
        }

        // Hood vents
        ctx.fillStyle = this.darken(this.paint.bodyColor, 0.35);
        ctx.fillRect(-carW * 0.15, by + bh * 0.1, carW * 0.1, bh * 0.04);
        ctx.fillRect(carW * 0.05, by + bh * 0.1, carW * 0.1, bh * 0.04);

        // Hood center crease
        ctx.strokeStyle = this.darken(this.paint.bodyColor, 0.75);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, by + bh * 0.02);
        ctx.lineTo(0, by + bh * 0.25);
        ctx.stroke();

        // Side mirrors
        ctx.fillStyle = this.darken(this.paint.bodyColor, 0.5);
        ctx.fillRect(-carW / 2 - carW * 0.06, by + bh * 0.3, carW * 0.08, bh * 0.03);
        ctx.fillRect(carW / 2 - carW * 0.02, by + bh * 0.3, carW * 0.08, bh * 0.03);

        // --- Layer 8: Large rear wing ---
        ctx.fillStyle = this.darken(this.paint.accentColor, 0.2);
        // Wing endplates (tall)
        ctx.fillRect(-rearW * 0.52, by + bh * 0.78, rearW * 0.06, bh * 0.14);
        ctx.fillRect(rearW * 0.46, by + bh * 0.78, rearW * 0.06, bh * 0.14);
        // Main wing element
        ctx.fillRect(-rearW * 0.52, by + bh * 0.78, rearW * 1.04, bh * 0.04);
        // Secondary wing element (Gurney flap)
        ctx.fillRect(-rearW * 0.48, by + bh * 0.83, rearW * 0.96, bh * 0.02);
        // Wing supports
        ctx.fillRect(-rearW * 0.12, by + bh * 0.7, 2, bh * 0.08);
        ctx.fillRect(rearW * 0.1, by + bh * 0.7, 2, bh * 0.08);

        // --- Layer 9a: Headlights (sharp) ---
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffffff';
        // Sharp angular headlights
        ctx.beginPath();
        ctx.moveTo(-carW * 0.35, by + bh * 0.06);
        ctx.lineTo(-carW * 0.2, by + bh * 0.04);
        ctx.lineTo(-carW * 0.2, by + bh * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(carW * 0.35, by + bh * 0.06);
        ctx.lineTo(carW * 0.2, by + bh * 0.04);
        ctx.lineTo(carW * 0.2, by + bh * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // --- Layer 9b: Tail lights with brake flare ---
        const braking = car.braking;
        ctx.fillStyle = braking ? '#ff0000' : '#cc2222';
        ctx.shadowBlur = braking ? 18 : 5;
        ctx.shadowColor = '#ff0000';
        // LED strip taillights
        this.roundRect(ctx, -rearW * 0.45, by + bh * 0.88, rearW * 0.22, bh * 0.03, 1);
        ctx.fill();
        this.roundRect(ctx, rearW * 0.23, by + bh * 0.88, rearW * 0.22, bh * 0.03, 1);
        ctx.fill();
        // Center brake light
        ctx.fillStyle = braking ? '#ff0000' : '#661111';
        ctx.fillRect(-carW * 0.12, by + bh * 0.86, carW * 0.24, bh * 0.015);
        ctx.shadowBlur = 0;

        // Brake flare bloom when braking
        if (braking) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
            ctx.beginPath();
            ctx.ellipse(0, by + bh * 0.9, rearW * 0.6, bh * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Layer 9c: Exhaust with flame glow ---
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(-rearW * 0.2, by + bh + 1, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rearW * 0.2, by + bh + 1, 4, 0, Math.PI * 2);
        ctx.fill();

        if (car.speed > 30) {
            const flameLen = Math.min(speedRatio * 12, 10);
            const flameAlpha = Math.min(speedRatio * 0.5, 0.4);

            // Inner flame (white-yellow)
            ctx.fillStyle = `rgba(255, 220, 100, ${flameAlpha})`;
            ctx.beginPath();
            ctx.ellipse(-rearW * 0.2, by + bh + 3 + flameLen * 0.3, 3, flameLen * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(rearW * 0.2, by + bh + 3 + flameLen * 0.3, 3, flameLen * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Outer flame (orange)
            ctx.fillStyle = `rgba(255, 100, 20, ${flameAlpha * 0.6})`;
            ctx.beginPath();
            ctx.ellipse(-rearW * 0.2, by + bh + 3 + flameLen * 0.5, 5, flameLen * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(rearW * 0.2, by + bh + 3 + flameLen * 0.5, 5, flameLen * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Race number decal ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(0, by + bh * 0.55, carW * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ========== Wheel Rendering ==========

    /** Draw wheels for AI car (rear view) with speed blur */
    private drawWheels(
        ctx: CanvasRenderingContext2D,
        carW: number,
        carH: number,
        by: number,
        speed: number,
        scale: number,
        _isRearView: boolean
    ): void {
        const tireW = carW * 0.14;     // Wider tires
        const tireH = carH * 0.28;
        const gap = carW * 0.02;        // Reduced wheel gap
        const speedRatio = speed / PLAYER_MAX_SPEED;

        // Left tire
        const lx = -carW * 0.5 - gap;
        const ty = by + carH * 0.65;

        ctx.fillStyle = '#111111';
        ctx.fillRect(lx, ty, tireW, tireH);

        // Right tire
        const rx = carW * 0.5 - tireW + gap;
        ctx.fillRect(rx, ty, tireW, tireH);

        // Rims
        ctx.fillStyle = '#555555';
        ctx.fillRect(lx + tireW * 0.2, ty + tireH * 0.15, tireW * 0.6, tireH * 0.7);
        ctx.fillRect(rx + tireW * 0.2, ty + tireH * 0.15, tireW * 0.6, tireH * 0.7);

        // Speed blur on wheels
        if (speedRatio > 0.3) {
            const blurAlpha = Math.min(speedRatio * 0.3, 0.25);
            ctx.fillStyle = `rgba(60, 60, 60, ${blurAlpha})`;
            ctx.fillRect(lx - 1, ty - Math.max(1, scale * 2), tireW + 2, tireH + Math.max(2, scale * 4));
            ctx.fillRect(rx - 1, ty - Math.max(1, scale * 2), tireW + 2, tireH + Math.max(2, scale * 4));
        }
    }

    /** Draw wheels for player car (top-down view) with speed blur */
    private drawPlayerWheels(
        ctx: CanvasRenderingContext2D,
        carW: number,
        bh: number,
        by: number,
        speed: number
    ): void {
        const rearW = carW * 1.15;
        const tireW = carW * 0.09;      // Wider tires
        const tireH = bh * 0.14;        // Longer
        const rearTireH = bh * 0.16;    // Rear tires even bigger (racing)
        const gap = carW * 0.01;        // Tight wheel gap
        const speedRatio = speed / PLAYER_MAX_SPEED;

        ctx.fillStyle = '#0a0a0a';

        // Front left
        ctx.fillRect(-carW / 2 - gap, by + bh * 0.12, tireW, tireH);
        // Front right
        ctx.fillRect(carW / 2 - tireW + gap, by + bh * 0.12, tireW, tireH);
        // Rear left (wider)
        ctx.fillRect(-rearW / 2 - gap, by + bh * 0.7, tireW * 1.2, rearTireH);
        // Rear right (wider)
        ctx.fillRect(rearW / 2 - tireW * 1.2 + gap, by + bh * 0.7, tireW * 1.2, rearTireH);

        // Rims
        ctx.fillStyle = '#444444';
        ctx.fillRect(-carW / 2 - gap + tireW * 0.25, by + bh * 0.14, tireW * 0.5, tireH * 0.7);
        ctx.fillRect(carW / 2 - tireW + gap + tireW * 0.25, by + bh * 0.14, tireW * 0.5, tireH * 0.7);
        ctx.fillRect(-rearW / 2 - gap + tireW * 0.3, by + bh * 0.72, tireW * 0.6, rearTireH * 0.7);
        ctx.fillRect(rearW / 2 - tireW * 1.2 + gap + tireW * 0.3, by + bh * 0.72, tireW * 0.6, rearTireH * 0.7);

        // Wheel blur at high speed
        if (speedRatio > 0.3) {
            const blurAlpha = Math.min(speedRatio * 0.25, 0.2);
            ctx.fillStyle = `rgba(40, 40, 40, ${blurAlpha})`;
            // Vertical motion blur streaks
            const blurLen = speedRatio * 8;
            ctx.fillRect(-carW / 2 - gap - 1, by + bh * 0.12 - blurLen, tireW + 2, tireH + blurLen * 2);
            ctx.fillRect(carW / 2 - tireW + gap - 1, by + bh * 0.12 - blurLen, tireW + 2, tireH + blurLen * 2);
            ctx.fillRect(-rearW / 2 - gap - 1, by + bh * 0.7 - blurLen, tireW * 1.2 + 2, rearTireH + blurLen * 2);
            ctx.fillRect(rearW / 2 - tireW * 1.2 + gap - 1, by + bh * 0.7 - blurLen, tireW * 1.2 + 2, rearTireH + blurLen * 2);
        }
    }

    // ========== Helpers ==========

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
        r = Math.min(r, w / 2, h / 2);
        if (r < 0) r = 0;
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
    }

    private darken(hex: string, factor: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }

    private drawNameplate(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, isPremium: boolean): void {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isPremium) {
            // Gold Plate
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffd700';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

            // Background
            const textW = ctx.measureText(name).width + 40;
            this.roundRect(ctx, x - textW / 2, y - 15, textW, 30, 15);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffd700';
            ctx.stroke();

            // Text
            ctx.font = 'bold 14px "Inter", sans-serif';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`👑 ${name}`, x, y);
        } else {
            // Standard
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const textW = ctx.measureText(name).width + 20;
            this.roundRect(ctx, x - textW / 2, y - 12, textW, 24, 12);
            ctx.fill();

            ctx.font = 'bold 12px "Inter", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(name, x, y);
        }
        ctx.restore();
    }
}
