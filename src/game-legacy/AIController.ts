// ============================================================
// AIController — Difficulty-driven AI with rubberbanding
// ============================================================

import { Car } from './types';
import {
    AI_SPEED_MIN,
    LANE_COUNT,
    SEGMENT_LENGTH,
    TRACK_LENGTH,
    GRID_POSITIONS,
    GRID_ROW_SPACING,
    COLORS,
} from './constants';
import { DifficultyConfig, DIFFICULTIES } from './DifficultyConfig';

export class AIController {
    cars: Car[] = [];
    private config: DifficultyConfig = DIFFICULTIES.EASY;

    constructor() {
        this.reset();
    }

    setDifficulty(config: DifficultyConfig): void {
        this.config = config;
    }

    reset(count: number = 5): void {
        this.cars = [];
        for (let i = 0; i < count; i++) {
            this.cars.push(this.createAICar(i));
        }
    }

    private createAICar(index: number): Car {
        const gridPos = GRID_POSITIONS.ai[index];
        const minSpeed = this.config.aiMaxSpeed * 0.6;
        const maxSpeed = this.config.aiMaxSpeed;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

        return {
            x: gridPos ? gridPos.lane : ((index % LANE_COUNT) - 1) * 0.6,
            z: gridPos ? gridPos.row * GRID_ROW_SPACING : (index + 1) * SEGMENT_LENGTH * 3,
            speed: 0,
            maxSpeed: speed,
            width: 0.25,
            height: 0.15,
            color: COLORS.AI_CARS[index % COLORS.AI_CARS.length],
            isPlayer: false,
            lane: gridPos ? (gridPos.lane > 0 ? 2 : gridPos.lane < 0 ? 0 : 1) : index % LANE_COUNT,
            targetLane: 1,
            braking: false,
            steerOffset: 0,
        };
    }

    private trackLength: number = TRACK_LENGTH;

    setTrackLength(length: number): void {
        this.trackLength = length;
    }

    update(dt: number, playerZ: number): void {
        const aggression = this.config.aiAggression;

        for (const car of this.cars) {
            // Rubberbanding (Distance based on meters now, not segments)
            const dist = car.z - playerZ;
            let rubber = 1.0;
            // 800m ahead -> slow down
            if (dist > 800) rubber = 0.7;
            else if (dist > 400) rubber = 0.85;
            // 600m behind -> speed up
            else if (dist < -600) rubber = 1.5;
            else if (dist < -300) rubber = 1.25;

            const target = car.maxSpeed * rubber;
            const accelRate = 100 + aggression * 80;
            if (car.speed < target) {
                car.speed += accelRate * dt;
                if (car.speed > target) car.speed = target;
            } else {
                // Decelerate
                car.speed -= accelRate * 0.5 * dt;
                if (car.speed < target) car.speed = target;
            }

            if (car.speed < AI_SPEED_MIN * 0.3) car.speed = AI_SPEED_MIN * 0.3;

            // Simple movement in meters
            car.z += car.speed * dt;

            // Aggression-driven lane switching
            if (Math.random() < aggression * 0.008) {
                car.targetLane = Math.floor(Math.random() * LANE_COUNT);
            }

            const targetX = (car.targetLane - 1) * 0.6;
            const dx = targetX - car.x;
            if (Math.abs(dx) > 0.01) {
                car.x += Math.sign(dx) * (1.0 + aggression) * dt;
                car.steerOffset = Math.sign(dx) * 0.5;
            } else {
                car.x = targetX;
                car.steerOffset *= 0.9;
            }
            car.lane = car.targetLane;
            car.x += (Math.random() - 0.5) * 0.02 * dt;
            car.braking = false;
        }
    }

    getPlayerPosition(playerZ: number): number {
        let pos = 1;
        // Normalize playerZ to track length for comparison if needed?
        // Usually z is cumulative. But if we lap, we need to handle that?
        // For now, assuming standard cumulative Z race.
        for (const car of this.cars) {
            if (car.z > playerZ) pos++;
        }
        return pos;
    }

    getCarLap(car: Car): number {
        return Math.floor(car.z / this.trackLength) + 1;
    }
}
