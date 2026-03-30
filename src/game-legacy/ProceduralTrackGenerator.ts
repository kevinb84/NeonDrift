import { TrackSegment, TrackSegmentType } from './TrackDefinition';
import { DifficultyTier } from './DifficultyConfig';

import { TrackBuilder } from './TrackBuilder';

interface TrackCandidate {
    segments: TrackSegment[];
    endX: number;
    endY: number;
    endHeading: number;
    score: number;
}

export class ProceduralTrackGenerator {

    private readonly MAX_ATTEMPTS = 50;
    private trackBuilder = new TrackBuilder();

    public generate(tier: DifficultyTier): TrackSegment[] {
        let bestCandidate: TrackCandidate | null = null;
        let minScore = Number.MAX_VALUE;

        // Monte Carlo: Generate multiple candidates and pick the one that closes best
        for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
            const candidate = this.tryGenerate(tier);
            if (candidate.score < minScore) {
                minScore = candidate.score;
                bestCandidate = candidate;
            }

            // Early exit if good enough closure
            if (candidate.score < 100) break;
        }

        if (!bestCandidate) {
            // Fallback (unlikely)
            return this.tryGenerate(tier).segments;
        }

        // Apply Warp Correction to close the loop perfectly
        return this.warpCorrection(bestCandidate);
    }

    private tryGenerate(tier: DifficultyTier): TrackCandidate {
        const segments: TrackSegment[] = [];

        // Configuration based on tier
        let minSegments = 30;
        let maxSegments = 50;
        let allowedTypes: TrackSegmentType[] = ['straight', 'curve_left', 'curve_right', 'wide_curve'];

        if (tier === 'HARD') {
            minSegments = 50;
            maxSegments = 80;
            allowedTypes.push('chicane');
            // Bias towards complexity
        } else if (tier === 'EXTREME') {
            minSegments = 80;
            maxSegments = 120;
            allowedTypes.push('chicane', 'hairpin_left', 'hairpin_right');
        }

        const targetCount = Math.floor(Math.random() * (maxSegments - minSegments + 1)) + minSegments;

        // Ensure start is always a straight
        segments.push({ type: 'straight', length: 400, width: 80 });

        // Simulate State using TrackBuilder (Ground Truth)
        // Initial state after first segment
        let tempSpline = this.trackBuilder.generateSpline(segments);
        let currentPoint = tempSpline.points[tempSpline.points.length - 1];

        let currentX = currentPoint.x;
        let currentY = currentPoint.y;
        // Calculate heading from derivative (TrackBuilder stores dx, dy as tangent)
        // Heading = atan2(-dy, dx)
        let currentHeading = Math.atan2(-currentPoint.dy, currentPoint.dx);

        let currentCount = 1;

        // Guided Random Walk
        while (currentCount < targetCount) {
            // Sector Logic:
            // First 50%: Random
            // Last 50%: Bias towards start
            const progress = currentCount / targetCount;

            let type = this.getRandomType(allowedTypes);

            // Bias logic
            if (progress > 0.6) {
                // Calculate desired heading to origin
                const dx = 0 - currentX;
                const dy = 0 - currentY; // Target 0,0
                const distToHome = Math.sqrt(dx * dx + dy * dy);

                if (distToHome > 0) {
                    // Standard atan2(dy, dx) gives angle from Right (CCW)
                    // But Y is inverted (-Y Up). 
                    // Let's rely on vector math. 
                    const desiredHeading = Math.atan2(-dy, dx); // Standard math with inverted Y

                    // Diff
                    let diff = desiredHeading - currentHeading;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    // If diff > 0, we need to turn Left (increase heading).
                    // If diff < 0, turn Right.

                    if (diff > 0.2) {
                        type = Math.random() > 0.5 ? 'curve_left' : 'wide_curve';
                        if (type === 'wide_curve') { /* Handled below */ }
                    } else if (diff < -0.2) {
                        type = Math.random() > 0.5 ? 'curve_right' : 'wide_curve';
                    }
                }
            }

            let length = 200;
            let radius = 0;
            let angle = 0;

            if (type === 'straight') {
                length = 200 + Math.random() * 400;
            } else if (type === 'curve_left' || type === 'curve_right') {
                length = 300 + Math.random() * 300;
                radius = 150 + Math.random() * 200;
                // angle unused by simulate, driven by radius/length
            } else if (type === 'wide_curve') {
                length = 500 + Math.random() * 500;
                radius = 400 + Math.random() * 400;
                angle = 30 + Math.random() * 30;

                // Determine Direction based on Bias
                if (progress <= 0.6) {
                    if (Math.random() > 0.5) angle = -angle;
                } else {
                    // Recalculate bias direction
                    const dx = -currentX; const dy = -currentY;
                    const desired = Math.atan2(-dy, dx);
                    let diff = desired - currentHeading;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    // angle > 0 means Right Turn (CW) -> Negative Curvature -> Decreasing Heading
                    // angle < 0 means Left Turn (CCW) -> Positive Curvature -> Increasing Heading

                    if (diff > 0) {
                        // Want to turn Left (Increase Heading) => angle < 0
                        angle = -Math.abs(angle);
                    } else {
                        // Want to turn Right (Decrease Heading) => angle > 0
                        angle = Math.abs(angle);
                    }
                }

            } else if (type === 'hairpin_left' || type === 'hairpin_right') {
                length = 150;
                radius = 40;
            } else if (type === 'chicane') {
                length = 150 + Math.random() * 100;
            }

            const seg: TrackSegment = {
                type,
                length,
                width: 70 + Math.random() * 20,
                radius,
                angle,
                height: (Math.random() - 0.5) * 5
            };

            // Push and Validate
            segments.push(seg);

            // Update State via TrackBuilder
            tempSpline = this.trackBuilder.generateSpline(segments);
            currentPoint = tempSpline.points[tempSpline.points.length - 1];
            currentX = currentPoint.x;
            currentY = currentPoint.y;
            currentHeading = Math.atan2(-currentPoint.dy, currentPoint.dx);

            currentCount++;

            // Check if we just crossed near 0,0
            const distSq = currentX * currentX + currentY * currentY;
            if (progress > 0.8 && distSq < 150 * 150) { // Slight relaxation
                break;
            }
        }

        // Ensure final segment attempts to align heading
        // Start Heading was PI/2.
        // Current Heading.
        // We want Final Heading = PI/2 + 2PI*k

        // Calculate Score
        // 1. Distance to origin
        const dX = currentX;
        const dY = currentY;
        const distScore = Math.sqrt(dX * dX + dY * dY);

        // 2. Heading alignment (Target PI/2)
        let hDiff = currentHeading - Math.PI / 2;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;

        const headingScore = Math.abs(hDiff) * 2000; // Stronger heading weight

        return {
            segments,
            endX: currentX,
            endY: currentY,
            endHeading: currentHeading,
            score: distScore + headingScore
        };
    }

    // Distribute the error across all segments to force perfect closure
    private warpCorrection(candidate: TrackCandidate): TrackSegment[] {
        const segments = candidate.segments;

        // Heading Error
        // Current End Heading should match Start Heading (PI/2)
        // If current is PI/2 + 0.1, we need to turn -0.1 total.
        let dh = (Math.PI / 2) - candidate.endHeading;

        // Normalize to shortest turn
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;

        // dH = sum(dCurvature * Length)
        // dCurvature = dh / TotalLength
        let totalLength = 0;
        segments.forEach(s => totalLength += s.length);

        const curvatureOffset = dh / totalLength;

        // Apply bias to all segments
        const corrected = segments.map(s => ({
            ...s,
            curvatureBias: curvatureOffset
        }));

        // Final Recalculation to find residual position error
        let tempSpline = this.trackBuilder.generateSpline(corrected);
        const endP = tempSpline.points[tempSpline.points.length - 1];

        // Add a final closure segment to snap to 0,0
        // Distance from endP to 0,0
        const dx = 0 - endP.x;
        const dy = 0 - endP.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Heading to 0,0
        // Be careful with coordinate system. Points use +Y = -WorldY usually?
        // Let's assume standard vector math for closure segment
        // We just need a straight or curve that covers 'dist' 
        // But better: Just add a straight segment if close, or a curve if angle needed?
        // Actually, 'dist' should be small (< 50m) if the bias worked well for angle.
        // Let's just add a straight segment to close the gap.

        if (dist > 1) {
            corrected.push({
                type: 'straight',
                length: dist,
                width: segments[segments.length - 1].width,
                curvatureBias: 0
            });
        }

        return corrected;
    }

    private getRandomType(allowed: TrackSegmentType[]): TrackSegmentType {
        const idx = Math.floor(Math.random() * allowed.length);
        return allowed[idx];
    }
}
