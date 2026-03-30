import { Car, InputState } from './types';
import { TrackData } from './TrackDefinition';
import { TrackBuilder } from './TrackBuilder';
import {
    PLAYER_MAX_SPEED,
    ROAD_WIDTH,
    PLAYER_COLLISION_SLOW,

    CAR_MASS,
    CAR_INERTIA,
    CAR_FRONT_AXLE,
    CAR_REAR_AXLE,
    TIRE_GRIP_FRONT,
    TIRE_GRIP_REAR,
    BRAKE_FORCE,
    ENGINE_FORCE,
    AIR_DENSITY,
    DRAG_AREA,
    STEER_ANGLE_MAX
} from './constants';

interface CarPhysicsState {
    position: { x: number; y: number }; // World Coordinates (Meters)
    velocity: { x: number; y: number }; // m/s (World Frame)
    acceleration: { x: number; y: number }; // m/s² (World Frame)
    heading: number;        // Radians, World Frame (0 = Right, PI/2 = Up)
    angularVelocity: number; // Rad/s
    steerAngle: number;     // Radians, relative to heading
    speed: number;          // Magnitude of velocity (m/s)
    driftAngle: number;     // Angle between heading and velocity
    grip: number;           // Current traction multiplier (0.0 - 1.0)
}

export class PlayerController {
    car: Car;
    private physics: CarPhysicsState;
    private track: TrackData | null = null;

    // Slipstream state (set externally by GameEngine)
    inSlipstream: boolean = false;
    slipstreamStrength: number = 0; // 0-1
    private currentTrackIndex: number = 0; // State for optimized search

    // Performance multipliers
    private engineMult: number = 1.0;
    private tiresMult: number = 1.0;
    private nitroBoost: number = 1.4;

    constructor() {
        this.car = this.createPlayerCar();
        this.physics = this.createInitialPhysics();
    }

    setPerformance(engine: number, tires: number, nitroBoost: number): void {
        this.engineMult = engine;
        this.tiresMult = tires;
        this.nitroBoost = nitroBoost;
        this.car.maxSpeed = PLAYER_MAX_SPEED * this.engineMult;
    }

    setTrack(track: TrackData): void {
        this.track = track;
        // Reset position to track start if needed, or keep relative
        // For now, valid track is needed for update
    }

    private createPlayerCar(): Car {
        return {
            x: 0,
            z: 0,
            speed: 0,
            maxSpeed: PLAYER_MAX_SPEED * this.engineMult,
            width: 0.25,
            height: 0.15,
            color: '#00e5ff',
            isPlayer: true,
            lane: 1,
            targetLane: 1,
            braking: false,
            steerOffset: 0,
            driftAngle: 0
        };
    }

    private createInitialPhysics(): CarPhysicsState {
        return {
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            heading: Math.PI / 2, // Start facing UP (90 deg)
            angularVelocity: 0,
            steerAngle: 0,
            speed: 0,
            grip: 1.0,
            driftAngle: 0
        };
    }

    reset(): void {
        this.car = this.createPlayerCar();
        this.physics = this.createInitialPhysics();
        this.inSlipstream = false;
        this.slipstreamStrength = 0;
        this.currentTrackIndex = 0;

        if (this.track) {
            const start = this.track.points[0];
            this.physics.position.x = start.x;
            this.physics.position.y = start.y;
            // Assuming start aligns with first segment (Usually Up/North)
            this.physics.heading = Math.PI / 2;
        }
    }

