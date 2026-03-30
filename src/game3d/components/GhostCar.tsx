import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TrackConfig } from '../menu/useGameFlow';
import type { GhostState } from '../hooks/useGhostPlayback';
import { getCurveOffset } from '../utils/curveOffset';

const CAR_Y = 0.5;

/**
 * Renders a ghost replay car on the track.
 * Semi-transparent with a unique teal/holographic color scheme
 * so the player can clearly see it's a replay, not a real opponent.
 */
export function GhostCar({
    getState,
    playerDistRef,
    track,
}: {
    getState: () => GhostState | null;
    playerDistRef: React.MutableRefObject<number>;
    track?: TrackConfig;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const prevXRef = useRef(0);
    const prevZRef = useRef(0);
    const isFirstFrame = useRef(true);
    const tiltRef = useRef(0);

    const bodyGeo = useMemo(() => new THREE.BoxGeometry(2.0, 0.5, 4.0), []);
    const cabinGeo = useMemo(() => new THREE.BoxGeometry(1.4, 0.35, 1.8), []);
    const underGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.04, 3.8), []);
    const sideGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.1, 3.8), []);
    const spoilerWingGeo = useMemo(() => new THREE.BoxGeometry(1.5, 0.05, 0.35), []);
    const labelGeo = useMemo(() => new THREE.PlaneGeometry(2.5, 0.35), []);

    useFrame((_, dt) => {
        if (!groupRef.current) return;

        const state = getState();
        if (!state) {
            groupRef.current.visible = false;
            return;
        }

        groupRef.current.visible = true;

        const localDist = playerDistRef.current;
        const distDiff = state.totalDist - localDist;
        const targetZ = -distDiff;

        if (isFirstFrame.current) {
            prevZRef.current = targetZ;
            prevXRef.current = state.x;
            isFirstFrame.current = false;
        }

        // Hide if too far away
        if (Math.abs(targetZ) > 150) {
            groupRef.current.visible = false;
            return;
        }

        // Smooth Z and X
        prevZRef.current = THREE.MathUtils.lerp(prevZRef.current, targetZ, dt * 12);
        const curveOffset = getCurveOffset(prevZRef.current, localDist, track);

        const dx = state.x - prevXRef.current;
        prevXRef.current = THREE.MathUtils.lerp(prevXRef.current, state.x, dt * 10);
        tiltRef.current = THREE.MathUtils.lerp(tiltRef.current, THREE.MathUtils.clamp(dx * -3, -0.12, 0.12), dt * 6);

        groupRef.current.position.set(
            prevXRef.current + curveOffset,
            CAR_Y + Math.sin(Date.now() * 0.005) * 0.04,
            prevZRef.current
        );
        groupRef.current.rotation.z = tiltRef.current;
    });

    // Ghost color scheme — translucent cyan holographic
    const ghostColor = '#00ddff';
    const ghostEmissive = '#00aacc';

    return (
        <group ref={groupRef} visible={false}>
            {/* Body — semi-transparent */}
            <mesh geometry={bodyGeo} castShadow>
                <meshStandardMaterial
                    color={ghostColor}
                    emissive={ghostEmissive}
                    emissiveIntensity={0.8}
                    transparent
                    opacity={0.35}
                    metalness={0.5}
                    roughness={0.3}
                    toneMapped={false}
                />
            </mesh>

            {/* Cabin */}
            <mesh geometry={cabinGeo} position={[0, 0.42, 0.3]}>
                <meshStandardMaterial
                    color={ghostColor}
                    emissive={ghostEmissive}
                    emissiveIntensity={0.6}
                    transparent
                    opacity={0.25}
                    toneMapped={false}
                />
            </mesh>

            {/* Underbody glow */}
            <mesh geometry={underGeo} position={[0, -0.28, 0]}>
                <meshStandardMaterial
                    color={ghostColor}
                    emissive={ghostColor}
                    emissiveIntensity={3}
                    transparent
                    opacity={0.6}
                    toneMapped={false}
                />
            </mesh>

            {/* Side strips */}
            {[-1.02, 1.02].map((x, i) => (
                <mesh key={`gs-${i}`} geometry={sideGeo} position={[x, -0.05, 0]}>
                    <meshStandardMaterial
                        color={ghostColor}
                        emissive={ghostColor}
                        emissiveIntensity={3}
                        transparent
                        opacity={0.5}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {/* Spoiler wing */}
            <mesh geometry={spoilerWingGeo} position={[0, 0.68, 1.65]}>
                <meshStandardMaterial
                    color={ghostColor}
                    emissive={ghostEmissive}
                    emissiveIntensity={1}
                    transparent
                    opacity={0.3}
                    toneMapped={false}
                />
            </mesh>

            {/* Point lights for glow effect */}
            <pointLight position={[0, -0.3, 0]} color={ghostColor} intensity={2} distance={6} />
            <pointLight position={[0, 0.3, -3]} color={ghostColor} intensity={8} distance={20} />

            {/* "GHOST" label floating above */}
            <mesh geometry={labelGeo} position={[0, 1.8, 0]}>
                <meshBasicMaterial color={ghostColor} transparent opacity={0.5} toneMapped={false} />
            </mesh>
        </group>
    );
}
