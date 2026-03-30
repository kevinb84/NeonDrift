import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const LINE_COUNT = 60;

interface SpeedLinesProps {
    speed: React.RefObject<number>;
    nitroActive: React.RefObject<boolean>;
}

/**
 * Speed lines that streak past the camera at high speeds.
 * More lines + brighter when nitro is active.
 */
export function SpeedLines({ speed, nitroActive }: SpeedLinesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const col = useMemo(() => new THREE.Color(), []);

    // Per-line data
    const lines = useRef(
        Array.from({ length: LINE_COUNT }, () => ({
            x: (Math.random() - 0.5) * 20,
            y: Math.random() * 6 + 0.5,
            z: -Math.random() * 80,
            speed: 0.5 + Math.random() * 0.5,
        })),
    );

    useFrame((_, dt) => {
        if (!meshRef.current) return;
        const spd = speed.current ?? 30;
        const isNitro = nitroActive.current;

        // Only show at higher speeds
        const intensity = Math.max(0, (spd - 40) / 40); // 0 at 40, 1 at 80
        const nitroMul = isNitro ? 2.5 : 1;

        lines.current.forEach((line, i) => {
            // Move toward camera
            line.z += spd * line.speed * dt * nitroMul;

            // Wrap
            if (line.z > 15) {
                line.z = -60 - Math.random() * 30;
                line.x = (Math.random() - 0.5) * 20;
                line.y = Math.random() * 6 + 0.5;
            }

            dummy.position.set(line.x, line.y, line.z);
            // Stretch Z based on speed
            const stretch = 0.5 + intensity * 3 * nitroMul;
            dummy.scale.set(0.02, 0.02, stretch);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);

            // Color: white normally, cyan+bright during nitro
            const alpha = intensity * (isNitro ? 1 : 0.5);
            if (isNitro) {
                col.setRGB(0.3 * alpha, 0.8 * alpha, 1.0 * alpha);
            } else {
                col.setRGB(0.7 * alpha, 0.7 * alpha, 0.9 * alpha);
            }
            meshRef.current!.setColorAt(i, col);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, LINE_COUNT]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
        </instancedMesh>
    );
}
