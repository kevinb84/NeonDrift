import { TrackSegment, TrackPoint, TrackData, Sprite } from './TrackDefinition';
import { SEGMENT_LENGTH } from './constants';

export interface GeneratedTrackData {
    curve: number[]; // Curve offset per segment
    height: number[]; // Height offset per segment
    sprites: Sprite[][]; // Sprites per segment
    totalSegments: number;
}

export class TrackBuilder {

    /**
     * Builds the curve and height arrays for RoadRenderer.
     */
    public build(segments: TrackSegment[]): GeneratedTrackData {
        const rawCurves: number[] = [];
        const rawHeights: number[] = [];
        const sprites: Sprite[][] = [];

        // 1. Generate Raw Data
        let totalSteps = 0;

        for (const segment of segments) {
            const segCount = Math.ceil(segment.length / SEGMENT_LENGTH);
            const curveStrength = this.calculateCurveStrength(segment);

            // Use segment.height as a target amplitude or multiplier if provided, else default rolling hills
            const heightMult = segment.height !== undefined ? segment.height : 200;

            for (let i = 0; i < segCount; i++) {
                rawCurves.push(curveStrength);

                // Continuous rolling hills
                // Math.sin(index / wavelength) * amplitude
                // Using totalSteps to ensure continuity across segments
                // Wavelength 40 segments roughly 800-1000m

                const h = Math.sin(totalSteps / 40) * heightMult;
                rawHeights.push(h);

                // --- Sprite Generation ---
                const segSprites: Sprite[] = [];

                // 1. Street Lights (Every 3 segments = ~90m)
                if (totalSteps % 3 === 0) {
                    segSprites.push({ type: 'LIGHT_POST', offset: -1.2 }); // Left
                    segSprites.push({ type: 'LIGHT_POST', offset: 1.2 });  // Right
                }

                // 2. Skyscrapers (Dense "Canyon" Effect - Attached to Road)
                // Left Side (Offset -1.1 to -1.5)
                if (Math.random() > 0.05) { // 95% density
                    segSprites.push({
                        type: Math.random() > 0.7 ? 'BUILDING_FAR' : 'BUILDING_NEAR',
                        offset: -1.1 - Math.random() * 0.4
                    });
                }
                // Right Side (Offset 1.1 to 1.5)
                if (Math.random() > 0.05) {
                    segSprites.push({
                        type: Math.random() > 0.7 ? 'BUILDING_FAR' : 'BUILDING_NEAR',
                        offset: 1.1 + Math.random() * 0.4
                    });
                }

                // 3. Billboards (Occasional)
                if (Math.random() > 0.98) {
                    const side = Math.random() > 0.5 ? 1 : -1;
                    segSprites.push({ type: 'BILLBOARD', offset: side * 1.3 });
                }

                // 4. Custom Segment Sprites
                if (segment.sprites) {
                    if (i === 0) {
                        segSprites.push(...segment.sprites);
                    }
                }

                sprites.push(segSprites);

                totalSteps++;
            }
        }

        // 2. Smooth Transitions
        // We iterate through the raw array and apply a running average or ease-in/out
        const smoothCurves: number[] = [];
        // Heights are already smooth via Sine, but we could smooth them if we had abrupt changes
        // For now, let's keep heights as is since they are generated continuously.

        for (let i = 0; i < rawCurves.length; i++) {
            // Simple sliding window average
            let sum = 0;
            let count = 0;
            const range = 6; // Smoothing window
            for (let j = -range; j <= range; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < rawCurves.length) {
                    sum += rawCurves[idx];
                    count++;
                }
            }
            smoothCurves.push(sum / count);
        }

        // Loop Closure: Ensure final accumulated curve (dx) is 0
        // If not, the track spirals. We distribute the error across all segments.
        let totalDx = 0;
        for (const c of smoothCurves) totalDx += c;

        // If significant drift, correct it
        if (Math.abs(totalDx) > 0.1) {
            const correction = -totalDx / smoothCurves.length;
            for (let i = 0; i < smoothCurves.length; i++) {
                smoothCurves[i] += correction;
            }
        }

