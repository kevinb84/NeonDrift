import { Suspense, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ROAD_WIDTH, LANE_COUNT, LANE_WIDTH } from './Road';
import { getCurveOffset } from '../utils/curveOffset';
import { BODY_Y } from '../physics/vehiclePhysics';
import { CARS } from '../menu/useGameFlow';

const AI_COUNT = 4;
const LAP_DISTANCE = 2000;

// Unique RGB tint per car slot
const AI_TINTS: [number, number, number][] = [
    [0.7, 0.0, 1.0],  // purple
    [1.0, 0.8, 0.0],  // yellow
    [1.0, 0.1, 0.05], // red
    [0.0, 1.0, 0.4],  // green
];

const AI_LATERAL_SPEED = 4.5;
const AI_MIN_X = -ROAD_WIDTH / 2 + 2.0;
const AI_MAX_X =  ROAD_WIDTH / 2 - 2.0;

interface AICar {
    x: number;
    z: number;
    lane: number;
    speed: number;
    maxSpeed: number;
    tilt: number;
    idx: number;
    totalDist: number;
    laneChangeCooldown: number;
    speedTarget: number;
    speedTargetCooldown: number;
}

interface Props {
    playerSpeed: React.RefObject<number>;
    aiSpeedMult?: number;
    onPositionUpdate?: (zPositions: number[]) => void;
    onDetailedUpdate?: (cars: { x: number; z: number; totalDist: number }[]) => void;
    playerDistRef?: React.MutableRefObject<number>;
    track?: import('../menu/useGameFlow').TrackConfig;
    aiKnockbackRef: React.MutableRefObject<{ [idx: number]: number }>;
    randomFn: () => number;
}

/** Clone the shared scene once per car index, apply a unique material tint */
function cloneWithTint(scene: THREE.Group, tint: [number, number, number]): THREE.Group {
    const c = scene.clone(true);

    // Orient — same bake as player CarModel (GLB exported facing +X → rotate to -Z)
    c.rotation.set(0, Math.PI / 2, 0);
    c.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const scale = 3.8 / Math.max(size.x, size.y, size.z);
    c.scale.setScalar(scale);

    c.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(c);
    const center = scaledBox.getCenter(new THREE.Vector3());
    c.position.set(-center.x, -scaledBox.min.y, -center.z);

    // Clone + tint each mesh material so cars look distinct
    c.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;

        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        const col = mat.color;
        col.setRGB(
            Math.min(1, col.r * 0.35 + tint[0] * 0.65),
            Math.min(1, col.g * 0.35 + tint[1] * 0.65),
            Math.min(1, col.b * 0.35 + tint[2] * 0.65),
        );
        if (mat.emissive) {
            mat.emissive.setRGB(tint[0] * 0.35, tint[1] * 0.35, tint[2] * 0.35);
            mat.emissiveIntensity = 0.7;
        }
        mesh.material = mat;
    });

    return c as unknown as THREE.Group;
}

function AIFallback() {
    return (
        <mesh castShadow>
            <boxGeometry args={[1.8, 0.45, 3.5]} />
            <meshStandardMaterial color="#0d0d1a" metalness={0.85} roughness={0.2} />
        </mesh>
    );
}

function AICarModel({ modelFile, tint }: { modelFile: string; tint: [number, number, number] }) {
    const { scene } = useGLTF(`/models/${modelFile}`);
    const cloned = useMemo(() => cloneWithTint(scene as unknown as THREE.Group, tint), [scene, tint]);
    return <primitive object={cloned} />;
}

// ── Per-car rendered group — own ref + own useFrame ──────────────────
function AISingleCar({
    carState,
    modelFile,
    tint,
    playerDistRef,
    track,
}: {
    carState: AICar;
    modelFile: string;
    tint: [number, number, number];
    playerDistRef?: React.MutableRefObject<number>;
    track?: import('../menu/useGameFlow').TrackConfig;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        const g = groupRef.current;
        if (!g) return;
        const dist = playerDistRef?.current || 0;
        const curve = getCurveOffset(carState.z, dist, track);
        g.position.set(carState.x + curve, BODY_Y, carState.z);
        g.rotation.set(0, 0, carState.tilt);
    });

    return (
        <group ref={groupRef}>
            <Suspense fallback={<AIFallback />}>
                <AICarModel modelFile={modelFile} tint={tint} />
            </Suspense>
        </group>
    );
}

