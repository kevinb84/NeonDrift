// ============================================================
// RoadRenderer — Pseudo-3D road with finish line
// ============================================================
//
// Rendering uses modulo for visual segment repeating.
// Game logic uses raw Z for lap tracking.
// Finish line is drawn at Z positions that are multiples of TRACK_LENGTH.
// ============================================================

import {
    SEGMENT_LENGTH,
    DRAW_DISTANCE,
    TOTAL_SEGMENTS,
    TRACK_LENGTH,
    ROAD_WIDTH,
} from './constants';
import { TrackConfig, getDefaultTrack } from './TrackConfig';
import { GeneratedTrackData } from './TrackBuilder';
import { Sprite } from './TrackDefinition';

interface RoadProjection {
    screenX: number;
    screenY: number;
    screenW: number;
    scale: number;
    segIndex: number;
    worldZ: number;
    sprites?: Sprite[];
}

export class RoadRenderer {
    private _lastProjections: RoadProjection[] = []; // Cache for z-sorting or other effects

    private horizonY = 0;
    private track: TrackConfig = getDefaultTrack();
    private trackData: GeneratedTrackData | null = null;

    constructor() {
    }

    setTrack(track: TrackConfig): void {
        this.track = track;
    }

    getTrack(): TrackConfig {
        return this.track;
    }

    public setTrackData(data: GeneratedTrackData) {
        this.trackData = data;
    }

    render(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        cameraZ: number,
        playerX: number,
        cameraY: number = 0 // New parameter
    ): void {
        this.horizonY = height * 0.28;

        this.drawSky(ctx, width, height);
        this.drawSunGlow(ctx, width);
        this.drawSkyline(ctx, width, cameraZ);
        this.drawGround(ctx, width, height); // New Ground Plane
        this.drawRoad(ctx, width, height, cameraZ, playerX, cameraY);
        this.drawFog(ctx, width);
    }

    /** Project world coords to screen — works with continuous Z */
    projectZ(
        worldZ: number,
        worldX: number,
        worldY: number, // New
        cameraZ: number,
        cameraY: number, // New
        width: number,
        height: number,
        playerX: number,
    ): { screenX: number; screenY: number; scale: number } | null {
        const z = worldZ - cameraZ;
        if (z < 1) return null;

        const belowH = height - (height * 0.28);
        const scale = Math.min(SEGMENT_LENGTH / z, 1.2);

        // Pseudo-3D Elevation Formula
        const yOffset = (worldY - cameraY) * scale * (width * 0.8 / 100); // 100 arbitrary unit scaling

        // Base ground level projected
        const baseScreenY = (height * 0.28) + belowH * scale;

        // Apply elevation. 
        // If Y goes UP (positive), screenY should go UP (negative).
        const screenY = baseScreenY - yOffset;

        if (screenY < -100 || screenY > height + 100) return null;

        const roadW = ROAD_WIDTH * scale * 0.5; // 0.5 = Half width for projection
        const screenX = width / 2 - playerX * roadW + worldX * roadW;

        return { screenX, screenY, scale };
    }

    // ========== Road Drawing ==========