    update(dt: number, input: InputState): void {
        if (!this.track) return;

        // --- 1. Input Processing ---
        // Steer Logic (Smooth approach to target angle)
        let targetSteer = 0;
        if (input.right) targetSteer -= STEER_ANGLE_MAX; // - Angle = Right Turn (CW)
        if (input.left) targetSteer += STEER_ANGLE_MAX;  // + Angle = Left Turn (CCW)

        // Steering Responsiveness (Speed dependent?)
        const steerRate = 5.0 * dt;
        this.physics.steerAngle += (targetSteer - this.physics.steerAngle) * steerRate;

        // Throttle / Brake
        let throttle = 0;
        if (input.up || input.nitro) throttle = 1;
        if (input.down) throttle = -1;

        // --- 2. Rigid Body Physics (Local Frame) ---

        // A. World to Local Velocity Conversion
        // Heading 0 = Right (1,0). Heading PI/2 = Up (0,-1).
        // Cos(90)=0, -Sin(90)=-1. Forward is (0, -1). Correct.
        const cosH = Math.cos(this.physics.heading);
        const sinH = Math.sin(this.physics.heading);

        // Local X (Longitudinal): Dot(Vel, ForwardVec)
        // ForwardVec = (cosH, -sinH)
        const vLocalX = this.physics.velocity.x * cosH + this.physics.velocity.y * (-sinH);

        // Local Y (Lateral): Dot(Vel, RightVec)
        // RightVec = (-sinH, -cosH) ??
        // Rotate Forward -90 deg (CW) -> (sinH, cosH).
        // Check: Heading 90 (Up). Forward(0,-1). Right(1,0).
        // sin(90)=1, cos(90)=0. (1, 0). Correct. 
        const vLocalY = this.physics.velocity.x * sinH + this.physics.velocity.y * cosH;

        // B. Tire Physics (Slip Angles)
        // Velocities at specific tires (Angular addition)
        // Front: vy + omega * dist_front
        // Rear: vy - omega * dist_rear
        const vFrontY = vLocalY + this.physics.angularVelocity * CAR_FRONT_AXLE;
        const vRearY = vLocalY - this.physics.angularVelocity * CAR_REAR_AXLE;

        // Slip Angles (alpha)
        // alpha = atan2(vy, vx) - steer
        // Guard against low speed instability
        let alphaFront = 0;
        let alphaRear = 0;

        if (Math.abs(vLocalX) > 1.0) {
            alphaFront = Math.atan2(vFrontY, Math.abs(vLocalX)) - this.physics.steerAngle;
            alphaRear = Math.atan2(vRearY, Math.abs(vLocalX));
        }

        // Tire Forces (Lateral) - Simplified Pacejka / Linear
        // Force = -Stiffness * alpha
        // Clamp force to friction circle limit (Load * FrictionCoeff)
        // Simplified Load: static weight distribution 50/50
        const loadFront = (CAR_MASS * 9.8) * 0.5;
        const loadRear = (CAR_MASS * 9.8) * 0.5;

        const maxLatFront = loadFront * 1.5; // 1.5G lateral peak
        const maxLatRear = loadRear * 1.5;

        let fyFront = -TIRE_GRIP_FRONT * this.tiresMult * alphaFront;
        let fyRear = -TIRE_GRIP_REAR * this.tiresMult * alphaRear;

        // Cap Forces
        fyFront = Math.max(-maxLatFront, Math.min(maxLatFront, fyFront));
        fyRear = Math.max(-maxLatRear, Math.min(maxLatRear, fyRear));

        // Handbrake Override (Lock Rear Wheels)
        if (input.down && Math.abs(this.physics.speed) > 10) {
            fyRear *= 0.1; // Loss of lateral grip
        }

        // C. Longitudinal Forces
        let fx = 0;
        if (throttle > 0) {
            fx = ENGINE_FORCE * this.engineMult * throttle;
            if (input.nitro) fx *= this.nitroBoost; // Hacky boost
        } else if (throttle < 0) {
            fx = -BRAKE_FORCE; // Braking
        } else {
            // Rolling Resistance
            fx = -200 * Math.sign(vLocalX);
        }

        // Drag
        const airRes = 0.5 * AIR_DENSITY * DRAG_AREA * vLocalX * Math.abs(vLocalX);
        fx -= airRes;

        // D. Summation (Newton's 2nd Law)
        // Local Forces to Net Force/Torque
        // F_net_x = fx - fyFront * sin(steer)
        // F_net_y = fyRear + fyFront * cos(steer)
        // Torque = fyFront * cos(steer) * a_f - fyRear * a_r

        const forceLocalX = fx - fyFront * Math.sin(this.physics.steerAngle);
        const forceLocalY = fyRear + fyFront * Math.cos(this.physics.steerAngle);
        const torque = (fyFront * Math.cos(this.physics.steerAngle) * CAR_FRONT_AXLE) - (fyRear * CAR_REAR_AXLE);

        // Acceleration (Local)
        const accelLocalX = forceLocalX / CAR_MASS;
        const accelLocalY = forceLocalY / CAR_MASS;
        const angularAccel = torque / CAR_INERTIA;

        // E. Integration (World Frame)
        // Convert Local Accel to World Accel
        // ax_world = ax_local * cosH + ay_local * sinH
        // ay_world = ax_local * (-sinH) + ay_local * cosH

        const axWorld = accelLocalX * cosH + accelLocalY * sinH;
        const ayWorld = accelLocalX * (-sinH) + accelLocalY * cosH;

        this.physics.velocity.x += axWorld * dt;
        this.physics.velocity.y += ayWorld * dt;
        this.physics.angularVelocity += angularAccel * dt;

        // Damping Angular Velocity (Fake Friction)
        this.physics.angularVelocity *= 0.98;

        this.physics.heading += this.physics.angularVelocity * dt;
        this.physics.position.x += this.physics.velocity.x * dt;
        this.physics.position.y += this.physics.velocity.y * dt;

        // --- 3. Derived State ---
        this.physics.acceleration = { x: axWorld, y: ayWorld };
        this.physics.speed = Math.sqrt(this.physics.velocity.x ** 2 + this.physics.velocity.y ** 2);

        // Drift Angle (Slip Angle of the whole car CG)
        this.physics.driftAngle = Math.atan2(vLocalY, Math.abs(vLocalX));
        this.physics.grip = Math.max(0, 1 - (Math.abs(alphaRear) + Math.abs(alphaFront)));



        // --- 2. Projection to Track (Rendering) ---
        const projection = TrackBuilder.getTrackPosition(
            this.track,
            this.physics.position.x,
            this.physics.position.y,
            this.currentTrackIndex
        );

        this.currentTrackIndex = projection.index;

        // Update Car State for Renderer
        this.car.z = projection.distance;
        this.car.x = projection.offset / (ROAD_WIDTH / 2);
        this.car.speed = this.physics.speed;
        this.car.driftAngle = this.physics.driftAngle;

        // Visual Steer
        const angleDiff = this.physics.heading - projection.heading;
        let visualDrift = angleDiff;
        while (visualDrift > Math.PI) visualDrift -= Math.PI * 2;
        while (visualDrift < -Math.PI) visualDrift += Math.PI * 2;

        this.car.steerOffset = -visualDrift * 2.0;

        // Off-road logic
        if (Math.abs(this.car.x) > 1.2) {
            this.physics.velocity.x *= 0.95;
            this.physics.velocity.y *= 0.95;
        }
    }

    applyCollision(): void {
        this.physics.speed *= PLAYER_COLLISION_SLOW;
        this.physics.velocity.x *= PLAYER_COLLISION_SLOW;
        this.physics.velocity.y *= PLAYER_COLLISION_SLOW;
        this.car.braking = true;
    }

    getWorldX(): number {
        return this.car.x * (ROAD_WIDTH / 2);
    }
}
