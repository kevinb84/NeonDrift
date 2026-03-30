import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCurveOffset } from '../utils/curveOffset';
import { TrackConfig } from '../menu/useGameFlow';

const PARTICLE_COUNT = 200;
const SPREAD_X = 60;
const SPREAD_Y = 30;
const SPREAD_Z = 150;

interface ParticlesProps {
    speed: number;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
}

/** Floating neon particles / dust for atmosphere */
export function Particles({ speed, playerDistRef, track }: ParticlesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);

    const particles = useMemo(() => {
        const data: { pos: THREE.Vector3; speed: number; size: number }[] = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            data.push({
                pos: new THREE.Vector3(
                    (Math.random() - 0.5) * SPREAD_X,
                    Math.random() * SPREAD_Y + 10,
                    (Math.random() - 0.5) * SPREAD_Z
                ),
                speed: 0.2 + Math.random() * 0.5,
                size: 0.02 + Math.random() * 0.06,
            });
        }
        return data;
    }, []);

    // Initialize
    useEffect(() => {
        // Delay init to after mesh is available
        setTimeout(() => {
            const mesh = meshRef.current;
            if (!mesh) return;
            const dummy = new THREE.Object3D();
            const color = new THREE.Color();
            const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff6600', '#00ff88'];

            particles.forEach((p, i) => {
                dummy.position.copy(p.pos);
                dummy.scale.setScalar(p.size);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                color.set(colors[i % colors.length]);
                mesh.setColorAt(i, color);
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }, 100);
    }, [particles]);

    useFrame((_, delta) => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const dummy = new THREE.Object3D();
        const halfZ = SPREAD_Z / 2;
        const dist = playerDistRef?.current || 0;

        particles.forEach((p, i) => {
            // Scroll with the scene
            p.pos.z += speed * delta * p.speed;
            // Gentle float
            p.pos.y += Math.sin(Date.now() * 0.001 + i) * 0.003;

            // Wrap Z
            if (p.pos.z > halfZ) p.pos.z -= SPREAD_Z;
            if (p.pos.z < -halfZ) p.pos.z += SPREAD_Z;

            // Apply curvature relative to camera
            const curve = getCurveOffset(p.pos.z, dist, track);

            dummy.position.set(p.pos.x + curve, p.pos.y, p.pos.z);
            dummy.scale.setScalar(p.size);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={2}
                toneMapped={false}
                transparent
                opacity={0.6}
            />
        </instancedMesh>
    );
}
