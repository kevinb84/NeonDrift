import { useState, useEffect } from 'react';
import { NeonButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props { onClose: () => void; }

export function SettingsMenu({ onClose }: Props) {
    const [volume, setVolume] = useState<number>(() => {
        const saved = localStorage.getItem('neon_volume');
        return saved !== null ? Number(saved) : 70;
    });
    const [quality, setQuality] = useState<'low' | 'high'>(() => {
        return (localStorage.getItem('neon_quality') as 'low' | 'high') ?? 'high';
    });

    useEffect(() => { localStorage.setItem('neon_volume', String(volume)); }, [volume]);
    useEffect(() => { localStorage.setItem('neon_quality', quality); }, [quality]);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(6px)',
        }}>
            <div style={{
                width: 480,
                border: '1px solid #ffaa0044',
                background: '#0a0818',
                borderRadius: 4,
                padding: '40px 48px',
                fontFamily: FONT,
                boxShadow: '0 0 60px #ffaa0022',
            }}>
                <h2 style={{
                    fontSize: 22, fontWeight: 900, letterSpacing: 6,
                    color: '#ffaa00', textShadow: '0 0 10px #ffaa00',
                    margin: '0 0 36px 0',
                }}>SETTINGS</h2>

                {/* Volume */}
                <div style={{ marginBottom: 36 }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 11, letterSpacing: 4, marginBottom: 14,
                        color: 'rgba(255,255,255,0.6)',
                    }}>
                        <span>VOLUME</span>
                        <span style={{ color: '#ffaa00' }}>{volume}%</span>
                    </div>
                    <input
                        type="range" min={0} max={100} value={volume}
                        onChange={e => setVolume(Number(e.target.value))}
                        style={{
                            width: '100%', accentColor: '#ffaa00',
                            height: 4, cursor: 'pointer',
                        }}
                    />
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 6, letterSpacing: 2,
                    }}>
                        <span>OFF</span><span>MAX</span>
                    </div>
                </div>

                {/* Graphics Quality */}
                <div style={{ marginBottom: 36 }}>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
                        GRAPHICS QUALITY
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {(['low', 'high'] as const).map(q => (
                            <button
                                key={q}
                                onClick={() => setQuality(q)}
                                style={{
                                    flex: 1, padding: '12px',
                                    fontFamily: FONT, fontSize: 11, letterSpacing: 4, fontWeight: 700,
                                    background: quality === q ? '#ffaa0022' : 'transparent',
                                    border: `1px solid ${quality === q ? '#ffaa00' : 'rgba(255,255,255,0.12)'}`,
                                    color: quality === q ? '#ffaa00' : 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', textTransform: 'uppercase',
                                    transition: 'all 0.18s',
                                }}
                            >
                                {q === 'low' ? '⚡ PERFORMANCE' : '✨ QUALITY'}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 10, letterSpacing: 1, lineHeight: 1.6 }}>
                        {quality === 'low'
                            ? 'Reduces bloom and particle effects for better performance on lower-end hardware.'
                            : 'Full bloom, post-processing effects, and particle density. Recommended for modern GPUs.'}
                    </div>
                </div>

                <NeonButton onClick={onClose} color="#ffaa00"
                    style={{ width: '100%', padding: '12px', fontSize: 12, letterSpacing: 5 }}>
                    SAVE & CLOSE
                </NeonButton>
            </div>
        </div>
    );
}

/** Hook to read persisted settings from localStorage */
export function useSettings() {
    const volume = Number(localStorage.getItem('neon_volume') ?? 70) / 100;
    const quality = (localStorage.getItem('neon_quality') as 'low' | 'high') ?? 'high';
    return { volume, quality };
}
