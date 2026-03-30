import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_WIDTH } from './Road';
import { getCurveOffset } from '../utils/curveOffset';
import { TrackConfig } from '../menu/useGameFlow';

const DUNE_COUNT = 40;
const ROAD_HALF = ROAD_WIDTH / 2;
const DESERT_DEPTH = 300;

interface DesertProps {
    speed: number;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
}

export function Desert({ speed, playerDistRef, track }: DesertProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const scrollRef = useRef(0);

    const geo = useMemo(() => new THREE.SphereGeometry(1, 32, 16), []);
    const mat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#cc7744',
        roughness: 1.0,
        metalness: 0.0,
        flatShading: true,
    }), []);

    const dunes = useMemo(() => {
        const arr = [];
        for (let i = 0; i < DUNE_COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const w = 20 + Math.random() * 40;
            const h = 5 + Math.random() * 15;
            const d = 20 + Math.random() * 40;

            // Spread dunes wide. Crucial: offset by `w` so the dune's radius doesn't clip the road
            const x = side * (ROAD_HALF + w + 15 + Math.random() * 150);
            const z = -DESERT_DEPTH / 2 + (i / DUNE_COUNT) * DESERT_DEPTH + (Math.random() - 0.5) * 20;

            arr.push({ x, y: -h * 0.2, z, w, h, d });
        }
        return arr;
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        const obj = new THREE.Object3D();
        dunes.forEach((d, i) => {
            obj.position.set(d.x, d.y, d.z);
            obj.scale.set(d.w, d.h, d.d);
            obj.updateMatrix();
            meshRef.current!.setMatrixAt(i, obj.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [dunes]);

    useFrame((_, dt) => {
        scrollRef.current += speed * dt;
        if (!meshRef.current) return;

        const dist = playerDistRef?.current || 0;
        const obj = new THREE.Object3D();
        const half = DESERT_DEPTH / 2;

        dunes.forEach((d, i) => {
            let z = d.z + scrollRef.current;
            z = ((z + half) % DESERT_DEPTH) - half; // Wrap

            const curve = getCurveOffset(z, dist, track);

            obj.position.set(d.x + curve, d.y, z);
            obj.scale.set(d.w, d.h, d.d);
            obj.updateMatrix();
            meshRef.current!.setMatrixAt(i, obj.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            <instancedMesh ref={meshRef} args={[geo, mat, DUNE_COUNT]} receiveShadow />

            {/* Flat sand ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
                <planeGeometry args={[1000, 1000]} />
                <meshStandardMaterial color="#3a2a1a" roughness={1} />
            </mesh>
        </group>
    );
}
