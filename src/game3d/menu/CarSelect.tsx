import { useState } from 'react';
import { CARS, CarConfig } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    selected: CarConfig;
    onSelect: (car: CarConfig) => void;
    onConfirm: () => void;
    onBack: () => void;
}

const STAT_COLORS: Record<string, string> = {
    topSpeed: '#00ffff',
    handling: '#ff00ff',
    nitro: '#ffaa00',
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span style={{ fontSize: 10, color, letterSpacing: 1 }}>{value}/10</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                    width: `${value * 10}%`, height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    boxShadow: `0 0 8px ${color}`,
                    transition: 'width 0.4s ease',
                }} />
            </div>
        </div>
    );
}

function CarCard({ car, selected, onClick }: { car: CarConfig; selected: boolean; onClick: () => void }) {
    const [hover, setHover] = useState(false);
    const active = selected || hover;
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                flex: '0 0 220px',
                border: `1px solid ${active ? car.glowColor : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${car.glowColor}0d` : 'rgba(255,255,255,0.03)',
                borderRadius: 4,
                padding: '28px 24px',
                cursor: 'pointer',
                transition: 'all 0.22s',
                boxShadow: active ? `0 0 32px ${car.glowColor}33` : 'none',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {selected && (
                <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 9, letterSpacing: 3, color: car.glowColor,
                    textShadow: `0 0 8px ${car.glowColor}`,
                }}>SELECTED</div>
            )}

            {/* Mini car silhouette */}
            <div style={{
                width: '100%', height: 70, marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                {/* Car body */}
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: 100, height: 26, background: car.color,
                        border: `1px solid ${car.glowColor}55`, borderRadius: 3,
                    }} />
                    <div style={{
                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        width: 60, height: 16, background: car.color,
                        border: `1px solid ${car.glowColor}33`, borderRadius: '3px 3px 0 0',
                    }} />
                    {/* Neon underglow */}
                    <div style={{
                        position: 'absolute', bottom: -3, left: 0, right: 0, height: 3,
                        background: car.glowColor,
                        boxShadow: `0 0 12px ${car.glowColor}, 0 0 24px ${car.glowColor}88`,
                        borderRadius: 2,
                    }} />
                </div>
            </div>

            <div style={{
                fontSize: 22, fontWeight: 900, letterSpacing: 4,
                color: active ? car.glowColor : 'rgba(255,255,255,0.7)',
                textShadow: active ? `0 0 12px ${car.glowColor}` : 'none',
                marginBottom: 20, transition: 'all 0.22s',
            }}>{car.name}</div>

            <StatBar label="TOP SPEED" value={car.topSpeed} color={STAT_COLORS.topSpeed} />
            <StatBar label="HANDLING" value={car.handling} color={STAT_COLORS.handling} />
            <StatBar label="NITRO" value={car.nitro} color={STAT_COLORS.nitro} />
        </div>
    );
}

export function CarSelect({ selected, onSelect, onConfirm, onBack }: Props) {
    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#080614',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
        }}>
            {/* Grid bg */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(255,0,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,0,255,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px',
                animation: 'gridPan 20s linear infinite',
                pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 11, letterSpacing: 8, color: '#ff00ff88', marginBottom: 12 }}>STEP 1 OF 2</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: 6, color: '#fff', margin: '0 0 8px 0' }}>
                SELECT YOUR CAR
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginBottom: 48 }}>
                EACH VEHICLE HAS UNIQUE HANDLING CHARACTERISTICS
            </p>

            <div style={{ display: 'flex', gap: 24, marginBottom: 52 }}>
                {CARS.map(car => (
                    <CarCard
                        key={car.id}
                        car={car}
                        selected={selected.id === car.id}
                        onClick={() => onSelect(car)}
                    />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
                <GhostButton onClick={onBack} color="#ffffff">← BACK</GhostButton>
                <NeonButton onClick={onConfirm} color={selected.glowColor} style={{ padding: '14px 48px', fontSize: 14, letterSpacing: 6 }}>
                    CONFIRM →
                </NeonButton>
            </div>

            <style>{`
                @keyframes gridPan {
                    from { background-position: 0 0; }
                    to   { background-position: 0 60px; }
                }
            `}</style>
        </div>
    );
}
