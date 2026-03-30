import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TrackConfig } from '../menu/useGameFlow';
import type { RemotePlayerData } from '../hooks/useMultiplayerSync';
import { getCurveOffset } from '../utils/curveOffset';

const CAR_Y = 0.5;

/**
 * Renders a remote player's car on the track.
 * Position is interpolated from the latest network state to appear smooth.
 * 
 * The car uses a distinct color scheme (magenta/pink neon) to differentiate
 * from the player car (cyan) and AI opponents.
 */
export function RemotePlayer({
    getState,
    playerDistRef,
    track,
}: {
    getState: () => RemotePlayerData | null;
    playerDistRef: React.MutableRefObject<number>;
    track?: TrackConfig;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const tiltRef = useRef(0);
    const prevXRef = useRef(0);
    const prevZRef = useRef(0);
    const isFirstRender = useRef(true);
    const visibleRef = useRef(false);

    // Shared geometry for performance
    const bodyGeo = useMemo(() => new THREE.BoxGeometry(2.0, 0.5, 4.0), []);
    const hoodGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.2, 1.4), []);
    const cabinGeo = useMemo(() => new THREE.BoxGeometry(1.4, 0.35, 1.8), []);
    const underGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.04, 3.8), []);
    const sideGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.1, 3.8), []);
    const headlightGeo = useMemo(() => new THREE.BoxGeometry(0.4, 0.14, 0.06), []);
    const taillightGeo = useMemo(() => new THREE.BoxGeometry(0.45, 0.12, 0.06), []);
    const spoilerPostGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.35, 0.06), []);
    const spoilerWingGeo = useMemo(() => new THREE.BoxGeometry(1.5, 0.05, 0.35), []);
    const nameTagGeo = useMemo(() => new THREE.PlaneGeometry(3, 0.4), []);

    useFrame((_, dt) => {
        if (!groupRef.current) return;

        const state = getState();
        if (!state) {
            groupRef.current.visible = false;
            visibleRef.current = false;
            return;
        }

        groupRef.current.visible = true;
        visibleRef.current = true;

        const localDist = playerDistRef.current;
        
        // Calculate Z position relative to our camera
        const distDiff = state.totalDist - localDist;
        const targetZ = -distDiff; // negative = ahead of us, positive = behind

        if (isFirstRender.current) {
            prevZRef.current = targetZ;
            prevXRef.current = state.x;
            isFirstRender.current = false;
        }

        // Only render if reasonably close (within visible road segment)
        if (Math.abs(targetZ) > 150) {
            groupRef.current.visible = false;
            return;
        }

        // Smooth longitudinally (forward/backward) to hide packet jitter
        prevZRef.current = THREE.MathUtils.lerp(prevZRef.current, targetZ, dt * 10);

        // Calculate curve offset at the smoothed opponent's position
        const curveOffset = getCurveOffset(prevZRef.current, localDist, track);

        // Smooth lateral movement with tilt
        const dx = state.x - prevXRef.current;
        prevXRef.current = THREE.MathUtils.lerp(prevXRef.current, state.x, dt * 8);
        tiltRef.current = THREE.MathUtils.lerp(tiltRef.current, THREE.MathUtils.clamp(dx * -3, -0.15, 0.15), dt * 6);

        // Position the car
        groupRef.current.position.set(
            prevXRef.current + curveOffset,
            CAR_Y + Math.sin(Date.now() * 0.004) * 0.02, // hover bob
            prevZRef.current
        );

        // Tilt
        groupRef.current.rotation.z = tiltRef.current;
    });

    // Color scheme — distinct "rival" colors (hot pink / magenta theme)
    const bodyColor = '#1a0018';
    const accentColor = '#ff4488';
    const glowColor = '#ff0066';
    const neonColor = '#ff44aa';

    return (
        <group ref={groupRef} visible={false}>
            {/* ── Main body ── */}
            <mesh geometry={bodyGeo} castShadow>
                <meshStandardMaterial color={bodyColor} metalness={0.85} roughness={0.2} />
            </mesh>

            {/* ── Hood ── */}
            <mesh geometry={hoodGeo} position={[0, 0.05, -0.8]} castShadow>
                <meshStandardMaterial color="#1e0020" metalness={0.8} roughness={0.25} />
            </mesh>

            {/* ── Cabin ── */}
            <mesh geometry={cabinGeo} position={[0, 0.42, 0.3]} castShadow>
                <meshStandardMaterial color="#200028" metalness={0.6} roughness={0.3} transparent opacity={0.85} />
            </mesh>

            {/* ── Windshield ── */}
            <mesh position={[0, 0.45, -0.45]}>
                <boxGeometry args={[1.3, 0.25, 0.08]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} transparent opacity={0.35} toneMapped={false} />
            </mesh>

            {/* ── Underbody neon ── */}
            <mesh geometry={underGeo} position={[0, -0.28, 0]}>
                <meshStandardMaterial color={accentColor} emissive={glowColor} emissiveIntensity={4} transparent opacity={0.9} toneMapped={false} />
            </mesh>

            {/* ── Side neon strips ── */}
            <mesh geometry={sideGeo} position={[-1.02, -0.05, 0]}>
                <meshStandardMaterial color={neonColor} emissive={neonColor} emissiveIntensity={4} toneMapped={false} />
            </mesh>
            <mesh geometry={sideGeo} position={[1.02, -0.05, 0]}>
                <meshStandardMaterial color={neonColor} emissive={neonColor} emissiveIntensity={4} toneMapped={false} />
            </mesh>

            {/* ── Front accent ── */}
            <mesh position={[0, 0.02, -2.02]}>
                <boxGeometry args={[1.7, 0.05, 0.05]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={5} toneMapped={false} />
            </mesh>

            {/* ── Headlights ── */}
            {[-0.6, 0.6].map((x, i) => (
                <mesh key={`rp-hl-${i}`} geometry={headlightGeo} position={[x, 0.08, -2.02]}>
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={6} toneMapped={false} />
                </mesh>
            ))}

            {/* ── Tail lights ── */}
            {[-0.6, 0.6].map((x, i) => (
                <mesh key={`rp-tl-${i}`} geometry={taillightGeo} position={[x, 0.1, 2.02]}>
                    <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={5} toneMapped={false} />
                </mesh>
            ))}

            {/* ── Rear neon bar ── */}
            <mesh position={[0, 0.1, 2.02]}>
                <boxGeometry args={[1.5, 0.04, 0.04]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={4} toneMapped={false} />
            </mesh>

            {/* ── Spoiler ── */}
            {[-0.55, 0.55].map((x, i) => (
                <mesh key={`rp-sp-${i}`} geometry={spoilerPostGeo} position={[x, 0.5, 1.6]}>
                    <meshStandardMaterial color={bodyColor} metalness={0.9} roughness={0.2} />
                </mesh>
            ))}
            <mesh geometry={spoilerWingGeo} position={[0, 0.68, 1.65]}>
                <meshStandardMaterial color={bodyColor} metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.68, 1.82]}>
                <boxGeometry args={[1.5, 0.03, 0.03]} />
                <meshStandardMaterial color={neonColor} emissive={neonColor} emissiveIntensity={3} toneMapped={false} />
            </mesh>

            {/* ── Lights ── */}
            <pointLight position={[0, 0.3, -3.5]} color="#ffaacc" intensity={15} distance={30} />
            <pointLight position={[0, -0.3, 0]} color={glowColor} intensity={3} distance={5} />
            <pointLight position={[0, 0.1, 3]} color={glowColor} intensity={2} distance={6} />

            {/* ── Name tag floating above car ── */}
            <mesh geometry={nameTagGeo} position={[0, 1.8, 0]} rotation={[0, 0, 0]}>
                <meshBasicMaterial color={accentColor} transparent opacity={0.7} toneMapped={false} />
            </mesh>
        </group>
    );
}
