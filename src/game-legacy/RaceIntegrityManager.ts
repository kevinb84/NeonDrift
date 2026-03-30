import { Car } from './types';
import { TRACK_LENGTH } from './constants';

export interface IntegrityReport {
    isValid: boolean;
    violations: string[];
    maxSpeedReached: number;
    score: number; // 0-100, 100 is clean
}

export class RaceIntegrityManager {
    private violations: string[] = [];
    private maxSpeedReached: number = 0;
    private lastZ: number = 0;


    // Thresholds
    private readonly MAX_ALLOWED_SPEED = 950; // Theoretical max is ~780 with full upgrades + nitro + slipstream
    private readonly MIN_LAP_TIME = 20.0; // World record is likely ~25-30s
    private readonly MAX_DISTANCE_PER_FRAME = 200; // At 950 speed / 60fps ~ 16 units. 200 is huge buffer for lag.

    private suspiciousFrames: number = 0;

    constructor() {
        this.reset();
    }

    reset(): void {
        this.violations = [];
        this.maxSpeedReached = 0;
        this.lastZ = 0;
        this.suspiciousFrames = 0;
    }

    private trackLength: number = TRACK_LENGTH;

    setTrackLength(length: number): void {
        this.trackLength = length;
    }

    update(dt: number, player: Car): void {
        // Skip check if dt is weird (debugging/lag spike)
        if (dt > 1.0) return;

        // 1. Max Speed Check
        if (player.speed > this.maxSpeedReached) {
            this.maxSpeedReached = player.speed;
        }

        if (player.speed > this.MAX_ALLOWED_SPEED) {
            this.suspiciousFrames++;
            if (this.suspiciousFrames % 60 === 0) {
                this.violations.push(`Speed limit exceeded: ${Math.round(player.speed)}`);
            }
        }

        // 2. Teleport Check (Distance delta)
        // Handle wrap-around logic for track length
        const length = this.trackLength || TRACK_LENGTH;
        let dz = player.z - this.lastZ;
        if (dz < -length / 2) dz += length; // Wrapped forward
        if (dz > length / 2) dz -= length; // Wrapped backward (shouldn't happen)

        if (Math.abs(dz) > this.MAX_DISTANCE_PER_FRAME) {
            // Ignore if we just started (z can jump from 0) or if reset
            if (this.lastZ !== 0) {
                this.violations.push(`Suspicious movement: ${Math.round(dz)} units in frame`);
            }
        }

        this.lastZ = player.z;
    }

    validateLap(lapTime: number): boolean {
        if (lapTime < this.MIN_LAP_TIME) {
            this.violations.push(`Impossible lap time: ${lapTime.toFixed(2)}s`);
            return false;
        }
        return true;
    }

    getReport(): IntegrityReport {
        // Calculate score
        // Start at 100. Deduct for violations.
        let score = 100;

        // Speed violations are serious
        const speedViolations = this.violations.filter(v => v.includes('Speed')).length;
        score -= speedViolations * 10;

        // Movement violations
        const moveViolations = this.violations.filter(v => v.includes('movement')).length;
        score -= moveViolations * 20;

        // Lap checks
        const lapViolations = this.violations.filter(v => v.includes('Impossible lap')).length;
        score -= lapViolations * 50; // Instant fail basically

        return {
            isValid: score > 50 && lapViolations === 0, // Fail if score too low or impossible lap
            violations: this.violations,
            maxSpeedReached: this.maxSpeedReached,
            score: Math.max(0, score)
        };
    }
}
