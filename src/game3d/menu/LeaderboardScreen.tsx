import { useState, useEffect, useCallback } from 'react';
import { LeaderboardManager, RaceResult } from '../../lib/leaderboard';
import { GhostButton } from './TitleScreen';
import { TRACKS, DIFFICULTY_CONFIG } from './useGameFlow';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    onClose: () => void;
}

export function LeaderboardScreen({ onClose }: Props) {
    const [selectedTrack, setSelectedTrack] = useState(TRACKS[0].id);
    const [selectedDifficulty, setSelectedDifficulty] = useState<keyof typeof DIFFICULTY_CONFIG>('medium');
    const [scores, setScores] = useState<RaceResult[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchScores = useCallback(async () => {
        setLoading(true);
        const data = await LeaderboardManager.getTopScores(selectedTrack, selectedDifficulty);
        setScores(data);
        setLoading(false);
    }, [selectedTrack, selectedDifficulty]);

    useEffect(() => {
        fetchScores();
    }, [fetchScores]);

    const formatTime = (ms: number) => {
        const t = ms / 1000;
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const msPart = Math.floor((t % 1) * 100);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(2, '0')}`;
    };

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10, 8, 24, 0.95)',
            backdropFilter: 'blur(10px)',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            animation: 'fadeIn 0.3s ease forwards',
        }}>
            <h2 style={{
                color: '#fff', fontSize: 48, fontWeight: 900,
                textShadow: '0 0 20px #00ffff',
                letterSpacing: 4, marginBottom: 40,
                textAlign: 'center'
            }}>
                GLOBAL <span style={{ color: '#00ffff' }}>LEADERBOARD</span>
            </h2>

            <div style={{
                display: 'flex', gap: 40, marginBottom: 30,
                background: 'rgba(0,0,0,0.4)', padding: '20px 40px',
                borderRadius: 10, border: '1px solid #333'
            }}>
                {/* Track Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ color: '#888', fontSize: 12, letterSpacing: 2 }}>TRACK</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {TRACKS.map(t => (
                            <GhostButton
                                key={t.id}
                                color={t.accentColor}
                                onClick={() => setSelectedTrack(t.id)}
                                style={{
                                    borderColor: selectedTrack === t.id ? t.accentColor : 'transparent',
                                    background: selectedTrack === t.id ? `${t.accentColor}22` : 'transparent',
                                }}
                            >
                                {t.name}
                            </GhostButton>
                        ))}
                    </div>
                </div>

                {/* Difficulty Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ color: '#888', fontSize: 12, letterSpacing: 2 }}>DIFFICULTY</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {(Object.entries(DIFFICULTY_CONFIG) as [keyof typeof DIFFICULTY_CONFIG, any][]).map(([key, config]) => (
                            <GhostButton
                                key={key}
                                color={config.color}
                                onClick={() => setSelectedDifficulty(key)}
                                style={{
                                    borderColor: selectedDifficulty === key ? config.color : 'transparent',
                                    background: selectedDifficulty === key ? `${config.color}22` : 'transparent',
                                }}
                            >
                                {config.label}
                            </GhostButton>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={{
                width: 800, maxWidth: '90%', height: 400,
                background: 'rgba(0,0,0,0.6)', borderRadius: 8,
                border: '1px solid #222',
                overflowY: 'auto',
                position: 'relative'
            }}>
                {loading && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.5)', color: '#00ffff',
                        fontSize: 24, letterSpacing: 4
                    }}>
                        LOADING...
                    </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #333', color: '#888', fontSize: 14, letterSpacing: 2 }}>
                            <th style={{ padding: '16px 20px' }}>RANK</th>
                            <th style={{ padding: '16px 20px' }}>CAR</th>
                            <th style={{ padding: '16px 20px' }}>FINISH POS</th>
                            <th style={{ padding: '16px 20px', textAlign: 'right' }}>RACE TIME</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#555', letterSpacing: 2 }}>
                                    NO RECORDS YET FOR THIS TRACK AND DIFFICULTY.
                                </td>
                            </tr>
                        ) : (
                            scores.map((score, index) => (
                                <tr key={score.id || index} style={{ borderBottom: '1px solid #222', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '16px 20px', color: index < 3 ? '#ffaa00' : '#ccc', fontWeight: index < 3 ? 700 : 400 }}>
                                        #{index + 1}
                                    </td>
                                    <td style={{ padding: '16px 20px', color: '#00ffff', textTransform: 'uppercase' }}>
                                        {score.car_id}
                                    </td>
                                    <td style={{ padding: '16px 20px', color: '#fff' }}>
                                        {score.position}{score.position === 1 ? 'st' : score.position === 2 ? 'nd' : score.position === 3 ? 'rd' : 'th'}
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#ff00ff', fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>
                                        {formatTime(score.race_time)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 40 }}>
                <GhostButton onClick={onClose} color="#fff">BACK TO TITLE</GhostButton>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
