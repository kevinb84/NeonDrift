import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameControls } from '../hooks/useGameControls';
import { ROAD_WIDTH } from './Road';
import { TrackConfig } from '../menu/useGameFlow';
import { getCurveOffset } from '../utils/curveOffset';

const STEER_SPEED = 14;
const MAX_X = ROAD_WIDTH / 2 - 1.5; // Keep car within road edges
const TILT_AMOUNT = 0.12;
const CAR_Y = 0.5;  // Car base height above road

interface CarProps {
    controls: React.RefObject<GameControls>;
    speed: React.RefObject<number>;
    nitroActive?: React.RefObject<boolean>;
    onPositionChange?: (x: number) => void;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
    knockbackRef?: React.MutableRefObject<number>;
}

/**
 * Player car — faces -Z (forward direction).
 * Positioned at a fixed Z, road scrolls toward camera to simulate movement.
 */
export function Car({ controls, speed, nitroActive, onPositionChange, playerDistRef, track, knockbackRef }: CarProps) {
    const groupRef = useRef<THREE.Group>(null);
    const steerRef = useRef(0);
    const flame1Ref = useRef<THREE.Mesh>(null);
    const flame2Ref = useRef<THREE.Mesh>(null);
    const flameLightRef = useRef<THREE.PointLight>(null);

    useFrame((_, dt) => {
        if (!groupRef.current || !controls.current) return;
        const ctrl = controls.current;

        // Steer input
        let input = 0;
        if (ctrl.left) input -= 1;
        if (ctrl.right) input += 1;

        // Smooth steer for tilt
        steerRef.current = THREE.MathUtils.lerp(steerRef.current, input, dt * 10);

        // Move laterally (steering + knockback)
        let logicX = groupRef.current.position.x - getCurveOffset(0, playerDistRef?.current || 0, track);

        // Apply knockback impulse if present
        if (knockbackRef && knockbackRef.current !== 0) {
            logicX += knockbackRef.current;
            knockbackRef.current = 0; // Consume the impulse
        }

        // Apply steering
        logicX = THREE.MathUtils.clamp(
            logicX + input * STEER_SPEED * dt,
            -MAX_X,
            MAX_X
        );

        // Calculate the curvature offset for the car's current position
        const dist = playerDistRef?.current || 0;
        const curveOffset = getCurveOffset(0, dist, track); // Car is always at Z=0

        // Apply both logical steering and track curvature to visual position
        groupRef.current.position.x = logicX + curveOffset;

        // Tilt on steer
        groupRef.current.rotation.z = -steerRef.current * TILT_AMOUNT;

        // Gentle hover bob
        const spd = speed.current ?? 30;
        groupRef.current.position.y = CAR_Y + Math.sin(Date.now() * 0.004) * 0.02 * (spd / 50);

        // Report LOGICAL position for collision detection (ignore curvature offset)
        if (onPositionChange) onPositionChange(logicX);

        // Exhaust flames
        const isNitro = nitroActive?.current ?? false;
        const flicker = Math.random();
        if (flame1Ref.current) {
            flame1Ref.current.visible = isNitro;
            flame1Ref.current.scale.set(0.6 + flicker * 0.4, 0.6 + flicker * 0.4, 1.2 + flicker * 1.5);
        }
        if (flame2Ref.current) {
            flame2Ref.current.visible = isNitro;
            flame2Ref.current.scale.set(0.4 + flicker * 0.3, 0.4 + flicker * 0.3, 0.8 + flicker * 1.0);
        }
        if (flameLightRef.current) {
            flameLightRef.current.intensity = isNitro ? 8 + flicker * 6 : 0;
        }
    });

    return (
        // Car faces -Z. The "front" is the -Z end of the box.
        <group ref={groupRef} position={[0, CAR_Y, 0]}>
            {/* ── Main body ── */}
            <mesh castShadow>
                <boxGeometry args={[2.0, 0.5, 4.0]} />
                <meshStandardMaterial color="#0d0d1a" metalness={0.85} roughness={0.2} />
            </mesh>

            {/* ── Hood (front = -Z) ── */}
            <mesh position={[0, 0.05, -0.8]} castShadow>
                <boxGeometry args={[1.8, 0.2, 1.4]} />
                <meshStandardMaterial color="#0e0e22" metalness={0.8} roughness={0.25} />
            </mesh>

            {/* ── Cabin ── */}
            <mesh position={[0, 0.42, 0.3]} castShadow>
                <boxGeometry args={[1.4, 0.35, 1.8]} />
                <meshStandardMaterial color="#111133" metalness={0.6} roughness={0.3} transparent opacity={0.85} />
            </mesh>

            {/* ── Windshield glow ── */}
            <mesh position={[0, 0.45, -0.45]}>
                <boxGeometry args={[1.3, 0.25, 0.08]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.6} transparent opacity={0.35} toneMapped={false} />
            </mesh>

            {/* ── Underbody neon (cyan) ── */}
            <mesh position={[0, -0.28, 0]}>
                <boxGeometry args={[1.8, 0.04, 3.8]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={4} transparent opacity={0.9} toneMapped={false} />
            </mesh>

            {/* ── Side neon strips (magenta) ── */}
            <mesh position={[-1.02, -0.05, 0]}>
                <boxGeometry args={[0.04, 0.1, 3.8]} />
                <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={4} toneMapped={false} />
            </mesh>
            <mesh position={[1.02, -0.05, 0]}>
                <boxGeometry args={[0.04, 0.1, 3.8]} />
                <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={4} toneMapped={false} />
            </mesh>

            {/* ── Front accent line ── */}
            <mesh position={[0, 0.02, -2.02]}>
                <boxGeometry args={[1.7, 0.05, 0.05]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={5} toneMapped={false} />
            </mesh>

            {/* ── Headlights (front = -Z) ── */}
            {[-0.6, 0.6].map((x, i) => (
                <mesh key={`hl-${i}`} position={[x, 0.08, -2.02]}>
                    <boxGeometry args={[0.4, 0.14, 0.06]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={6} toneMapped={false} />
                </mesh>
            ))}

            {/* ── Tail lights (rear = +Z) ── */}
            {[-0.6, 0.6].map((x, i) => (
                <mesh key={`tl-${i}`} position={[x, 0.1, 2.02]}>
                    <boxGeometry args={[0.45, 0.12, 0.06]} />
                    <meshStandardMaterial color="#ff0033" emissive="#ff0033" emissiveIntensity={5} toneMapped={false} />
                </mesh>
            ))}

            {/* ── Rear neon bar ── */}
            <mesh position={[0, 0.1, 2.02]}>
                <boxGeometry args={[1.5, 0.04, 0.04]} />
                <meshStandardMaterial color="#ff0033" emissive="#ff0033" emissiveIntensity={4} toneMapped={false} />
            </mesh>

            {/* ── Spoiler ── */}
            {[-0.55, 0.55].map((x, i) => (
                <mesh key={`sp-${i}`} position={[x, 0.5, 1.6]}>
                    <boxGeometry args={[0.06, 0.35, 0.06]} />
                    <meshStandardMaterial color="#0d0d1a" metalness={0.9} roughness={0.2} />
                </mesh>
            ))}
            <mesh position={[0, 0.68, 1.65]}>
                <boxGeometry args={[1.5, 0.05, 0.35]} />
                <meshStandardMaterial color="#0d0d1a" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.68, 1.82]}>
                <boxGeometry args={[1.5, 0.03, 0.03]} />
                <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={3} toneMapped={false} />
            </mesh>

            {/* ── Actual lights ── */}
            <pointLight position={[0, 0.3, -3.5]} color="#aaddff" intensity={15} distance={30} />
            <pointLight position={[0, -0.3, 0]} color="#00ffff" intensity={3} distance={5} />
            <pointLight position={[0, 0.1, 3]} color="#ff2200" intensity={2} distance={6} />

            {/* ── Exhaust flames (visible during nitro) ── */}
            <mesh ref={flame1Ref} position={[-0.35, 0.05, 2.6]} visible={false}>
                <boxGeometry args={[0.3, 0.25, 1]} />
                <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={8} toneMapped={false} transparent opacity={0.9} />
            </mesh>
            <mesh ref={flame2Ref} position={[0.35, 0.05, 2.6]} visible={false}>
                <boxGeometry args={[0.3, 0.25, 1]} />
                <meshStandardMaterial color="#ff8800" emissive="#ff6600" emissiveIntensity={8} toneMapped={false} transparent opacity={0.9} />
            </mesh>
            <pointLight ref={flameLightRef} position={[0, 0.1, 3.5]} color="#ff6600" intensity={0} distance={15} />
        </group>
    );
}
