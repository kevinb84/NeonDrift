import { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { CARS, CarConfig } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';

// Pre-load all models for instant switching
CARS.forEach(car => useGLTF.preload(`/models/${car.modelFile}`));

const FONT = "'Orbitron', monospace, sans-serif";

const RARITY_COLOR: Record<string, string> = {
    common:    '#aaaaaa',
    rare:      '#00aaff',
    legendary: '#ffaa00',
};

// ── 3D Car Preview ─────────────────────────────────────────────────────
function CarModel3D({ modelFile, glowColor }: { modelFile: string; glowColor: string }) {
    const { scene } = useGLTF(`/models/${modelFile}`);
    const groupRef = useRef<THREE.Group>(null);

    // Clone so each instance is independent
    const cloned = scene.clone(true);

    useEffect(() => {
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 3.2 / Math.max(size.x, size.y, size.z);
        cloned.scale.setScalar(scale);
        cloned.position.sub(center.multiplyScalar(scale));
        cloned.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
            }
        });
    }, [cloned]);

    // Slow auto-rotate
    useFrame((_, dt) => {
        if (groupRef.current) groupRef.current.rotation.y += dt * 0.6;
    });

    return (
        <group ref={groupRef}>
            <primitive object={cloned} />
            {/* Neon underglow light */}
            <pointLight position={[0, -0.5, 0]} color={glowColor} intensity={6} distance={8} />
            <pointLight position={[0, 1, -2]} color={glowColor} intensity={3} distance={10} />
        </group>
    );
}

function CarPreviewCanvas({ car }: { car: CarConfig }) {
    return (
        <Canvas
            camera={{ position: [0, 1.2, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: '100%', height: '100%' }}
        >
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 8, 5]} intensity={1.5} color="#aaccff" />
            <directionalLight position={[-5, 4, -5]} intensity={0.8} color={car.glowColor} />
            <Suspense fallback={null}>
                <CarModel3D modelFile={car.modelFile} glowColor={car.glowColor} />
                <Environment preset="night" />
            </Suspense>
        </Canvas>
    );
}