    private drawRoad(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        cameraZ: number,
        playerX: number,
        cameraY: number
    ): void {
        const baseSegment = Math.floor(cameraZ / SEGMENT_LENGTH);
        const projections: RoadProjection[] = [];

        let dx = 0; // Accumulated curve delta
        let x = 0;  // Accumulated lateral offset

        // Hill occlusion optimization (Painter's algo check)
        let maxScreenY = height;

        for (let n = 1; n <= DRAW_DISTANCE; n++) {
            const absSegment = baseSegment + n;
            const segmentsTotal = this.trackData ? this.trackData.totalSegments : TOTAL_SEGMENTS;
            const segIndex = ((absSegment % segmentsTotal) + segmentsTotal) % segmentsTotal;
            const segWorldZ = absSegment * SEGMENT_LENGTH;
            const z = segWorldZ - cameraZ;

            if (z < 1) continue;

            // Get Height
            let worldY = 0;
            if (this.trackData && this.trackData.height) {
                worldY = this.trackData.height[segIndex] || 0;
            }

            // Project
            const proj = this.projectZ(segWorldZ, 0, worldY, cameraZ, cameraY, width, height, playerX);
            if (!proj) continue;

            const { screenY, scale: pScale } = proj;

            if (screenY >= maxScreenY) continue;
            maxScreenY = screenY;

            const roadW = width * 0.45 * pScale;
            let curveOffset = 0;

            if (this.trackData) {
                const segmentCurve = this.trackData.curve[segIndex];
                dx += segmentCurve;
                x += dx;
                curveOffset = x * pScale * 1.5;
            } else {
                curveOffset = (
                    Math.sin(segIndex * this.track.curve.frequency) * this.track.curve.amplitude +
                    Math.sin(segIndex * this.track.curve.secondaryFreq) * this.track.curve.secondaryAmp
                ) * pScale;
            }

            // Re-adjust screenX with curve
            const finalScreenX = width / 2 + curveOffset - playerX * roadW;

            // Fetch sprites
            // Safe access to sprites
            const sprites = (this.trackData && this.trackData.sprites) ? this.trackData.sprites[segIndex] : [];

            projections.push({ ...proj, screenX: finalScreenX, screenW: roadW, segIndex, worldZ: segWorldZ, sprites });
        }

        this._lastProjections = projections;

        if (projections.length < 2) return;

        // Draw FAR → NEAR
        for (let i = projections.length - 1; i > 0; i--) {
            const far = projections[i];
            const near = projections[i - 1];
            const isEven = far.segIndex % 2 === 0;

            // Depth shading
            // const shade = Math.max(0.3, 1.0 - near.scale * 0.6);

            // City Floor (Dark Grid) - REMOVED (Handled by drawGround)
            // ctx.fillStyle = this.track.theme.grassLight; 
            // ctx.fillRect(0, far.screenY, width, near.screenY - far.screenY + 1);

            // Floor Grid (Perspective Lines)
            // if (isEven) {
            //     ctx.fillStyle = 'rgba(20, 30, 60, 0.3)';
            //     ctx.fillRect(0, far.screenY, width, near.screenY - far.screenY + 1);
            // }

            // Rumble
            ctx.fillStyle = isEven ? this.track.theme.rumbleLight : this.track.theme.rumbleDark;
            // Neon Glow for Rumble
            if (isEven) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.track.theme.rumbleLight;
            }
            this.drawPoly(ctx,
                far.screenX - far.screenW * 1.2, far.screenY,
                far.screenX + far.screenW * 1.2, far.screenY,
                near.screenX + near.screenW * 1.2, near.screenY,
                near.screenX - near.screenW * 1.2, near.screenY
            );
            ctx.shadowBlur = 0;

            // Sidewalk / Gutter
            ctx.fillStyle = isEven ? this.track.theme.sidewalkLight : this.track.theme.sidewalkDark;
            this.drawPoly(ctx,
                far.screenX - far.screenW * 1.05, far.screenY,
                far.screenX + far.screenW * 1.05, far.screenY,
                near.screenX + near.screenW * 1.05, near.screenY,
                near.screenX - near.screenW * 1.05, near.screenY
            );

            // Road surface
            const isFinishLine = this.isFinishLineSegment(far.worldZ);
            if (isFinishLine) {
                this.drawFinishLine(ctx, far, near);
            } else {
                ctx.fillStyle = isEven ? this.track.theme.roadLight : this.track.theme.roadDark;
                this.drawPoly(ctx,
                    far.screenX - far.screenW, far.screenY,
                    far.screenX + far.screenW, far.screenY,
                    near.screenX + near.screenW, near.screenY,
                    near.screenX - near.screenW, near.screenY
                );
            }

            // Lane Markings (4 Lanes -> 3 dividers)
            if (isEven && !isFinishLine) {
                ctx.fillStyle = this.track.theme.laneMarker;
                const lanes = [-0.5, 0, 0.5];

                for (const lane of lanes) {
                    const mw1 = far.screenW * 0.01;
                    const mw2 = near.screenW * 0.01;
                    const mx1 = far.screenX + lane * far.screenW * 2;
                    const mx2 = near.screenX + lane * near.screenW * 2;

                    this.drawPoly(ctx,
                        mx1 - mw1, far.screenY, mx1 + mw1, far.screenY,
                        mx2 + mw2, near.screenY, mx2 - mw2, near.screenY
                    );
                }
            }

            // Draw Sprites
            if (far.sprites && far.sprites.length > 0) {
                this.drawSprites(ctx, far, width, height); // Pass width/height to drawSprites
            }
        }