        return {
            curve: smoothCurves,
            height: rawHeights,
            sprites: sprites,
            totalSegments: smoothCurves.length
        };
    }


    /**
     * Generates a 2D world-space spline from the track segments.
     * This is the "Truth" for physics and gameplay logic.
     */
    public generateSpline(segments: TrackSegment[]): TrackData {
        const points: TrackPoint[] = [];
        let currentX = 0;
        let currentY = 0;
        let currentHeading = Math.PI / 2; // Start Facing UP (Standard: 0=Right, 90=Up)
        let totalDistance = 0;

        // Resolution: How many meters per physics point?
        // Lower = more accurate but more memory. 1-2 meters is good for racing.
        const STEP_SIZE = 10; // Increased step size since world is 100x larger

        for (const segment of segments) {
            const length = segment.length;
            const steps = Math.ceil(length / STEP_SIZE);

            // Determine segment properties
            let curvature = 0; // 1/radius
            if (segment.type === 'curve_left' || segment.type === 'hairpin_left') {
                // Turning Left = Increasing Angle (CCW)
                curvature = 1 / (segment.radius || 200);
            } else if (segment.type === 'curve_right' || segment.type === 'hairpin_right') {
                // Turning Right = Decreasing Angle (CW)
                curvature = -1 / (segment.radius || 200);
            } else if (segment.type === 'wide_curve') {
                // Angle positive usually means Right in track defs?
                // If angle > 0 (Right) -> curvature negative
                const dir = (segment.angle && segment.angle > 0) ? -1 : 1;
                curvature = dir / (segment.radius || 400);
            } else if (segment.type === 'chicane') {
                curvature = 0;
            }

            // Apply Loop Closure Bias
            if (segment.curvatureBias) {
                curvature += segment.curvatureBias;
            }

            for (let i = 0; i < steps; i++) {
                const distStep = STEP_SIZE;
                totalDistance += distStep;

                // Update Heading
                currentHeading += curvature * distStep;

                // Update Position (Standard Vector: cos, -sin)
                const dx = Math.cos(currentHeading);
                const dy = -Math.sin(currentHeading);

                currentX += dx * distStep;
                currentY += dy * distStep;

                points.push({
                    x: currentX,
                    y: currentY,
                    dx: dx,
                    dy: dy,
                    width: segment.width,
                    curvature: curvature,
                    distance: totalDistance
                });
            }
        }

        // --- 2. Linear Drift Correction (Loop Closure) ---
        // If it's a loop (which it is), the last point should equal the first point (0,0 implied).
        // Calculate the gap.
        const endP = points[points.length - 1];
        const gapX = endP.x - 0; // Target is 0
        const gapY = endP.y - 0; // Target is 0

        // Distribute error linearly along the path
        for (const p of points) {
            const ratio = p.distance / totalDistance;
            p.x -= gapX * ratio;
            p.y -= gapY * ratio;
        }

        // Recalculate headings (tangents) after warping
        // This is important because warping changes the shape slightly
        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            // Simple finite difference
            let dx = next.x - curr.x;
            let dy = next.y - curr.y;
            // Handle wrap-around math for distance
            if (i === points.length - 1) {
                // Approximate with previous vector or re-eval
                // For a perfect loop, next (0) is at 0,0. 
                // But next is relative to curr? No, points are world coords.
                // dx, dy correct.
            }
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
                curr.dx = dx / len;
                curr.dy = dy / len;
            }
        }

        // --- 3. Angular/Heading Correction (FINAL PASSS) ---
        // MUST be done AFTER position warp and tangent recalculation.
        // The tangent at the end must match the tangent at the start.

        // Get final heading from the recalculated tangents
        const finalP = points[points.length - 1];
        // Heading = atan2(-dy, dx)
        const finalHeading = Math.atan2(-finalP.dy, finalP.dx);
        // accumulatedHeading from generation is lost, but we can infer 'rounds' 
        // by comparing finalHeading to startHeading (PI/2).
        // Since track is a closed loop, it likely did +/- 2PI.
        // We just need to snap to PI/2.

        // Error = difference between current end heading and PI/2
        // We know start was PI/2.
        let val = finalHeading - (Math.PI / 2);
        // Normalize to -PI..PI
        while (val < -Math.PI) val += Math.PI * 2;
        while (val > Math.PI) val -= Math.PI * 2;

        const headingErrorFinal = val;

        // Distribute heading error linearly
        // Rotate each point's dx/dy by +error * ratio (Sign flipped)
        for (const p of points) {
            const ratio = p.distance / totalDistance;
            const correction = headingErrorFinal * ratio;

            // Rotate dx, dy
            const cos = Math.cos(correction);
            const sin = Math.sin(correction);

            const newDx = p.dx * cos - p.dy * sin;
            const newDy = p.dx * sin + p.dy * cos;

            p.dx = newDx;
            p.dy = newDy;
        }

        return {
            points,
            totalLength: totalDistance,
            startIndex: 0
        };
    }

    private calculateCurveStrength(segment: TrackSegment): number {
        // ... (Existing implementation kept for render legacy compatibility if needed)
        // Tuned constants for pseudo-3D feel
        // These values represent the X-offset PER SEGMENT.
        // A value of 2 means the road shifts 2 units laterally per segment.
        // Over 100 segments, that's 200 units.

        const BASE_CURVE = 3;

        switch (segment.type) {
            case 'straight': return 0;
            case 'curve_left': return -BASE_CURVE * (200 / (segment.radius || 200));
            case 'curve_right': return BASE_CURVE * (200 / (segment.radius || 200));
            case 'hairpin_left': return -BASE_CURVE * 2.5;
            case 'hairpin_right': return BASE_CURVE * 2.5;
            case 'chicane':
                return BASE_CURVE * 1.5;
            case 'wide_curve':
                return BASE_CURVE * 0.5 * (segment.angle && segment.angle > 0 ? 1 : -1);
            default: return 0;
        }
    }

    /**
     * Projects a 2D world position onto the track spline to find progress (Z) and lateral offset (X).
     * @param track The generated track data
     * @param x World X
     * @param y World Y
     * @param lastIndex Optional optimization hint (last known index)
     */
    public static getTrackPosition(track: TrackData, x: number, y: number, lastIndex: number = 0): { distance: number; offset: number; heading: number; index: number } {
        let closestPoint: TrackPoint = track.points[0];
        let closestIndex = 0;
        let minDistSq = Number.MAX_VALUE;

        // Optimization: Search window around last known position
        // If we have a hint, search e.g. -50 to +200 points (Forward bias)
        // If lost/reset (lastIndex=0 or -1), brute force?

        const SEARCH_RADIUS = 25; // Look ahead/behind 25 points (~250 units).
        const totalPoints = track.points.length;

        // Get tangent of last known position for directional consistency
        const lastP = track.points[lastIndex % totalPoints];

        let useWindow = true;

        if (useWindow) {
            for (let offset = -SEARCH_RADIUS; offset <= SEARCH_RADIUS; offset++) {
                let idx = (lastIndex + offset);
                // Wrap index
                while (idx < 0) idx += totalPoints;
                while (idx >= totalPoints) idx -= totalPoints;

                const p = track.points[idx];

                // Directional Check: Prevent latching onto track sections going opposite way (hairpins)
                // Dot product of tangents > 0 means within 90 degrees.
                const dot = p.dx * lastP.dx + p.dy * lastP.dy;
                if (dot < 0) continue;

                const dx = p.x - x;
                const dy = p.y - y;
                const dSq = dx * dx + dy * dy;

                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestPoint = p;
                    closestIndex = idx;
                }
            }
        } else {
            // Brute force fallback (restored for safety, though unused if useWindow=true)
            for (let i = 0; i < totalPoints; i++) {
                const p = track.points[i];
                const dx = p.x - x;
                const dy = p.y - y;
                const dSq = dx * dx + dy * dy;
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestPoint = p;
                    closestIndex = i;
                }
            }
        }

        // Safety: If closest point is wildly far (> 5000 units), maybe we are "Lost"?
        // Fallback to global search if local failed?
        if (minDistSq > 5000 * 5000) {
            // ... brute force ...
            minDistSq = Number.MAX_VALUE;
            for (let i = 0; i < totalPoints; i++) {
                const p = track.points[i];

                // Directional Check also for Global Search
                // If we are lost, we might not trust 'lastIndex', but we trust 'heading'?
                // lastP is based on lastIndex. If lastIndex is wrong, this check is wrong.
                // But generally, we want to find the track segment flowing in the same direction as *before* we got lost.
                const dot = p.dx * lastP.dx + p.dy * lastP.dy;
                if (dot < -0.5) continue; // Allow some slack, but filtering outright opposites is good.

                const dx = p.x - x;
                const dy = p.y - y;
                const dSq = dx * dx + dy * dy;
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestPoint = p;
                    closestIndex = i;
                }
            }
        }

        // Tangent vector (dx, dy)
        const tangentX = closestPoint.dx;
        const tangentY = closestPoint.dy;

        // Perpendicular vector for "Right"
        // Rotate Tangent -90 degrees (CW)
        const perpX = -closestPoint.dy;
        const perpY = closestPoint.dx;

        // Vector from Track Point to Car
        const vX = x - closestPoint.x;
        const vY = y - closestPoint.y;

        // Lateral Offset (Project V onto Perp)
        const offset = vX * perpX + vY * perpY;

        // Forward progress (Project V onto Tangent)
        const forwardProj = vX * tangentX + vY * tangentY;

        let distance = closestPoint.distance + forwardProj;

        // Handle Loop Wrap
        if (distance < 0) distance += track.totalLength;
        if (distance > track.totalLength) distance -= track.totalLength;

        const header = Math.atan2(-closestPoint.dy, closestPoint.dx);

        return {
            distance: distance,
            offset: offset,
            heading: header,
            index: closestIndex
        };
    }
}
