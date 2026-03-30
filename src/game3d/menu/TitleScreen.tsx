import { useState } from 'react';
import { ControlsPanel } from './ControlsPanel';
import { SettingsMenu } from './SettingsMenu';
import { LeaderboardScreen } from './LeaderboardScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
    const [overlay, setOverlay] = useState<'none' | 'controls' | 'settings' | 'leaderboard'>('none');

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#080614',
            fontFamily: FONT,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
        }}>
            {/* Animated grid background */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(0,255,255,0.04) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,255,255,0.04) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px',
                animation: 'gridPan 20s linear infinite',
                pointerEvents: 'none',
            }} />

            {/* Radial glow center */}
            <div style={{
                position: 'absolute',
                width: 700, height: 700,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(100,0,255,0.18) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 60, position: 'relative' }}>
                <div style={{
                    fontSize: 14, letterSpacing: 12, color: '#ff00ff',
                    textShadow: '0 0 10px #ff00ff',
                    marginBottom: 16, textTransform: 'uppercase',
                    animation: 'fadeSlideDown 0.8s ease both',
                }}>
                    — CYBERPUNK RACING —
                </div>
                <div style={{
                    fontSize: 'clamp(56px, 10vw, 96px)',
                    fontWeight: 900,
                    letterSpacing: 8,
                    background: 'linear-gradient(135deg, #00ffff 0%, #ff00ff 50%, #ffaa00 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: 'none',
                    filter: 'drop-shadow(0 0 20px #ff00ffaa)',
                    animation: 'fadeSlideDown 0.9s ease both',
                    lineHeight: 1,
                }}>
                    NEON
                </div>
                <div style={{
                    fontSize: 'clamp(56px, 10vw, 96px)',
                    fontWeight: 900,
                    letterSpacing: 8,
                    background: 'linear-gradient(135deg, #ffaa00 0%, #00ffff 80%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 20px #00ffffaa)',
                    animation: 'fadeSlideDown 1.0s ease both',
                    lineHeight: 1,
                }}>
                    RACE
                </div>
                <div style={{
                    fontSize: 11, letterSpacing: 6, color: 'rgba(255,255,255,0.3)',
                    marginTop: 18, animation: 'fadeSlideDown 1.1s ease both',
                }}>
                    v2.0 — 3D EDITION
                </div>
            </div>

            {/* Main action button */}
            <NeonButton
                onClick={onStart}
                color="#00ffff"
                style={{ fontSize: 20, padding: '18px 64px', letterSpacing: 8, marginBottom: 40, animation: 'fadeSlideDown 1.2s ease both' }}
            >
                START RACING
            </NeonButton>

            {/* Secondary buttons */}
            <div style={{ display: 'flex', gap: 20, animation: 'fadeSlideDown 1.3s ease both' }}>
                <GhostButton onClick={() => setOverlay('leaderboard')} color="#00ffff">LEADERBOARD</GhostButton>
                <GhostButton onClick={() => setOverlay('controls')} color="#ff00ff">CONTROLS</GhostButton>
                <GhostButton onClick={() => setOverlay('settings')} color="#ffaa00">SETTINGS</GhostButton>
            </div>

            {/* Bottom hint */}
            <div style={{
                position: 'absolute', bottom: 28,
                fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.18)',
                animation: 'fadeSlideDown 1.5s ease both',
            }}>
                USE ARROW KEYS OR WASD TO DRIVE • SHIFT / SPACE FOR NITRO
            </div>

            {/* Panels */}
            {overlay === 'leaderboard' && <LeaderboardScreen onClose={() => setOverlay('none')} />}
            {overlay === 'controls' && <ControlsPanel onClose={() => setOverlay('none')} />}
            {overlay === 'settings' && <SettingsMenu onClose={() => setOverlay('none')} />}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
                @keyframes gridPan {
                    from { background-position: 0 0; }
                    to   { background-position: 0 60px; }
                }
                @keyframes fadeSlideDown {
                    from { opacity: 0; transform: translateY(-18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* ── Reusable button primitives ── */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    color: string;
    children: React.ReactNode;
}

export function NeonButton({ color, children, style, ...rest }: BtnProps) {
    const [hover, setHover] = useState(false);
    return (
        <button
            {...rest}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                fontFamily: FONT, fontWeight: 700, letterSpacing: 4,
                background: hover ? `${color}22` : 'transparent',
                border: `2px solid ${color}`,
                color,
                cursor: 'pointer',
                textTransform: 'uppercase',
                textShadow: `0 0 10px ${color}`,
                boxShadow: hover ? `0 0 24px ${color}44, inset 0 0 14px ${color}11` : `0 0 10px ${color}22`,
                transition: 'all 0.18s',
                outline: 'none',
                ...style,
            }}
        >
            {children}
        </button>
    );
}

export function GhostButton({ color, children, style, ...rest }: BtnProps) {
    const [hover, setHover] = useState(false);
    return (
        <button
            {...rest}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: 4,
                padding: '10px 28px',
                background: 'transparent',
                border: `1px solid ${color}44`,
                color: hover ? color : `${color}88`,
                cursor: 'pointer',
                textTransform: 'uppercase',
                textShadow: hover ? `0 0 8px ${color}` : 'none',
                transition: 'all 0.18s',
                outline: 'none',
                ...style,
            }}
        >
            {children}
        </button>
    );
}
