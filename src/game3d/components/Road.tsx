import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TrackConfig } from '../menu/useGameFlow';
import { getCurveOffset } from '../utils/curveOffset';

// ── World-scale constants (shared across components) ──
export const ROAD_WIDTH = 24;        // Wide enough for 4 cars (each ~2 units wide + gaps)
export const LANE_COUNT = 4;
export const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT; // 6 units per lane
export const ROAD_LENGTH = 400;      // How far the road stretches
const SEGMENTS = 64;                 // How many segments the road has for bending

interface RoadProps {
    speed: number;
    accentColor?: string;
    envType?: string;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
}

/** Neon highway road — lies flat on XZ plane, extends along -Z (forward) */
export function Road({ speed, accentColor = '#00ffff', envType = 'city', playerDistRef, track }: RoadProps) {
    const dashGroupRef = useRef<THREE.InstancedMesh>(null);
    const scrollRef = useRef(0);
    const roadRef = useRef<THREE.Mesh>(null);
    const groundRef = useRef<THREE.Mesh>(null);
    const leftEdgeRef = useRef<THREE.Mesh>(null);
    const rightEdgeRef = useRef<THREE.Mesh>(null);
    const leftGlowRef = useRef<THREE.Mesh>(null);
    const rightGlowRef = useRef<THREE.Mesh>(null);
    const leftCurbRef = useRef<THREE.Mesh>(null);
    const rightCurbRef = useRef<THREE.Mesh>(null);

    const dashGeo = useMemo(() => new THREE.PlaneGeometry(0.12, 3), []);
    // Reuse across frames — never allocate inside useFrame
    const dashDummy = useMemo(() => new THREE.Object3D(), []);
    const lastDistRef = useRef(-999); // track last applied dist to skip no-op updates

    // Dash data (x, z base offset)
    const dashes = useMemo(() => {
        const arr: { x: number; zOffset: number }[] = [];
        for (let lane = 1; lane < LANE_COUNT; lane++) {
            const x = -ROAD_WIDTH / 2 + lane * LANE_WIDTH;
            for (let z = ROAD_LENGTH / 2; z > -ROAD_LENGTH / 2; z -= 8) {
                arr.push({ x, zOffset: -z });
            }
        }
        return arr;
    }, []);

    // Set up instanced dashes
    useMemo(() => {
        setTimeout(() => {
            if (!dashGroupRef.current) return;
            const dummy = new THREE.Object3D();
            dummy.position.y = 0.02;
            dummy.rotation.x = -Math.PI / 2;

            dashes.forEach((d, i) => {
                dummy.position.x = d.x;
                dummy.position.z = d.zOffset;
                dummy.updateMatrix();
                dashGroupRef.current!.setMatrixAt(i, dummy.matrix);
            });
            dashGroupRef.current!.instanceMatrix.needsUpdate = true;
        }, 100);
    }, [dashes]);

    // Apply curve to geometry by directly modifying vertices
    const applyCurve = (mesh: THREE.Mesh | null, dist: number) => {
        if (!mesh) return;
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        if (!pos) return;

        for (let i = 0; i < pos.count; i++) {
            const originalX = geo.userData.originalX?.[i] ?? pos.getX(i);
            const originalY = geo.userData.originalY?.[i] ?? pos.getY(i); // Y is Z direction before rotation

            // Note: Geometry is rotated -90deg on X, so its local Y is world -Z
            const worldZ = -originalY;
            const curve = getCurveOffset(worldZ, dist, track);

            pos.setX(i, originalX + curve);
        }
        pos.needsUpdate = true;
    };

    // Store original vertices for bending
    const initializeGeometry = (mesh: THREE.Mesh | null) => {
        if (!mesh) return;
        const geo = mesh.geometry;
        if (geo.userData.initialized) return;

        const pos = geo.attributes.position;
        geo.userData.originalX = new Float32Array(pos.count);
        geo.userData.originalY = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            geo.userData.originalX[i] = pos.getX(i);
            geo.userData.originalY[i] = pos.getY(i);
        }
        geo.userData.initialized = true;
    };


    useFrame((_, dt) => {
        const dist = playerDistRef?.current || 0;

        // Only re-apply curve when player has moved enough — avoids wasting
        // 512 vertex CPU writes and GPU uploads on frames where camera is still
        const distMoved = Math.abs(dist - lastDistRef.current);
        const needsCurveUpdate = distMoved > 0.5;
        if (needsCurveUpdate) {
            lastDistRef.current = dist;

            // Initialize once
            [roadRef.current, leftEdgeRef.current, rightEdgeRef.current,
            leftGlowRef.current, rightGlowRef.current,
            leftCurbRef.current, rightCurbRef.current].forEach(initializeGeometry);

            // Apply curvature
            [roadRef.current, leftEdgeRef.current, rightEdgeRef.current,
            leftGlowRef.current, rightGlowRef.current,
            leftCurbRef.current, rightCurbRef.current].forEach(m => applyCurve(m, dist));

            if (groundRef.current) {
                initializeGeometry(groundRef.current);
                applyCurve(groundRef.current, dist);
            }
        }

        // Scroll dashes every frame (cheap — just matrix updates)
        scrollRef.current = (scrollRef.current + speed * dt) % 8;
        if (dashGroupRef.current) {
            // dashDummy is hoisted — no allocation here
            dashDummy.position.y = 0.02;
            dashDummy.rotation.x = -Math.PI / 2;

            dashes.forEach((d, i) => {
                let currentZ = d.zOffset + scrollRef.current;
                if (currentZ > ROAD_LENGTH / 2) currentZ -= ROAD_LENGTH;

                const curve = getCurveOffset(currentZ, dist, track);

                dashDummy.position.x = d.x + curve;
                dashDummy.position.z = currentZ;
                dashDummy.updateMatrix();
                dashGroupRef.current!.setMatrixAt(i, dashDummy.matrix);
            });
            dashGroupRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    const halfW = ROAD_WIDTH / 2;

    return (
        <group>
            {/* ── Road surface ── */}
            <mesh ref={roadRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial color="#1a1a28" roughness={0.6} metalness={0.3} />
            </mesh>

            {/* ── Reflection layer (wet neon look) ── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
                <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial
                    color={accentColor}
                    emissive={accentColor}
                    emissiveIntensity={0.08}
                    roughness={0.05}
                    metalness={0.9}
                    transparent
                    opacity={0.12}
                    toneMapped={false}
                />
            </mesh>

            {/* ── Ground extending beyond road ── */}
            <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <planeGeometry args={[500, ROAD_LENGTH + 200, 4, Math.floor(SEGMENTS / 2)]} />
                <meshStandardMaterial color={envType === 'desert' ? '#2a1a0e' : '#0c0c18'} roughness={1} />
            </mesh>

            {/* ── Neon edge lines ── */}
            {/* Left edge */}
            <mesh ref={leftEdgeRef} rotation={[-Math.PI / 2, 0, 0]} position={[-halfW, 0.02, 0]}>
                <planeGeometry args={[0.2, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={3} toneMapped={false} />
            </mesh>
            {/* Right edge */}
            <mesh ref={rightEdgeRef} rotation={[-Math.PI / 2, 0, 0]} position={[halfW, 0.02, 0]}>
                <planeGeometry args={[0.2, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={3} toneMapped={false} />
            </mesh>

            {/* ── Edge glow (wider, softer) ── */}
            <mesh ref={leftGlowRef} rotation={[-Math.PI / 2, 0, 0]} position={[-halfW, 0.015, 0]}>
                <planeGeometry args={[1.0, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial
                    color={accentColor} emissive={accentColor} emissiveIntensity={0.6}
                    transparent opacity={0.12} toneMapped={false}
                />
            </mesh>
            <mesh ref={rightGlowRef} rotation={[-Math.PI / 2, 0, 0]} position={[halfW, 0.015, 0]}>
                <planeGeometry args={[1.0, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial
                    color={accentColor} emissive={accentColor} emissiveIntensity={0.6}
                    transparent opacity={0.12} toneMapped={false}
                />
            </mesh>

            {/* ── Dashed lane lines ── */}
            <instancedMesh ref={dashGroupRef} args={[dashGeo, undefined, dashes.length]}>
                <meshStandardMaterial color="#556677" emissive="#334455" emissiveIntensity={0.3} />
            </instancedMesh>

            {/* ── Sidewalk / curb neon strips ── */}
            <mesh ref={leftCurbRef} rotation={[-Math.PI / 2, 0, 0]} position={[-halfW - 1.5, 0.01, 0]}>
                <planeGeometry args={[2, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial color="#111118" roughness={0.9} />
            </mesh>
            <mesh ref={rightCurbRef} rotation={[-Math.PI / 2, 0, 0]} position={[halfW + 1.5, 0.01, 0]}>
                <planeGeometry args={[2, ROAD_LENGTH, 1, SEGMENTS]} />
                <meshStandardMaterial color="#111118" roughness={0.9} />
            </mesh>
        </group>
    );
}
