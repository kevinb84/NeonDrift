import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ROAD_WIDTH = 24; // Must match Road.tsx

/**
 * A checkered finish / lap gate that scrolls toward the player.
 * When the player crosses it, the gate wraps back to its start distance.
 */
export function FinishLine({
    playerDist,
    lapDistance,
}: {
    playerDist: React.RefObject<number>;
    lapDistance: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    // How far ahead to show the finish line (in scene units)
    // The finish appears when remaining = 0 -> we show it approaching from DIST_AHEAD
    const DIST_AHEAD = 60;

    useFrame(() => {
        const group = groupRef.current;
        if (!group) return;
        const dist = playerDist.current ?? 0;

        // Distance player has left in current lap
        const lapProgress = dist % lapDistance;
        const remaining = lapDistance - lapProgress;

        // Place the gate `remaining` units ahead (in -Z)
        // but cap to DIST_AHEAD so it only appears close by
        const zPos = -Math.min(remaining, DIST_AHEAD);

        // Only show when within sight range
        const visible = remaining <= DIST_AHEAD;
        group.visible = visible;
        group.position.set(0, 0, zPos);
    });

    const checkerCount = 8;
    const tileW = ROAD_WIDTH / checkerCount;
    const tileH = 0.6;

    // Checkerboard banner geometry (flat, on the road)
    const tileGeo = new THREE.BoxGeometry(tileW - 0.08, 0.04, tileH);
    // Pole geometry
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 8, 8);
    // Crossbeam
    const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 0.4, 0.25, 0.25);
    // Glowing line on road
    const lineGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.05, 0.3);

    return (
        <group ref={groupRef} visible={false}>
            {/* Left & right poles */}
            <mesh geometry={poleGeo} position={[-(ROAD_WIDTH / 2 + 0.3), 4, 0]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh geometry={poleGeo} position={[ROAD_WIDTH / 2 + 0.3, 4, 0]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} metalness={0.7} roughness={0.2} />
            </mesh>

            {/* Crossbeam */}
            <mesh geometry={beamGeo} position={[0, 8.1, 0]}>
                <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.15} />
            </mesh>

            {/* Checkered tiles on crossbeam */}
            {Array.from({ length: checkerCount }).map((_, i) => {
                const isWhite = i % 2 === 0;
                const xPos = -(ROAD_WIDTH / 2) + tileW * i + tileW / 2;
                return (
                    <mesh key={i} geometry={tileGeo} position={[xPos, 8.1, 0]}>
                        <meshStandardMaterial
                            color={isWhite ? '#ffffff' : '#111111'}
                            emissive={isWhite ? '#ffffff' : '#000000'}
                            emissiveIntensity={isWhite ? 0.6 : 0}
                        />
                    </mesh>
                );
            })}

            {/* Glowing road line */}
            <mesh geometry={lineGeo} position={[0, 0.03, 0]}>
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={8} toneMapped={false} />
            </mesh>

            {/* Pole glow lights */}
            <pointLight position={[-(ROAD_WIDTH / 2 + 0.3), 6, 0]} color="#00ffff" intensity={6} distance={18} />
            <pointLight position={[ROAD_WIDTH / 2 + 0.3, 6, 0]} color="#00ffff" intensity={6} distance={18} />
            {/* Banner glow */}
            <pointLight position={[0, 8, 2]} color="#ffffff" intensity={4} distance={20} />

            {/* "FINISH" label rendered as emissive strip — simple neon sign using thin boxes */}
            {/* We use a colored emissive plane as a quick label effect */}
            <mesh position={[0, 6.5, 0.15]}>
                <planeGeometry args={[10, 1.2]} />
                <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={4} toneMapped={false} transparent opacity={0.9} />
            </mesh>
        </group>
    );
}