        // Fill bottom gap
        const nearest = projections[0];
        if (nearest && nearest.screenY < height) {
            const darkShade = 0.4;
            const darkRoad = Math.floor(107 * darkShade);

            ctx.fillStyle = this.track.theme.grassDark;
            ctx.fillRect(0, nearest.screenY, width, height - nearest.screenY + 1);

            ctx.fillStyle = this.track.theme.rumbleDark;
            const bRumble = nearest.screenW * 1.2;
            ctx.fillRect(nearest.screenX - bRumble, nearest.screenY, bRumble * 2, height - nearest.screenY + 1);

            ctx.fillStyle = `rgb(${Math.floor(168 * darkShade)}, ${Math.floor(168 * darkShade)}, ${Math.floor(168 * darkShade)})`;
            const bSide = nearest.screenW * 1.08;
            ctx.fillRect(nearest.screenX - bSide, nearest.screenY, bSide * 2, height - nearest.screenY + 1);

            ctx.fillStyle = `rgb(${darkRoad}, ${darkRoad}, ${darkRoad})`;
            ctx.fillRect(nearest.screenX - nearest.screenW, nearest.screenY, nearest.screenW * 2, height - nearest.screenY + 1);
        }
    }

    private drawGround(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const hY = this.horizonY;
        const grad = ctx.createLinearGradient(0, hY, 0, height);
        grad.addColorStop(0, '#020205'); // Horizon Black
        grad.addColorStop(1, '#0a0a14'); // Bottom Dark Gray
        ctx.fillStyle = grad;
        ctx.fillRect(0, hY, width, height - hY);
    }

    private drawSprites(ctx: CanvasRenderingContext2D, segment: any, width: number, height: number): void {
        for (const sprite of segment.sprites) {
            const scale = segment.scale;

            // Correct Offset: 1.0 = Edge of Road. 
            // segment.screenW is Half-Width of road.
            // So Edge = screenX + screenW.
            // Formula: screenX + offset * screenW.
            const sx = segment.screenX + (sprite.offset * segment.screenW);
            const sy = segment.screenY;

            // Draw based on type
            if (sprite.type === 'LIGHT_POST') {
                // Simple Neon Pole
                const h = 250 * scale * (height / 1000);
                const w = 8 * scale * (width / 1000);

                ctx.fillStyle = '#444';
                ctx.fillRect(sx - w / 2, sy - h, w, h);

                // Light bulb
                ctx.fillStyle = '#00ffff';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00ffff';
                ctx.beginPath();
                ctx.arc(sx - w * 3, sy - h, w * 6, 0, Math.PI * 2); // Hanging lamp
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            else if (sprite.type === 'BILLBOARD') {
                const bw = 150 * scale * (width / 1000);
                const bh = 80 * scale * (height / 1000);
                const lift = 120 * scale * (height / 1000);

                // Pole
                ctx.fillStyle = '#333';
                ctx.fillRect(sx - bw * 0.05, sy - lift, bw * 0.1, lift);

                // Board
                ctx.fillStyle = '#ff00ff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff00ff';
                ctx.fillRect(sx - bw / 2, sy - lift - bh, bw, bh);
                ctx.shadowBlur = 0;

                // Text simulation
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx - bw * 0.4, sy - lift - bh * 0.7, bw * 0.8, bh * 0.1);
                ctx.fillRect(sx - bw * 0.4, sy - lift - bh * 0.5, bw * 0.6, bh * 0.1);
            }
            else if (sprite.type.startsWith('BUILDING')) {
                // Building
                const stableRand = Math.abs(Math.sin(sprite.offset * segment.segIndex));
                // Use width/height in calculation
                const bw = 300 * scale * (width / 1000) * (0.8 + stableRand * 0.4);
                const bh = (sprite.type === 'BUILDING_FAR' ? 800 : 400) * scale * (height / 1000) * (1.0 + stableRand * 0.5);

                const trackTheme = this.track.theme;
                const buildingColors = trackTheme.buildingColors || ['#100a1e'];

                // Deterministic random color
                const color = buildingColors[Math.floor(stableRand * buildingColors.length)];

                ctx.fillStyle = color;
                ctx.fillRect(sx - bw / 2, sy - bh, bw, bh);

                // Windows
                ctx.fillStyle = sprite.offset > 0 ? '#00e5ff' : '#ff0055'; // Color by side
                const winSize = 6 * scale;
                const gap = 8 * scale;

                if (winSize > 1) { // LOD
                    for (let wy = 20 * scale; wy < bh; wy += gap + winSize) {
                        for (let wx = 10 * scale; wx < bw - 10 * scale; wx += gap + winSize) {
                            // "Random" but stable window pattern
                            if (Math.sin(wx * wy * segment.segIndex) > 0.0) continue;
                            const wxp = sx - bw / 2 + wx;
                            const wyp = sy - bh + wy;
                            ctx.fillRect(wxp, wyp, winSize, winSize);
                        }
                    }
                }

                // Roof glow / Airline light
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(sx, sy - bh - 5 * scale, 4 * scale, 4 * scale);
            }
        }
    }

    private trackLength: number = TRACK_LENGTH;

    public setTrackLength(length: number): void {
        this.trackLength = length;
    }

    /** Check if a world Z position is near a finish/start line */
    private isFinishLineSegment(worldZ: number): boolean {
        const length = this.trackLength || TRACK_LENGTH;
        const posInLap = ((worldZ % length) + length) % length;
        return posInLap < SEGMENT_LENGTH * 3; // First 3 segments of each lap
    }

    /** Draw a checkerboard pattern for the finish line */
    private drawFinishLine(
        ctx: CanvasRenderingContext2D,
        far: typeof this._lastProjections[0],
        near: typeof this._lastProjections[0]
    ): void {
        // White base
        ctx.fillStyle = '#ffffff';
        this.drawPoly(ctx,
            far.screenX - far.screenW, far.screenY,
            far.screenX + far.screenW, far.screenY,
            near.screenX + near.screenW, near.screenY,
            near.screenX - near.screenW, near.screenY
        );

        // Black checkers
        ctx.fillStyle = '#000000';
        const checkerCount = 8;
        for (let c = 0; c < checkerCount; c++) {
            if (c % 2 === (far.segIndex % 2)) continue; // Alternating pattern

            const t0 = c / checkerCount;
            const t1 = (c + 1) / checkerCount;

            const x0f = far.screenX - far.screenW + t0 * far.screenW * 2;
            const x1f = far.screenX - far.screenW + t1 * far.screenW * 2;
            const x0n = near.screenX - near.screenW + t0 * near.screenW * 2;
            const x1n = near.screenX - near.screenW + t1 * near.screenW * 2;

            this.drawPoly(ctx, x0f, far.screenY, x1f, far.screenY, x1n, near.screenY, x0n, near.screenY);
        }
    }

    // ========== Environment ==========

    private drawSky(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
        const hY = this.horizonY;
        const grad = ctx.createLinearGradient(0, 0, 0, hY + 30);
        const t = this.track.theme;
        // Create gradient from skyTop to skyBottom
        grad.addColorStop(0, this.darkenHex(t.skyTop, 0.3));
        grad.addColorStop(0.3, t.skyTop);
        // Force bottom to dark city color for blending
        grad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, hY + 30);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 50; i++) {
            const sx = (i * 7919) % w;
            const sy = (i * 6271) % (hY * 0.6);
            ctx.beginPath();
            ctx.arc(sx, sy, (i % 4 === 0) ? 1.5 : 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawSunGlow(ctx: CanvasRenderingContext2D, width: number): void {
        const hY = this.horizonY;
        const sunX = width * 0.65;

        const glow = ctx.createRadialGradient(sunX, hY, 0, sunX, hY, 180);
        glow.addColorStop(0, 'rgba(255, 180, 80, 0.3)');
        glow.addColorStop(0.4, 'rgba(255, 120, 50, 0.1)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sunX - 200, hY - 200, 400, 250);

        const core = ctx.createRadialGradient(sunX, hY - 3, 0, sunX, hY - 3, 20);
        core.addColorStop(0, 'rgba(255, 240, 200, 0.8)');
        core.addColorStop(0.6, 'rgba(255, 200, 100, 0.3)');
        core.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(sunX, hY - 3, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawSkyline(ctx: CanvasRenderingContext2D, w: number, cameraZ: number): void {
        const hY = this.horizonY;

        // 0. Atmosphere: Searchlights
        this.drawSearchlights(ctx, w, hY);

        // 1. Far Layer: Massive Mega-Structures (Slow, Dark, Huge)
        // Parallax factor: 0.02
        this.drawCityLayer(ctx, w, hY, cameraZ, {
            parallax: 0.002,
            baseSize: 30, // Number of buildings
            minHeight: 100, maxHeight: 250,
            minWidth: 60, maxWidth: 150,
            colorBase: [10, 10, 20], // Very dark blue/black
            colorNeon: [50, 50, 100], // Faint glow
            zOrder: 0
        });

        // 2. Mid Layer: The Main City (Dense, Neon, Diverse)
        // Parallax factor: 0.05
        this.drawCityLayer(ctx, w, hY, cameraZ, {
            parallax: 0.005,
            baseSize: 50,
            minHeight: 50, maxHeight: 180,
            minWidth: 40, maxWidth: 100,
            colorBase: [20, 30, 50], // Navy
            colorNeon: [0, 255, 255], // Cyan/Pink variance handled in method
            zOrder: 1
        });

        // 3. Near Layer: Foreground Detail (Darker silhouette to frame, or brighter?)
        // Usually visually darker if "close" but unlit, or brighter if streetlights.
        // Let's go with dark silhouette with bright ads.
        this.drawCityLayer(ctx, w, hY, cameraZ, {
            parallax: 0.01,
            baseSize: 40,
            minHeight: 20, maxHeight: 80,
            minWidth: 30, maxWidth: 80,
            colorBase: [10, 15, 30],
            colorNeon: [255, 0, 128],
            zOrder: 2
        });
    }

    private drawSearchlights(ctx: CanvasRenderingContext2D, w: number, hY: number): void {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const t = Date.now() * 0.0005;

        for (let i = 0; i < 5; i++) {
            const x = (w * 0.2) + (i * w * 0.15) + Math.sin(t + i) * 100;
            const angle = Math.sin(t * 0.5 + i * 1.3) * 0.3;

            const grad = ctx.createLinearGradient(x, hY, x + Math.sin(angle) * 400, hY - 400);
            grad.addColorStop(0, 'rgba(200, 230, 255, 0.15)');
            grad.addColorStop(1, 'rgba(200, 230, 255, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x - 10, hY);
            ctx.lineTo(x + 10, hY);
            ctx.lineTo(x + Math.sin(angle) * 400 + 40, hY - 400);
            ctx.lineTo(x + Math.sin(angle) * 400 - 40, hY - 400);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawCityLayer(
        ctx: CanvasRenderingContext2D,
        w: number,
        hY: number,
        cameraZ: number,
        config: {
            parallax: number,
            baseSize: number,
            minHeight: number, maxHeight: number,
            minWidth: number, maxWidth: number,
            colorBase: number[],
            colorNeon: number[],
            zOrder: number
        }
    ): void {
        // We need a continuous scroll.
        // Screen width 'w' is the viewport.
        // We track 'cameraZ * parallax' as the visual position.
        // We render building blocks based on a virtual index.

        const virtualWidth = 2000; // The repeating unit width
        const scrollX = (cameraZ * config.parallax * 10) % virtualWidth; // 10 is arbitrary scale for pixels/meter

        // Render enough copies to fill screen + overflow
        const count = config.baseSize;
        const step = virtualWidth / count;

        for (let i = 0; i < count; i++) {
            // Deterministic Random
            const seed = (i + 1) * (config.zOrder + 1) * 9277;
            const r1 = Math.abs(Math.sin(seed));
            const r2 = Math.abs(Math.cos(seed * 0.5));
            const r3 = Math.abs(Math.sin(seed * 2.1));

            let bx = (i * step) - scrollX;
            if (bx < -200) bx += virtualWidth;
            if (bx > w) bx -= virtualWidth;

            // Still off screen?
            if (bx < -200 || bx > w + 200) {
                const baseX = i * step;
                let viewX = (baseX - scrollX) % virtualWidth;
                if (viewX < -200) viewX += virtualWidth;
                else if (viewX > w) viewX -= virtualWidth;

                bx = viewX;
            }

            // Final cull
            if (bx < -200 || bx > w + 200) continue;

            const bw = config.minWidth + r1 * (config.maxWidth - config.minWidth);
            const bh = config.minHeight + r2 * (config.maxHeight - config.minHeight);

            // Style
            // Base Color Gradient
            const [r, g, b] = config.colorBase;
            const style = ctx.createLinearGradient(0, hY - bh, 0, hY);
            style.addColorStop(0, `rgb(${r + r2 * 30}, ${g + r2 * 30}, ${b + r2 * 50})`); // Lighter top
            style.addColorStop(1, `rgb(${r}, ${g}, ${b})`); // Dark base

            ctx.fillStyle = style;

            // Shape Type
            const shapeType = Math.floor(r3 * 5); // 0=Rect, 1=Taper, 2=Spire, 3=Antenna

            if (shapeType === 1) {
                // Tapered
                ctx.beginPath();
                ctx.moveTo(bx, hY);
                ctx.lineTo(bx + bw * 0.1, hY - bh);
                ctx.lineTo(bx + bw * 0.9, hY - bh);
                ctx.lineTo(bx + bw, hY);
                ctx.fill();
            } else if (shapeType === 2) {
                // Spire
                ctx.beginPath();
                ctx.moveTo(bx, hY);
                ctx.lineTo(bx + bw * 0.5, hY - bh * 1.2);
                ctx.lineTo(bx + bw, hY);
                ctx.fill();
            } else {
                // Rect
                ctx.fillRect(bx, hY - bh, bw, bh);
            }

            // Windows / Neon
            // Only for Mid/Near layers
            if (config.zOrder > 0) {
                const hasWindows = r1 > 0.3;
                if (hasWindows) {
                    // Window Color: Cyan, Magenta, or Yellow
                    const wc = r2 > 0.6 ? '255, 0, 128' : (r2 > 0.3 ? '0, 255, 255' : '255, 255, 0');
                    ctx.fillStyle = `rgba(${wc}, ${0.3 + r3 * 0.5})`;

                    // Grid or Stripes?
                    const pattern = r3 > 0.5 ? 'grid' : 'stripes';

                    if (pattern === 'grid') {
                        const cols = 3 + Math.floor(r1 * 4);
                        const rows = 5 + Math.floor(r2 * 10);
                        const gap = 4;
                        const winW = (bw - (cols + 1) * gap) / cols;
                        const winH = (bh * 0.8 - (rows + 1) * gap) / rows;

                        for (let ci = 0; ci < cols; ci++) {
                            for (let ri = 0; ri < rows; ri++) {
                                // Randomly skip windows for "lived in" look
                                if (Math.sin(ci * ri * i) > 0.7) continue;
                                ctx.fillRect(bx + gap + ci * (winW + gap), hY - bh + 10 + ri * (winH + gap), winW, winH);
                            }
                        }
                    } else {
                        // Horizontal Stripes
                        const rows = 4 + Math.floor(r2 * 8);
                        const gap = 8;
                        const winH = 2;
                        for (let ri = 0; ri < rows; ri++) {
                            ctx.fillRect(bx + 5, hY - bh + 10 + ri * gap, bw - 10, winH);
                        }
                    }
                }

                // Roof Light / Antenna
                if (r3 > 0.6) {
                    ctx.fillStyle = r3 > 0.8 ? '#ff0000' : '#ffffff';
                    ctx.fillRect(bx + bw / 2 - 1, hY - bh - 10, 2, 10);
                    // Blink light
                    if (Math.sin(Date.now() * 0.01 + i) > 0) {
                        ctx.shadowBlur = 5;
                        ctx.shadowColor = ctx.fillStyle as string;
                        ctx.fillRect(bx + bw / 2 - 2, hY - bh - 12, 4, 4);
                        ctx.shadowBlur = 0;
                    }
                }
            }
        }
    }

    private drawFog(ctx: CanvasRenderingContext2D, width: number): void {
        const hY = this.horizonY;

        // 1. Distance Fog (Horizon blend)
        const fog = ctx.createLinearGradient(0, hY - 30, 0, hY + 100);
        fog.addColorStop(0, 'rgba(10, 10, 20, 0.8)'); // Dark Navy/Black matches city base
        fog.addColorStop(0.4, 'rgba(10, 10, 20, 0.8)'); // Solid band at horizon
        fog.addColorStop(1, 'rgba(10, 10, 20, 0)'); // Fade out down the road

        ctx.fillStyle = fog;
        ctx.fillRect(0, hY - 30, width, 130);
    }

    private drawPoly(
        ctx: CanvasRenderingContext2D,
        x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number
    ): void {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    }

    // ========== Color Helpers ==========

    private hexToRgb(hex: string): [number, number, number] {
        const h = hex.replace('#', '');
        return [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16),
        ];
    }

    private darkenHex(hex: string, factor: number): string {
        const [r, g, b] = this.hexToRgb(hex);
        return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
    }
}
