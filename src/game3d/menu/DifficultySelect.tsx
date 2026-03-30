import { useState } from 'react';
import { Difficulty, DIFFICULTY_CONFIG } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    selected: Difficulty;
    onSelect: (d: Difficulty) => void;
    onConfirm: () => void;
    onBack: () => void;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function DifficultyCard({ id, selected, onClick }: { id: Difficulty; selected: boolean; onClick: () => void }) {
    const [hover, setHover] = useState(false);
    const cfg = DIFFICULTY_CONFIG[id];
    const active = selected || hover;

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                flex: '0 0 240px',
                border: `1px solid ${active ? cfg.color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${cfg.color}0d` : 'rgba(255,255,255,0.03)',
                borderRadius: 4,
                padding: '36px 28px',
                cursor: 'pointer',
                transition: 'all 0.22s',
                boxShadow: active ? `0 0 32px ${cfg.color}33` : 'none',
                textAlign: 'center',
                position: 'relative',
            }}
        >
            {selected && (
                <div style={{
                    position: 'absolute', top: 12, right: 14,
                    fontSize: 9, letterSpacing: 3,
                    color: cfg.color, textShadow: `0 0 8px ${cfg.color}`,
                }}>SELECTED</div>
            )}

            {/* Difficulty icon */}
            <div style={{ marginBottom: 20, fontSize: 32 }}>
                {id === 'easy' ? '🟢' : id === 'medium' ? '🟡' : '🔴'}
            </div>

            <div style={{
                fontSize: 26, fontWeight: 900, letterSpacing: 5,
                color: active ? cfg.color : 'rgba(255,255,255,0.6)',
                textShadow: active ? `0 0 12px ${cfg.color}` : 'none',
                marginBottom: 16, transition: 'all 0.22s',
            }}>{cfg.label}</div>

            <div style={{
                fontSize: 11, letterSpacing: 1, lineHeight: 1.7,
                color: 'rgba(255,255,255,0.4)', transition: 'color 0.22s',
            }}>{cfg.desc}</div>

            {/* AI Speed indicator */}
            <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>
                    AI SPEED
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                        width: `${cfg.aiSpeedMult * 70}%`,
                        height: '100%',
                        background: cfg.color,
                        boxShadow: `0 0 8px ${cfg.color}`,
                        transition: 'width 0.4s',
                    }} />
                </div>
            </div>
        </div>
    );
}

export function DifficultySelect({ selected, onSelect, onConfirm, onBack }: Props) {
    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#080614',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(255,170,0,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,170,0,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px',
                animation: 'gridPan 20s linear infinite',
                pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 11, letterSpacing: 8, color: '#ffaa0088', marginBottom: 12 }}>STEP 2 OF 2</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: 6, color: '#fff', margin: '0 0 8px 0' }}>
                CHOOSE DIFFICULTY
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginBottom: 48 }}>
                AFFECTS AI OPPONENT SPEED AND AGGRESSION
            </p>

            <div style={{ display: 'flex', gap: 24, marginBottom: 52 }}>
                {DIFFICULTIES.map(d => (
                    <DifficultyCard key={d} id={d} selected={selected === d} onClick={() => onSelect(d)} />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
                <GhostButton onClick={onBack} color="#ffffff">← BACK</GhostButton>
                <NeonButton onClick={onConfirm} color={DIFFICULTY_CONFIG[selected].color}
                    style={{ padding: '14px 48px', fontSize: 14, letterSpacing: 6 }}>
                    RACE START →
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
