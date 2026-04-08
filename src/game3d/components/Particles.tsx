import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCurveOffset } from '../utils/curveOffset';
import { TrackConfig } from '../menu/useGameFlow';

const PARTICLE_COUNT = 200;
const SPREAD_X = 60;
const SPREAD_Y = 30;
const SPREAD_Z = 150;

// Drift smoke / spark particles
const SMOKE_COUNT  = 40;
const SPARK_COUNT  = 24;

interface ParticlesProps {
    speed: number;
    playerDistRef?: React.MutableRefObject<number>;
    track?: TrackConfig;
    driftStateRef?: React.MutableRefObject<{ drifting: boolean; grip: number; exitBoost: number }>;
    playerXRef?: React.MutableRefObject<number>;
}

// ── Atmosphere particles ──────────────────────────────────────────────
export function Particles({ speed, playerDistRef, track, driftStateRef, playerXRef }: ParticlesProps) {
    const meshRef  = useRef<THREE.InstancedMesh>(null);
    const smokeRef = useRef<THREE.InstancedMesh>(null);
    const sparkRef = useRef<THREE.InstancedMesh>(null);

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

    // Smoke particles (drift trail at road level)
    const smokeParticles = useMemo(() => {
        const data: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number; size: number; active: boolean }[] = [];
        for (let i = 0; i < SMOKE_COUNT; i++) {
            data.push({
                pos: new THREE.Vector3(0, 0, 0),
                vel: new THREE.Vector3(0, 0, 0),
                life: 0,
                maxLife: 1,
                size: 0.15,
                active: false,
            });
        }
        return data;
    }, []);

    // Spark particles
    const sparkParticles = useMemo(() => {
        const data: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; active: boolean }[] = [];
        for (let i = 0; i < SPARK_COUNT; i++) {
            data.push({
                pos: new THREE.Vector3(0, 0, 0),
                vel: new THREE.Vector3(0, 0, 0),
                life: 0,
                active: false,
            });
        }
        return data;
    }, []);

    const smokeEmitTimer = useRef(0);
    const sparkEmitTimer = useRef(0);

    useEffect(() => {
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
        const dist  = playerDistRef?.current || 0;
        const pX    = playerXRef?.current || 0;
        const isDrifting = driftStateRef?.current?.drifting ?? false;
        const grip       = driftStateRef?.current?.grip ?? 1;

        // ── Atmosphere ─────────────────────────────────────────────────
        {
            const mesh = meshRef.current;
            if (mesh) {
                const dummy = new THREE.Object3D();
                const halfZ = SPREAD_Z / 2;
                particles.forEach((p, i) => {
                    p.pos.z += speed * delta * p.speed;
                    p.pos.y += Math.sin(Date.now() * 0.001 + i) * 0.003;
                    if (p.pos.z > halfZ) p.pos.z -= SPREAD_Z;
                    if (p.pos.z < -halfZ) p.pos.z += SPREAD_Z;
                    const curve = getCurveOffset(p.pos.z, dist, track);
                    dummy.position.set(p.pos.x + curve, p.pos.y, p.pos.z);
                    dummy.scale.setScalar(p.size);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                });
                mesh.instanceMatrix.needsUpdate = true;
            }
        }

        // ── Drift smoke ────────────────────────────────────────────────
        {
            const mesh = smokeRef.current;
            if (mesh && isDrifting) {
                smokeEmitTimer.current -= delta;
                if (smokeEmitTimer.current <= 0) {
                    smokeEmitTimer.current = 0.04; // emit every 40ms
                    // Spawn on an inactive slot
                    const slot = smokeParticles.find(p => !p.active);
                    if (slot) {
                        slot.active = true;
                        slot.pos.set(pX + (Math.random() - 0.5) * 2, 0.15, 1.5);
                        slot.vel.set((Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 1.5);
                        slot.maxLife = 0.5 + Math.random() * 0.4;
                        slot.life = slot.maxLife;
                        slot.size = 0.3 + (1 - grip) * 0.6;
                    }
                }
            }

            if (mesh) {
                const dummy = new THREE.Object3D();
                const color = new THREE.Color();
                smokeParticles.forEach((p, i) => {
                    if (!p.active) {
                        dummy.scale.setScalar(0.001);
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i, dummy.matrix);
                        return;
                    }
                    p.life -= delta;
                    if (p.life <= 0) { p.active = false; return; }
                    p.pos.addScaledVector(p.vel, delta);
                    p.vel.y -= 0.8 * delta; // slight gravity
                    const t = p.life / p.maxLife; // 1→0
                    const scale = p.size * (1 + (1 - t) * 1.5);
                    dummy.position.copy(p.pos);
                    dummy.scale.setScalar(scale);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    color.setHSL(0.78, 0.8, 0.3 + (1 - t) * 0.4); // purple→white smoke
                    mesh.setColorAt(i, color);
                });
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
        }

        // ── Sparks ─────────────────────────────────────────────────────
        {
            const mesh = sparkRef.current;
            if (mesh && isDrifting) {
                sparkEmitTimer.current -= delta;
                if (sparkEmitTimer.current <= 0) {
                    sparkEmitTimer.current = 0.07;
                    const slot = sparkParticles.find(p => !p.active);
                    if (slot) {
                        slot.active = true;
                        slot.pos.set(pX + (Math.random() - 0.5) * 1.5, 0.1, 1.8);
                        slot.vel.set((Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
                        slot.life = 0.2 + Math.random() * 0.25;
                    }
                }
            }

            if (mesh) {
                const dummy = new THREE.Object3D();
                const color = new THREE.Color();
                sparkParticles.forEach((p, i) => {
                    if (!p.active) {
                        dummy.scale.setScalar(0.001);
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i, dummy.matrix);
                        return;
                    }
                    p.life -= delta;
                    if (p.life <= 0) { p.active = false; return; }
                    p.pos.addScaledVector(p.vel, delta);
                    p.vel.y -= 4 * delta; // fast gravity
                    dummy.position.copy(p.pos);
                    dummy.scale.setScalar(0.04 + p.life * 0.1);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    // Cyan→white sparks
                    color.setHSL(0.5 + Math.random() * 0.1, 1, 0.7);
                    mesh.setColorAt(i, color);
                });
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
        }
    });

    return (
        <>
            {/* Atmosphere */}
            <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
                <sphereGeometry args={[1, 4, 4]} />
                <meshStandardMaterial
                    color="#ffffff" emissive="#ffffff" emissiveIntensity={2}
                    toneMapped={false} transparent opacity={0.6}
                />
            </instancedMesh>

            {/* Drift smoke */}
            <instancedMesh ref={smokeRef} args={[undefined, undefined, SMOKE_COUNT]}>
                <sphereGeometry args={[1, 6, 6]} />
                <meshStandardMaterial
                    color="#cc88ff" emissive="#aa44ff" emissiveIntensity={0.5}
                    toneMapped={false} transparent opacity={0.35}
                    vertexColors
                />
            </instancedMesh>

            {/* Sparks */}
            <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_COUNT]}>
                <sphereGeometry args={[1, 4, 4]} />
                <meshStandardMaterial
                    color="#00ffff" emissive="#00ffff" emissiveIntensity={4}
                    toneMapped={false} transparent opacity={0.9}
                    vertexColors
                />
            </instancedMesh>
        </>
    );
}
