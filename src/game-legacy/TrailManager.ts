import { TrailStyle } from './CarShop';
import { RoadRenderer } from './RoadRenderer';
import { SEGMENT_LENGTH } from './constants';

interface TrailParticle {
    x: number; // World X (-1 to 1)
    z: number; // World Z
    vx: number;
    vz: number; // Relative speed
    life: number;
    maxLife: number;
    size: number;
    color: string;
    styleId: string;
}

export class TrailManager {
    private particles: TrailParticle[] = [];

    update(dt: number): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.z += p.vz * dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    spawn(x: number, z: number, speedRatio: number, style: TrailStyle): void {
        if (style.id === 'none') return;

        // Rate limiter based on speed?
        if (Math.random() > 0.4 + speedRatio * 0.4) return;

        // Dual emission points (left/right wheels roughly)
        // Car width is approx 0.1 normalized?
        const offset = 0.05;

        // Spawn 2 particles
        this.emit(x - offset, z, style);
        this.emit(x + offset, z, style);
    }

    private emit(x: number, z: number, style: TrailStyle): void {
        let p: TrailParticle = {
            x: x + (Math.random() - 0.5) * 0.02,
            z: z,
            vx: 0,
            vz: 0,
            life: 1.0,
            maxLife: 1.0,
            size: 1.0,
            color: style.color,
            styleId: style.id
        };

        if (style.id === 'neon_flux') {
            p.life = 0.5 + Math.random() * 0.3;
            p.size = 20 + Math.random() * 10;
            p.vx = (Math.random() - 0.5) * 0.1;
        } else if (style.id === 'solar_flare') {
            p.life = 0.4 + Math.random() * 0.4;
            p.size = 15 + Math.random() * 15;
            p.vx = (Math.random() - 0.5) * 0.3; // Turbulent
            p.color = Math.random() > 0.5 ? '#ff4400' : '#ffcc00';
        } else if (style.id === 'quantum_spark') {
            p.life = 0.8 + Math.random() * 0.4;
            p.size = 5 + Math.random() * 5;
            p.vx = (Math.random() - 0.5) * 0.5;
            p.color = Math.random() > 0.5 ? '#ffd700' : '#ffffff';
        } else if (style.id === 'matrix_glitch') {
            p.life = 0.6;
            p.size = 12;
            p.vx = 0; // Static in x
            // Color handled in render?
        }

        p.maxLife = p.life;
        this.particles.push(p);
    }

    render(ctx: CanvasRenderingContext2D, roadRenderer: RoadRenderer, cameraZ: number, width: number, height: number, cameraX: number): void {
        if (this.particles.length === 0) return;

        // Sort? Maybe not strictly necessary if additive blending, but good for Z-buffer feel
        // Usually particles are drawn after road, before cars.

        ctx.globalCompositeOperation = 'lighter'; // Additive blending for glows

        for (const p of this.particles) {
            // Check if visible (Z relative to camera)
            if (p.z < cameraZ + SEGMENT_LENGTH || p.z > cameraZ + SEGMENT_LENGTH * 300) continue;

            const proj = roadRenderer.projectZ(p.z, p.x, 0, cameraZ, 0, width, height, cameraX);
            if (!proj) continue;

            const { screenX, screenY, scale } = proj;

            const lifeRatio = p.life / p.maxLife;
            const alpha = lifeRatio;
            const size = p.size * scale;

            if (p.styleId === 'matrix_glitch') {
                ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                ctx.font = `${Math.ceil(size)}px monospace`;
                ctx.fillText(Math.random() > 0.5 ? '1' : '0', screenX, screenY);
                continue;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;

            if (p.styleId === 'neon_flux') {
                // Soft glow
                const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size);
                g.addColorStop(0, p.color);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.styleId === 'solar_flare') {
                // Fire blob
                ctx.beginPath();
                ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Sparkle (diamond)
                ctx.beginPath();
                ctx.moveTo(screenX, screenY - size);
                ctx.lineTo(screenX + size * 0.5, screenY);
                ctx.lineTo(screenX, screenY + size);
                ctx.lineTo(screenX - size * 0.5, screenY);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }
}
