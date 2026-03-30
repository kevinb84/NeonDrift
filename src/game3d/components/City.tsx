import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_WIDTH } from './Road';
import { getCurveOffset } from '../utils/curveOffset';
import { TrackConfig } from '../menu/useGameFlow';

const BUILDING_COUNT = 160;
const ROAD_HALF = ROAD_WIDTH / 2;
const SIDEWALK = 2;                       // Gap between road edge and first building
const CITY_DEPTH = 400;                   // Matches road length
const MAX_SPREAD = 60;                    // How far buildings go from road

const NEON_COLORS = [
    '#ff00ff', '#00ffff', '#ff0066', '#00ff88',
    '#ff6600', '#aa00ff', '#0088ff', '#ffff00',
    '#ff3399', '#33ffcc', '#6600ff', '#ff4400',
];

interface Building {
    px: number; py: number; pz: number;
    sx: number; sy: number; sz: number;
    accent: string;
    bandY: number; bandH: number;
}

interface CityProps {
    speed: number;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
}

/** Cyberpunk city — buildings tightly flanking both sides of the road */
export function City({ speed, playerDistRef, track }: CityProps) {
    const bodyRef = useRef<THREE.InstancedMesh>(null);
    const bandRef = useRef<THREE.InstancedMesh>(null);
    const dataRef = useRef<Building[]>([]);
    const scrollRef = useRef(0);

    const buildings = useMemo(() => {
        const arr: Building[] = [];
        for (let i = 0; i < BUILDING_COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1;

            // Distance from road edge: some right next to road, some farther
            const dist = SIDEWALK + Math.pow(Math.random(), 0.6) * MAX_SPREAD;
            const x = side * (ROAD_HALF + dist);

            // Building dimensions — taller near road, shorter farther away
            const nearRoad = dist < 15;
            const w = 3 + Math.random() * 8;
            const h = nearRoad
                ? 15 + Math.random() * 50    // Tall near road (15–65)
                : 5 + Math.random() * 25;    // Shorter far away (5–30)
            const d = 3 + Math.random() * 8;

            const z = -CITY_DEPTH / 2 + (i / BUILDING_COUNT) * CITY_DEPTH + (Math.random() - 0.5) * 20;

            const accent = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
            const bandY = 2 + Math.random() * h * 0.5;
            const bandH = 0.15 + Math.random() * 0.5;

            arr.push({
                px: x, py: h / 2, pz: z,   // y = half height so base sits on ground
                sx: w, sy: h, sz: d,
                accent, bandY, bandH,
            });
        }
        return arr;
    }, []);

    // Set initial transforms
    useEffect(() => {
        dataRef.current = buildings;
        const body = bodyRef.current;
        const band = bandRef.current;
        if (!body || !band) return;

        const obj = new THREE.Object3D();
        const col = new THREE.Color();

        buildings.forEach((b, i) => {
            // Body
            obj.position.set(b.px, b.py, b.pz);
            obj.scale.set(b.sx, b.sy, b.sz);
            obj.updateMatrix();
            body.setMatrixAt(i, obj.matrix);
            const shade = 0.05 + Math.random() * 0.08;
            col.setRGB(shade, shade, shade + 0.02);
            body.setColorAt(i, col);

            // Neon accent band
            obj.position.set(b.px, b.bandY, b.pz);
            obj.scale.set(b.sx + 0.2, b.bandH, b.sz + 0.2);
            obj.updateMatrix();
            band.setMatrixAt(i, obj.matrix);
            col.set(b.accent);
            band.setColorAt(i, col);
        });

        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
        band.instanceMatrix.needsUpdate = true;
        if (band.instanceColor) band.instanceColor.needsUpdate = true;
    }, [buildings]);

    // Scroll buildings toward camera
    useFrame((_, dt) => {
        scrollRef.current += speed * dt;
        const body = bodyRef.current;
        const band = bandRef.current;
        if (!body || !band) return;

        const dist = playerDistRef?.current || 0;
        const obj = new THREE.Object3D();
        const half = CITY_DEPTH / 2;

        dataRef.current.forEach((b, i) => {
            let z = b.pz + scrollRef.current;
            z = ((z + half) % CITY_DEPTH) - half; // Wrap

            const curve = getCurveOffset(z, dist, track);

            // Body
            obj.position.set(b.px + curve, b.py, z);
            obj.scale.set(b.sx, b.sy, b.sz);
            obj.updateMatrix();
            body.setMatrixAt(i, obj.matrix);

            // Band
            obj.position.set(b.px + curve, b.bandY, z);
            obj.scale.set(b.sx + 0.2, b.bandH, b.sz + 0.2);
            obj.updateMatrix();
            band.setMatrixAt(i, obj.matrix);
        });

        body.instanceMatrix.needsUpdate = true;
        band.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            {/* Building bodies */}
            <instancedMesh ref={bodyRef} args={[undefined, undefined, BUILDING_COUNT]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#0a0a12" roughness={0.8} metalness={0.15} />
            </instancedMesh>

            {/* Neon accent bands */}
            <instancedMesh ref={bandRef} args={[undefined, undefined, BUILDING_COUNT]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#ffffff"
                    emissiveIntensity={2}
                    toneMapped={false}
                />
            </instancedMesh>

            {/* Streetlights along road edges */}
            {Array.from({ length: 20 }).map((_, i) => {
                const z = -CITY_DEPTH / 2 + i * (CITY_DEPTH / 20);
                return [
                    <pointLight key={`sl-l-${i}`} position={[-(ROAD_HALF + 1), 8, z]}
                        color="#ff88ff" intensity={1.5} distance={25} />,
                    <pointLight key={`sl-r-${i}`} position={[ROAD_HALF + 1, 8, z]}
                        color="#88ffff" intensity={1.5} distance={25} />,
                ];
            })}
        </group>
    );
}