// ── Stat Bar ───────────────────────────────────────────────────────────
function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                <span style={{ fontSize: 10, color, letterSpacing: 1 }}>{value}/10</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                    width: `${value * 10}%`, height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${color}66, ${color})`,
                    boxShadow: `0 0 8px ${color}`,
                    transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
            </div>
        </div>
    );
}

// ── Mini Car Card (grid) ───────────────────────────────────────────────
function CarCard({ car, selected, onClick }: { car: CarConfig; selected: boolean; onClick: () => void }) {
    const [hover, setHover] = useState(false);
    const active = selected || hover;
    const rarityColor = RARITY_COLOR[car.rarity];
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                border: `1px solid ${active ? car.glowColor : 'rgba(255,255,255,0.07)'}`,
                background: active ? `${car.glowColor}12` : 'rgba(255,255,255,0.025)',
                borderRadius: 6,
                padding: '14px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: active ? `0 0 24px ${car.glowColor}33` : 'none',
                position: 'relative',
                textAlign: 'center',
            }}
        >
            {/* Rarity badge */}
            <div style={{
                fontSize: 8, letterSpacing: 2, color: rarityColor,
                textTransform: 'uppercase', marginBottom: 6, opacity: 0.8,
            }}>{car.rarity}</div>

            {/* Mini glow dot */}
            <div style={{
                width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px',
                background: `radial-gradient(circle, ${car.glowColor}44, transparent 70%)`,
                border: `1px solid ${car.glowColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: car.glowColor, boxShadow: `0 0 8px ${car.glowColor}` }} />
            </div>

            <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: 3,
                color: active ? car.glowColor : 'rgba(255,255,255,0.6)',
                textShadow: active ? `0 0 8px ${car.glowColor}` : 'none',
                transition: 'all 0.2s',
            }}>{car.name}</div>

            {selected && (
                <div style={{
                    position: 'absolute', top: 4, right: 4,
                    fontSize: 7, letterSpacing: 1, color: car.glowColor,
                    background: `${car.glowColor}22`, borderRadius: 2, padding: '1px 4px',
                }}>✓</div>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────
interface Props {
    selected: CarConfig;
    onSelect: (car: CarConfig) => void;
    onConfirm: () => void;
    onBack: () => void;
}

export function CarSelect({ selected, onSelect, onConfirm, onBack }: Props) {
    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#060412',
            fontFamily: FONT,
            display: 'flex',
            overflow: 'hidden',
        }}>
            {/* Grid background */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(0,255,255,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,255,255,0.02) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                pointerEvents: 'none',
            }} />

            {/* Left panel — 3D preview + stats */}
            <div style={{
                flex: '0 0 420px', display: 'flex', flexDirection: 'column',
                padding: '40px 32px', borderRight: '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
            }}>
                {/* Header */}
                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, letterSpacing: 6, color: `${selected.glowColor}88`, marginBottom: 4 }}>
                        SELECT YOUR CAR
                    </div>
                    <h1 style={{
                        fontSize: 32, fontWeight: 900, letterSpacing: 6,
                        color: selected.glowColor, margin: 0,
                        textShadow: `0 0 30px ${selected.glowColor}66`,
                        transition: 'all 0.3s',
                    }}>{selected.name}</h1>
                    <div style={{
                        fontSize: 10, letterSpacing: 3, marginTop: 4,
                        color: RARITY_COLOR[selected.rarity],
                        textTransform: 'uppercase',
                    }}>
                        ★ {selected.rarity}
                    </div>
                </div>

                {/* 3D Canvas */}
                <div style={{
                    flex: 1, minHeight: 220, maxHeight: 280,
                    borderRadius: 12,
                    border: `1px solid ${selected.glowColor}22`,
                    background: `radial-gradient(ellipse at center, ${selected.glowColor}08 0%, transparent 70%)`,
                    overflow: 'hidden', marginBottom: 24,
                    boxShadow: `0 0 40px ${selected.glowColor}15`,
                    transition: 'border-color 0.3s, box-shadow 0.3s',
                }}>
                    <CarPreviewCanvas car={selected} />
                </div>

                {/* Stats */}
                <div style={{ marginBottom: 24 }}>
                    <StatBar label="TOP SPEED" value={selected.topSpeed} color="#00ffff" />
                    <StatBar label="HANDLING"  value={selected.handling} color="#ff00ff" />
                    <StatBar label="NITRO"     value={selected.nitro}    color="#ffaa00" />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <GhostButton onClick={onBack} color="#ffffff">← BACK</GhostButton>
                    <NeonButton
                        onClick={onConfirm}
                        color={selected.glowColor}
                        style={{ flex: 1, fontSize: 13, letterSpacing: 5 }}
                    >
                        RACE →
                    </NeonButton>
                </div>
            </div>

            {/* Right panel — car grid */}
            <div style={{
                flex: 1, padding: '40px 32px',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ fontSize: 10, letterSpacing: 6, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
                    GARAGE — {CARS.length} VEHICLES
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 12,
                    overflowY: 'auto',
                }}>
                    {CARS.map(car => (
                        <CarCard
                            key={car.id}
                            car={car}
                            selected={selected.id === car.id}
                            onClick={() => onSelect(car)}
                        />
                    ))}
                </div>

                {/* Legend */}
                <div style={{
                    marginTop: 'auto', paddingTop: 24,
                    display: 'flex', gap: 24,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)',
                }}>
                    {Object.entries(RARITY_COLOR).map(([r, c]) => (
                        <span key={r} style={{ color: c, textTransform: 'uppercase' }}>● {r}</span>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes gridPan {
                    from { background-position: 0 0; }
                    to   { background-position: 0 50px; }
                }
            `}</style>
        </div>
    );
}
