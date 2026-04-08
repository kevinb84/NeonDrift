import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { GameControls } from '../hooks/useGameControls';
import { ROAD_WIDTH } from './Road';
import { TrackConfig } from '../menu/useGameFlow';
import { getCurveOffset } from '../utils/curveOffset';
import {
    createCarPhysState,
    stepCarPhysics,
    BODY_Y,
} from '../physics/vehiclePhysics';

// Road boundary — extra margin accounts for curveOffset shifting visual position
// ROAD_WIDTH=24 → MAX_X=9.5 keeps car well inside the kerb on curves too
const MAX_X = ROAD_WIDTH / 2 - 2.5;

// ── Drift/grip tuning ─────────────────────────────────────────────────────
const GRIP_LOSS_RATE  = 6.0;
const GRIP_GAIN_RATE  = 4.0;
const MIN_GRIP        = 0.25;
const DRIFT_THRESHOLD = 0.55;
const MAX_DRIFT_ANGLE = 0.38;  // reduced from 0.45 — less extreme yaw
const EXIT_BOOST_TIME = 0.35;
const EXIT_BOOST_MULT = 1.18;

interface CarProps {
    controls: React.RefObject<GameControls>;
    speed: React.MutableRefObject<number>;
    nitroActive?: React.RefObject<boolean>;
    onPositionChange?: (x: number) => void;
    onDriftChange?: (drifting: boolean, grip: number) => void;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
    knockbackRef?: React.MutableRefObject<number>;
    driftStateRef?: React.MutableRefObject<{ drifting: boolean; grip: number; exitBoost: number }>;
    modelFile?: string;
}

// ── GLB model — visual only, NOT used for physics ─────────────────────────
function CarModel({ modelFile }: { modelFile: string }) {
    const { scene } = useGLTF(`/models/${modelFile}`);

    const cloned = useMemo(() => {
        const c = scene.clone(true);

        // 1. Orient model BEFORE measuring — GLB exported facing +X, we need -Z
        c.rotation.set(0, Math.PI / 2, 0);
        c.updateMatrixWorld(true);

        // 2. Measure in correct orientation for accurate scale
        const box = new THREE.Box3().setFromObject(c);
        const size = box.getSize(new THREE.Vector3());
        const scale = 4.0 / Math.max(size.x, size.y, size.z);
        c.scale.setScalar(scale);

        // 3. Recompute after scale — center the pivot at ground level
        c.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(c);
        const center = scaledBox.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -scaledBox.min.y, -center.z);

        c.traverse(child => {
            if ((child as THREE.Mesh).isMesh) child.castShadow = true;
        });
        return c;
    }, [scene]);

    return (
        <group>
            <primitive object={cloned} />
        </group>
    );
}

function CarFallback() {
    return (
        <group>
            {/* Box collider visualised as fallback — matches COLLIDER dimensions */}
            <mesh castShadow>
                <boxGeometry args={[1.8, 0.5, 3.6]} />
                <meshStandardMaterial color="#0d0d1a" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.28, 0]}>
                <boxGeometry args={[1.6, 0.04, 3.4]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={4} transparent opacity={0.9} toneMapped={false} />
            </mesh>
        </group>
    );
}

