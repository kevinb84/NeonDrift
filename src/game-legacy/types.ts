// ============================================================
// Game Types — Shared type definitions for the racing game
// ============================================================

/** Input state from keyboard or touch */
export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    nitro: boolean;
    enter?: boolean;
    pause?: boolean;
    forceTouch?: boolean;
    keys?: Record<string, boolean>;
    mouse?: { x: number; y: number; click: boolean };
}

/** A car in the game (player or AI) */
export interface Car {
    x: number;          // Lateral position (-1 to 1, 0 = center)
    z: number;          // Distance along track
    speed: number;      // Current speed
    maxSpeed: number;   // Max speed for this car
    width: number;      // Collision width
    height: number;     // Visual height for rendering
    color: string;      // Car body color
    isPlayer: boolean;
    lane: number;       // Current lane (0, 1, 2)
    targetLane: number; // Lane the AI is moving toward
    braking: boolean;   // Whether brake lights are on
    steerOffset: number; // Visual steering tilt
    id?: string;        // Network ID
    driftAngle?: number; // Physics drift angle (radians)
}

/** Projected screen coordinates for a road segment point */
export interface ScreenProjection {
    screenX: number;
    screenY: number;
    screenW: number;    // Projected road half-width at this point
    scale: number;      // Scale factor for sprites at this depth
}

/** A single road segment */
export interface RoadSegment {
    z: number;          // World Z position
    curve: number;      // Horizontal curve amount
    hill: number;       // Vertical hill amount
    color: {
        road: string;
        grass: string;
        rumble: string;
        lane: string;
    };
    projection: ScreenProjection;
}

/** HUD display data */
export interface HUDData {
    position: number;
    totalRacers: number;
    lap: number;
    totalLaps: number;
    speed: number;       // in KPH
    timer: number;       // elapsed seconds
    nitroAmount: number; // 0 to 1
    score: number;       // Current race score (Drift points)
    driftCombo: number;  // Current active drift points
}

/** Overall game state */
export interface GameState {
    status: 'racing' | 'countdown' | 'finished';
    player: Car;
    aiCars: Car[];
    trackLength: number;
    cameraZ: number;
    cameraY: number;
    hud: HUDData;
    lapStartTime: number;
    currentLap: number;
}