// ── AI Opponents ──────────────────────────────────────────────────────
export function AIOpponents({
    playerSpeed,
    aiSpeedMult = 1,
    onPositionUpdate,
    onDetailedUpdate,
    playerDistRef,
    track,
    aiKnockbackRef,
    randomFn,
}: Props) {
    // Select deterministic but distinct models for the 4 AI slots
    const aiModels = useMemo(() => {
        let avail = [...CARS];
        const selected = [];
        for (let i = 0; i < AI_COUNT; i++) {
             // Deterministic choice so they don't pop/reload
             const idx = Math.floor(randomFn() * avail.length * 0.999);
             selected.push(avail.splice(idx, 1)[0].modelFile);
        }
        return selected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // AI state — initialised once with useMemo
    const cars = useMemo<AICar[]>(() => {
        const arr: AICar[] = [];
        for (let i = 0; i < AI_COUNT; i++) {
            const lane = i % LANE_COUNT;
            const x = -ROAD_WIDTH / 2 + LANE_WIDTH / 2 + lane * LANE_WIDTH;
            const baseSpeed = 26 + randomFn() * 8;
            arr.push({
                x, z: -(15 + i * 14), lane,
                speed: baseSpeed,
                maxSpeed: 30 + randomFn() * 15,
                tilt: 0, idx: i,
                totalDist: 15 + i * 14,
                laneChangeCooldown: 2 + i * 1.5,
                speedTarget: baseSpeed,
                speedTargetCooldown: 0,
            });
        }
        return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Physics update loop — mutates car state each frame
    useFrame((_, dt) => {
        const safeDt = Math.min(dt, 0.05);
        const pSpeed = playerSpeed.current ?? 30;

        cars.forEach((c, i) => {
            c.speedTargetCooldown -= safeDt;
            if (c.speedTargetCooldown <= 0) {
                c.speedTarget = pSpeed * (0.92 + randomFn() * 0.12) * aiSpeedMult;
                c.speedTargetCooldown = 0.35 + randomFn() * 0.25;
            }

            const relZ = c.z;
            let target: number;
            if      (relZ < -50) target = pSpeed * 0.70 * aiSpeedMult;
            else if (relZ < -25) target = pSpeed * 0.85 * aiSpeedMult;
            else if (relZ >  40) target = pSpeed * 1.40 * aiSpeedMult;
            else if (relZ >  15) target = pSpeed * 1.20 * aiSpeedMult;
            else                 target = c.speedTarget;

            c.speed = THREE.MathUtils.lerp(c.speed, target, safeDt * 2);
            c.totalDist += c.speed * safeDt;
            c.z += (pSpeed - c.speed) * safeDt;

            if (c.z >  70) c.z = -55;
            if (c.z < -80) c.z =  45;

            c.laneChangeCooldown -= safeDt;
            if (c.laneChangeCooldown <= 0) {
                c.lane = Math.floor(randomFn() * LANE_COUNT);
                c.laneChangeCooldown = 3 + randomFn() * 4;
            }

            if (aiKnockbackRef?.current && aiKnockbackRef.current[i] !== undefined) {
                const kb = THREE.MathUtils.clamp(aiKnockbackRef.current[i], -1.2, 1.2);
                c.x = THREE.MathUtils.clamp(c.x + kb, AI_MIN_X, AI_MAX_X);
                delete aiKnockbackRef.current[i];
            }

            const targetX = -ROAD_WIDTH / 2 + LANE_WIDTH / 2 + c.lane * LANE_WIDTH;
            const dx = targetX - c.x;
            const maxStep = AI_LATERAL_SPEED * safeDt;
            const prevX = c.x;

            if (Math.abs(dx) > maxStep) {
                c.x += Math.sign(dx) * maxStep;
            } else {
                c.x = targetX;
            }
            c.x = THREE.MathUtils.clamp(c.x, AI_MIN_X, AI_MAX_X);

            const actualDx = c.x - prevX;
            const targetTilt = THREE.MathUtils.clamp(-actualDx / safeDt * 0.018, -0.08, 0.08);
            c.tilt = THREE.MathUtils.lerp(c.tilt, targetTilt, safeDt * 6);
        });

        if (onPositionUpdate) onPositionUpdate(cars.map(c => c.z));
        if (onDetailedUpdate) onDetailedUpdate(cars.map(c => ({ x: c.x, z: c.z, totalDist: c.totalDist })));
    });

    return (
        <>
            {cars.map((car, i) => (
                <AISingleCar
                    key={car.idx}
                    carState={car}
                    modelFile={aiModels[i]}
                    tint={AI_TINTS[i % AI_TINTS.length]}
                    playerDistRef={playerDistRef}
                    track={track}
                />
            ))}
        </>
    );
}

export { LAP_DISTANCE };
