import { TRACKS, TrackConfig } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface TrackCardProps {
    track: TrackConfig;
    selected: boolean;
    onClick: () => void;
}

function TrackCard({ track, selected, onClick }: TrackCardProps) {
    return (
        <div
            onClick={onClick}
            style={{
                width: 280,
                height: 380,
                background: selected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selected ? track.accentColor : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4,
                padding: 24,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: selected ? `0 0 30px ${track.accentColor}33` : 'none',
            }}
        >
            {/* Visual Preview Placeholder or simplified SVG icon */}
            <div style={{
                height: 140,
                background: selected ? `${track.accentColor}22` : 'rgba(255,255,255,0.05)',
                marginBottom: 24,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px dashed ${selected ? track.accentColor : 'rgba(255,255,255,0.1)'}`,
            }}>
                <div style={{
                    fontSize: 48,
                    color: selected ? track.accentColor : 'rgba(255,255,255,0.2)',
                    textShadow: selected ? `0 0 10px ${track.accentColor}` : 'none',
                }}>
                    {track.envType === 'city' ? '🏙️' : track.envType === 'desert' ? '🏜️' : '🚇'}
                </div>
            </div>

            <h3 style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 4,
                margin: '0 0 12px 0',
                color: selected ? track.accentColor : '#fff',
                textShadow: selected ? `0 0 10px ${track.accentColor}` : 'none',
            }}>
                {track.name}
            </h3>

            <p style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.5)',
                margin: 0,
                letterSpacing: 1,
            }}>
                {track.description}
            </p>

            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>ENVIRONMENT</div>
                <div style={{
                    fontSize: 11,
                    letterSpacing: 3,
                    color: track.accentColor,
                    fontWeight: 700,
                    textTransform: 'uppercase'
                }}>
                    {track.envType}
                </div>
            </div>

            {selected && (
                <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: track.accentColor,
                    boxShadow: `0 0 10px ${track.accentColor}`,
                }} />
            )}
        </div>
    );
}

interface Props {
    selected: TrackConfig;
    onSelect: (track: TrackConfig) => void;
    onConfirm: () => void;
    onBack: () => void;
}

export function TrackSelect({ selected, onSelect, onConfirm, onBack }: Props) {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5,5,15,0.95)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            zIndex: 10,
        }}>
            <h2 style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: 12,
                color: '#fff',
                marginBottom: 48,
                textShadow: '0 0 20px rgba(255,255,255,0.3)',
            }}>
                CHOOSE CIRCUIT
            </h2>

            <div style={{
                display: 'flex',
                gap: 24,
                marginBottom: 64,
                flexWrap: 'wrap',
                justifyContent: 'center',
            }}>
                {TRACKS.map(track => (
                    <TrackCard
                        key={track.id}
                        track={track}
                        selected={selected.id === track.id}
                        onClick={() => onSelect(track)}
                    />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
                <GhostButton onClick={onBack} color="#ffffff" style={{ padding: '14px 40px' }}>
                    ← CAR SELECT
                </GhostButton>
                <NeonButton
                    onClick={onConfirm}
                    color={selected.accentColor}
                    style={{ padding: '14px 60px' }}
                >
                    SET DIFFICULTY →
                </NeonButton>
            </div>

            <div style={{
                marginTop: 48,
                fontSize: 10,
                letterSpacing: 4,
                color: 'rgba(255,255,255,0.2)',
            }}>
                SELECT THE TRACK THAT MATCHES YOUR STYLE
            </div>
        </div>
    );
}
