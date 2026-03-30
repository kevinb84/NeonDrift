import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCurveOffset } from '../utils/curveOffset';
import { TrackConfig } from '../menu/useGameFlow';

const SECTION_LENGTH = 40;
const SECTION_COUNT = 8;
const TUNNEL_WIDTH = 32;
const TUNNEL_HEIGHT = 16;
const TOTAL_LENGTH = SECTION_LENGTH * SECTION_COUNT;

interface TunnelProps {
    speed: number;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
}

export function Tunnel({ speed, playerDistRef, track }: TunnelProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((_, dt) => {
        const group = groupRef.current;
        if (!group) return;

        const dist = playerDistRef?.current || 0;

        group.children.forEach((section) => {
            section.position.z += speed * dt;

            // Wrap section back
            if (section.position.z > SECTION_LENGTH) {
                section.position.z -= TOTAL_LENGTH;
            }

            // Apply curvature relative to camera view
            // In three.js group hierarchy Z is local to group, here it perfectly works as distance
            const curve = getCurveOffset(section.position.z, dist, track);
            section.position.x = curve;
        });
    });

    return (
        <group ref={groupRef}>
            {Array.from({ length: SECTION_COUNT }).map((_, i) => (
                <group key={i} position={[0, 0, -i * SECTION_LENGTH]}>
                    {/* Walls / Ceiling */}
                    <mesh position={[0, TUNNEL_HEIGHT / 2 - 0.5, 0]}>
                        <boxGeometry args={[TUNNEL_WIDTH, 1, SECTION_LENGTH]} />
                        <meshStandardMaterial color="#111" roughness={0.5} />
                    </mesh>

                    {/* Left Wall */}
                    <mesh position={[-TUNNEL_WIDTH / 2 + 0.5, TUNNEL_HEIGHT / 4, 0]}>
                        <boxGeometry args={[1, TUNNEL_HEIGHT, SECTION_LENGTH]} />
                        <meshStandardMaterial color="#111" roughness={0.5} />
                    </mesh>

                    {/* Right Wall */}
                    <mesh position={[TUNNEL_WIDTH / 2 - 0.5, TUNNEL_HEIGHT / 4, 0]}>
                        <boxGeometry args={[1, TUNNEL_HEIGHT, SECTION_LENGTH]} />
                        <meshStandardMaterial color="#111" roughness={0.5} />
                    </mesh>

                    {/* Emissive Rings */}
                    <mesh position={[0, TUNNEL_HEIGHT / 4, 0]}>
                        <torusGeometry args={[TUNNEL_WIDTH / 2 - 2, 0.2, 8, 4]} />
                        <meshStandardMaterial
                            color="#ff00ff"
                            emissive="#ff00ff"
                            emissiveIntensity={4}
                            toneMapped={false}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}
