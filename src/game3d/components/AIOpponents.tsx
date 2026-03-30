import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_WIDTH, LANE_COUNT, LANE_WIDTH } from './Road';

const AI_COUNT = 4;
const LAP_DISTANCE = 2000; // Must match GameScene.tsx constant

const PALETTES = [
    { body: '#1a0808', accent: '#ff3333', glow: '#ff0000' },
    { body: '#081a08', accent: '#33ff66', glow: '#00ff44' },
    { body: '#1a1a08', accent: '#ffaa00', glow: '#ff8800' },
    { body: '#10081a', accent: '#cc33ff', glow: '#aa00ff' },
];

interface AICar {
    x: number;
    z: number;
    lane: number;
    speed: number;
    maxSpeed: number;
    tilt: number;
    idx: number;
    /** Cumulative race distance for position ranking */
    totalDist: number;
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

import { getCurveOffset } from '../utils/curveOffset';

/** AI opponent cars — -Z is forward, same as player */
export function AIOpponents({ playerSpeed, aiSpeedMult = 1, onPositionUpdate, onDetailedUpdate, playerDistRef, track, aiKnockbackRef, randomFn }: Props) {
    const groupRef = useRef<THREE.Group>(null);
    const carsRef = useRef<AICar[]>([]);
    const initDone = useRef(false);

    // One-time init
    if (!initDone.current) {
        for (let i = 0; i < AI_COUNT; i++) {
            const lane = i % LANE_COUNT;
            const x = -ROAD_WIDTH / 2 + LANE_WIDTH / 2 + lane * LANE_WIDTH;
            carsRef.current.push({
                x,
                z: -(15 + i * 14),
                lane,
                speed: 26 + randomFn() * 8,
                maxSpeed: 30 + randomFn() * 15,
                tilt: 0,
                idx: i,
                // Start with some distance based on initial z offset (they start ahead)
                totalDist: 15 + i * 14,
            });
        }
        initDone.current = true;
    }

    // Shared geometry
    const bodyGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.45, 3.5), []);
    const cabinGeo = useMemo(() => new THREE.BoxGeometry(1.2, 0.3, 1.4), []);
    const underGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.04, 3.3), []);
    const sideGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.08, 3.3), []);
    const lightGeo = useMemo(() => new THREE.BoxGeometry(0.35, 0.1, 0.06), []);
    const tailGeo = useMemo(() => new THREE.BoxGeometry(0.3, 0.08, 0.06), []);

    useFrame((_, dt) => {
        const pSpeed = playerSpeed.current ?? 30;
        const dist = playerDistRef?.current || 0;
        const cars = carsRef.current;

        cars.forEach((c, i) => {
            // Rubberbanding — based on relative z position
            const relZ = c.z; // c.z < 0 = ahead of player (who is at z=0)

            let target = c.maxSpeed;
            if (relZ < -50) target = pSpeed * 0.7 * aiSpeedMult;       // Too far ahead → slow
            else if (relZ < -25) target = pSpeed * 0.85 * aiSpeedMult;
            else if (relZ > 40) target = pSpeed * 1.4 * aiSpeedMult;  // Too far behind → speed up
            else if (relZ > 15) target = pSpeed * 1.2 * aiSpeedMult;
            else target = pSpeed * (0.92 + randomFn() * 0.12) * aiSpeedMult;

            c.speed = THREE.MathUtils.lerp(c.speed, target, dt * 2);

            // Accumulate actual distance driven per frame
            c.totalDist += c.speed * dt;

            // Move relative to player (negative = ahead)
            c.z += (pSpeed - c.speed) * dt;

            // Wrap the visual position
            if (c.z > 70) c.z = -(45 + randomFn() * 25);
            if (c.z < -80) c.z = 40 + randomFn() * 25;

            // Random lane switch
            if (randomFn() < 0.004) {
                c.lane = Math.floor(randomFn() * LANE_COUNT);
            }

            // Apply knockback impulse
            if (aiKnockbackRef?.current && aiKnockbackRef.current[i] !== undefined) {
                c.x += aiKnockbackRef.current[i];
                delete aiKnockbackRef.current[i]; // consume
            }

            // Steer to target lane
            const targetX = -ROAD_WIDTH / 2 + LANE_WIDTH / 2 + c.lane * LANE_WIDTH;
            const dx = targetX - c.x;
            if (Math.abs(dx) > 0.15) {
                c.x += Math.sign(dx) * 5 * dt;
                c.tilt = THREE.MathUtils.lerp(c.tilt, Math.sign(dx) * 0.1, dt * 6);
            } else {
                c.x = targetX;
                c.tilt = THREE.MathUtils.lerp(c.tilt, 0, dt * 6);
            }

            // Keep within road bounds
            c.x = THREE.MathUtils.clamp(c.x, -ROAD_WIDTH / 2 + 1.5, ROAD_WIDTH / 2 - 1.5);

            // Update visual position
            if (groupRef.current) {
                const child = groupRef.current.children[i];
                if (child) {
                    const curve = getCurveOffset(c.z, dist, track);
                    child.position.set(c.x + curve, 0.5, c.z);
                    child.rotation.z = c.tilt;
                }
            }
        });

        if (onPositionUpdate) {
            onPositionUpdate(cars.map((c) => c.z));
        }
        if (onDetailedUpdate) {
            onDetailedUpdate(cars.map((c) => ({ x: c.x, z: c.z, totalDist: c.totalDist })));
        }
    });

    return (
        <group ref={groupRef}>
            {carsRef.current.map((car) => {
                const pal = PALETTES[car.idx % PALETTES.length];
                return (
                    // We set initial position but let useFrame take over seamlessly
                    <group key={car.idx} position={[car.x, 0.5, car.z]} rotation={[0, 0, car.tilt]}>
                        <mesh geometry={bodyGeo} castShadow>
                            <meshStandardMaterial color={pal.body} metalness={0.85} roughness={0.2} />
                        </mesh>
                        <mesh geometry={cabinGeo} position={[0, 0.38, 0.2]}>
                            <meshStandardMaterial color={pal.body} metalness={0.7} roughness={0.3} transparent opacity={0.85} />
                        </mesh>
                        <mesh geometry={underGeo} position={[0, -0.26, 0]}>
                            <meshStandardMaterial color={pal.accent} emissive={pal.glow} emissiveIntensity={3} toneMapped={false} />
                        </mesh>
                        <mesh geometry={sideGeo} position={[-0.92, 0, 0]}>
                            <meshStandardMaterial color={pal.accent} emissive={pal.glow} emissiveIntensity={3} toneMapped={false} />
                        </mesh>
                        <mesh geometry={sideGeo} position={[0.92, 0, 0]}>
                            <meshStandardMaterial color={pal.accent} emissive={pal.glow} emissiveIntensity={3} toneMapped={false} />
                        </mesh>
                        {[-0.55, 0.55].map((x, j) => (
                            <mesh key={`h-${j}`} geometry={lightGeo} position={[x, 0.05, -1.77]}>
                                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={5} toneMapped={false} />
                            </mesh>
                        ))}
                        {[-0.55, 0.55].map((x, j) => (
                            <mesh key={`t-${j}`} geometry={tailGeo} position={[x, 0.05, 1.77]}>
                                <meshStandardMaterial color="#ff0033" emissive="#ff0033" emissiveIntensity={4} toneMapped={false} />
                            </mesh>
                        ))}
                        <pointLight position={[0, -0.3, 0]} color={pal.glow} intensity={2} distance={5} />
                    </group>
                );
            })}
        </group>
    );
}

/** Export lap distance for use in other modules */
export { LAP_DISTANCE };
