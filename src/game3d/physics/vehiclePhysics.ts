import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════
// Vehicle Physics — Fixed-Timestep Simulation
//
// Architecture:
//   ┌─────────────────────┐     sync each frame      ┌──────────────────┐
//   │  Physics body       │ ────────────────────────► │  GLB visual mesh │
//   │  (box collider)     │                           │  (render only)   │
//   └─────────────────────┘                           └──────────────────┘
//
// The GLB geometry is NEVER used for collision or physics.
// All simulation runs on the simple box defined by COLLIDER below.
// ═══════════════════════════════════════════════════════════════════════════

// ── Box collider dimensions (approximates real car, NOT GLB shape) ─────────
export const COLLIDER = {
    width:  1.8,   // X — car width
    height: 0.5,   // Y — car height
    length: 3.6,   // Z — car length along road
} as const;

// ── Simulation constants ───────────────────────────────────────────────────

/** Physics runs at this fixed rate (Hz) regardless of frame rate */
const FIXED_DT = 1 / 60;

/** Ground plane: the flat road surface sits at Y = 0 */
const GROUND_Y = 0;

/**
 * Center of mass height above ground.
 * Placing COM slightly BELOW geometric center creates a low-CG car
 * that resists flipping (pendulum effect).
 */
export const BODY_Y = GROUND_Y + COLLIDER.height / 2 - 0.05;  // ≈ 0.20

// Damping: fraction of velocity removed per second
// Higher damping = faster stop when key released
const LIN_DAMP_X    = 0.85;   // strong lateral friction — good road feel
const ANG_DAMP_YAW  = 0.87;
const ANG_DAMP_ROLL = 0.93;

// Hard flip-prevention limits — enforced every physics step
const MAX_ROLL_RAD  = 0.13;            // ±7.5° — realistic lean max
const MAX_YAW_RAD   = Math.PI * 0.38;  // ±68° — generous drift cap

// ── State ─────────────────────────────────────────────────────────────────
export interface CarPhysState {
    // Lateral position and velocity (X axis)
    x:        number;
    vx:       number;
    // Angular state (Euler angles, radians)
    yaw:      number;   // rotation.y  — heading / drift
    roll:     number;   // rotation.z  — lean into turns
    // Angular velocities
    dYaw:     number;
    dRoll:    number;
    // Fixed-timestep accumulator
    acc:      number;
}

export function createCarPhysState(): CarPhysState {
    return { x: 0, vx: 0, yaw: 0, roll: 0, dYaw: 0, dRoll: 0, acc: 0 };
}

// ── Parameters passed each frame ───────────────────────────────────────────
export interface StepParams {
    /** Raw frame delta time (seconds) — will be split into fixed steps */
    rawDt:        number;
    /** Smoothed lateral control input: -1.0 (left) .. 0 .. +1.0 (right)
     *  Use steerRef (lerped) NOT raw binary input — gives analogue feel */
    inputX:       number;
    /** Lateral force magnitude = (14 * speedFactor + 2) * grip */
    lateralForce: number;
    /** Desired yaw from drift/grip calculation */
    targetYaw:    number;
    /** Desired roll from steer calculation */
    targetRoll:   number;
    /** One-shot lateral collision impulse. Set to 0 after consuming. */
    knockbackX:   number;
    /** Half road width clamp bound */
    maxX:         number;
}

// ── Result written back each frame ────────────────────────────────────────
export interface StepResult {
    x:    number;
    y:    number;   // always BODY_Y — ground constraint
    yaw:  number;
    roll: number;
    // pitch is always 0 — locked to prevent nose-dive / backflip
}

/**
 * Advance car physics by `rawDt` seconds using a fixed 1/60 accumulator.
 *
 * Design:
 *  - Lateral (X) uses velocity integration with linear damping
 *  - Yaw/roll use spring-damper (drive toward target, damp angular velocity)
 *  - Pitch (X rotation) is always forced to zero — no up/down flipping
 *  - Y position is locked to BODY_Y — ground plane constraint
 *  - All angles clamped after each sub-step (hard flip prevention)
 *  - Collision knockback applied as an impulse BEFORE sub-steps
 */
export function stepCarPhysics(s: CarPhysState, p: StepParams): StepResult {
    // Guard: cap runaway dt (e.g., after tab switch) to prevent spiral
    s.acc += Math.min(p.rawDt, 0.05);

    // Apply collision impulse as an instant velocity change (event-based)
    if (p.knockbackX !== 0) {
        s.vx += p.knockbackX * 5.0;
    }

    while (s.acc >= FIXED_DT) {
        s.acc -= FIXED_DT;
        const fdt = FIXED_DT;

        // ── Lateral position (X) ─────────────────────────────────────────
        // Velocity-based: input drives acceleration, damping resists sliding
        s.vx += p.inputX * p.lateralForce * fdt;
        s.vx *= (1 - LIN_DAMP_X * fdt);                    // linear damping

        const newX = s.x + s.vx * fdt;
        if (newX <= -p.maxX || newX >= p.maxX) {
            // Hit wall — zero velocity so we don't accumulate through boundary
            s.vx = 0;
            s.x = THREE.MathUtils.clamp(newX, -p.maxX, p.maxX);
        } else {
            s.x = newX;
        }

        // ── Yaw — heading / drift rotation (Y axis) ──────────────────────
        // Spring-damper: pulls toward targetYaw, angular velocity decays
        const yawErr = p.targetYaw - s.yaw;
        s.dYaw  += yawErr * 20 * fdt;
        s.dYaw  *= (1 - ANG_DAMP_YAW * fdt);
        s.yaw   += s.dYaw * fdt;
        s.yaw    = THREE.MathUtils.clamp(s.yaw, -MAX_YAW_RAD, MAX_YAW_RAD);

        // ── Roll — lean into turns (Z axis) ──────────────────────────────
        const rollErr = p.targetRoll - s.roll;
        s.dRoll += rollErr * 18 * fdt;
        s.dRoll *= (1 - ANG_DAMP_ROLL * fdt);
        s.roll  += s.dRoll * fdt;
        s.roll   = THREE.MathUtils.clamp(s.roll, -MAX_ROLL_RAD, MAX_ROLL_RAD);
    }

    return {
        x:    s.x,
        y:    BODY_Y,   // ground constraint — car never leaves the road
        yaw:  s.yaw,
        roll: s.roll,
        // pitch = 0 implicit — consumer must set rotation.x = 0
    };
}