// ── Main Car ──────────────────────────────────────────────────────────────
export function Car({
    controls, speed, nitroActive: _nitroActive, onPositionChange, onDriftChange,
    playerDistRef, track, knockbackRef, driftStateRef,
    modelFile = 'car-01.glb',
}: CarProps) {
    const groupRef  = useRef<THREE.Group>(null);
    const steerRef  = useRef(0);
    const gripRef   = useRef(1.0);
    const exitBoost = useRef(0);

    // Physics body — state lives between frames (NOT re-created each render)
    const phys = useRef(createCarPhysState());

    useFrame((_, dt) => {
        if (!groupRef.current || !controls.current) return;
        const ctrl = controls.current;
        const spd  = speed.current ?? 30;

        // ── 1. Read controls ───────────────────────────────────────────────
        let input = 0;
        if (ctrl.left)  input -= 1;
        if (ctrl.right) input += 1;

        // ── 2. Steering & grip ────────────────────────────────────────────
        const speedFactor = Math.max(0.35, 1.0 - (spd / 160));
        const steerSpeed  = 12 * speedFactor + 3;
        steerRef.current  = THREE.MathUtils.lerp(steerRef.current, input, dt * steerSpeed);

        const hardSteering = Math.abs(steerRef.current) > 0.6 && spd > 35;
        if (hardSteering) {
            gripRef.current = Math.max(MIN_GRIP, gripRef.current - GRIP_LOSS_RATE * dt);
        } else {
            gripRef.current = Math.min(1.0, gripRef.current + GRIP_GAIN_RATE * dt);
        }
        const isDrifting = gripRef.current < DRIFT_THRESHOLD;

        // ── 3. Exit boost ─────────────────────────────────────────────────
        if (!isDrifting && exitBoost.current <= 0 && Math.abs(phys.current.yaw) > 0.05) {
            exitBoost.current = EXIT_BOOST_TIME;
        }
        if (exitBoost.current > 0) {
            exitBoost.current -= dt;
            speed.current = Math.min(speed.current * (1 + (EXIT_BOOST_MULT - 1) * dt * 4), 120);
        }

        if (driftStateRef) {
            driftStateRef.current = {
                drifting: isDrifting,
                grip: gripRef.current,
                exitBoost: exitBoost.current,
            };
        }
        if (onDriftChange) onDriftChange(isDrifting, gripRef.current);

        // ── 4. Physics targets ────────────────────────────────────────────
        const targetYaw  = isDrifting
            ? -(steerRef.current * MAX_DRIFT_ANGLE * (1.0 - gripRef.current))
            : 0;
        const tiltBase   = 0.07 + (1 - gripRef.current) * 0.05;
        const targetRoll = -steerRef.current * tiltBase;
        // Lateral force: moderate — strong enough to feel responsive,
        // low enough that velocity can't escape the wall clamp in one frame
        const lateralForce = 5.5 * speedFactor * gripRef.current + 2.5;

        // Consume knockback impulse (zero it after reading)
        const knockbackX = knockbackRef?.current ?? 0;
        if (knockbackRef) knockbackRef.current = 0;

        // ── 5. Step physics (fixed timestep, NOT frame-rate dependent) ────
        const result = stepCarPhysics(phys.current, {
            rawDt: dt,
            inputX: steerRef.current,  // ← smoothed steer (analogue), NOT raw binary
            lateralForce,
            targetYaw,
            targetRoll,
            knockbackX,
            maxX: MAX_X,
        });

        // ── 6. Sync physics → GLB visual (ground constraint + road curve) ─
        const curveOffset = getCurveOffset(0, playerDistRef?.current || 0, track);

        //  X: logic X + road curve offset
        groupRef.current.position.x = result.x + curveOffset;
        //  Y: ground constraint — COM locked to BODY_Y (no bouncing/sinking)
        groupRef.current.position.y = result.y;
        //  Z: fixed at origin (road scrolls past the car)
        groupRef.current.position.z = 0;

        //  Rotation — ALL three axes explicitly set every frame:
        groupRef.current.rotation.x = 0;           // pitch ALWAYS 0 (no nose-dive/backflip)
        groupRef.current.rotation.y = result.yaw;  // yaw   — drift heading
        groupRef.current.rotation.z = result.roll; // roll  — lean into turns

        if (onPositionChange) onPositionChange(result.x);
    });

    return (
        <group ref={groupRef} position={[0, BODY_Y, 0]}>
            <Suspense fallback={<CarFallback />}>
                <CarModel modelFile={modelFile} />
            </Suspense>
        </group>
    );
}
