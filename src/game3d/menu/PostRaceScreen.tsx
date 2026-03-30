import { CarConfig, Difficulty, DIFFICULTY_CONFIG } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    position: number;
    raceTime: number;        // ms
    bestLapTime: number;     // ms
    previousBest: number | null;
    isNewPb: boolean;
    car: CarConfig;
    difficulty: Difficulty;
    onRaceAgain?: () => void;
    onChangeCar?: () => void;
    onMainMenu: () => void;
}

function formatTime(ms: number): string {
    if (!Number.isFinite(ms) || ms === 0) return '--:--.--';
    const t = ms / 1000;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const PLACE_LABELS: Record<number, { label: string; color: string; suffix: string }> = {
    1: { label: '🏆 VICTORY!', color: '#ffff00', suffix: '1ST PLACE' },
    2: { label: '🥈 RUNNER-UP', color: '#aaaaff', suffix: '2ND PLACE' },
    3: { label: '🥉 WELL DONE', color: '#ff8844', suffix: '3RD PLACE' },
};

function getPlaceInfo(pos: number) {
    return PLACE_LABELS[pos] ?? { label: `${pos}TH PLACE FINISH`, color: '#888', suffix: `${pos}TH PLACE` };
}

export function PostRaceScreen({ position, raceTime, bestLapTime, previousBest, isNewPb, car, difficulty, onRaceAgain, onChangeCar, onMainMenu }: Props) {
    const { label, color, suffix } = getPlaceInfo(position);
    const diffCfg = DIFFICULTY_CONFIG[difficulty];

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,6,20,0.94)',
            backdropFilter: 'blur(8px)',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
        }}>
            {/* Header */}
            <div style={{
                fontSize: 13, letterSpacing: 8, color: 'rgba(255,255,255,0.35)',
                marginBottom: 16,
            }}>RACE COMPLETE</div>

            <div style={{
                fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 900, letterSpacing: 4,
                color, textShadow: `0 0 30px ${color}`,
                marginBottom: 8,
            }}>{label}</div>

            <div style={{
                fontSize: 13, letterSpacing: 6, color: `${color}99`,
                marginBottom: 48,
            }}>{suffix}</div>

            {/* Stats card */}
            <div style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 4,
                padding: '28px 48px',
                marginBottom: 48,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0 48px',
                textAlign: 'center',
                minWidth: 480,
            }}>
                {/* Race Time */}
                <div>
                    <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>RACE TIME</div>
                    <div style={{
                        fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#00ffff',
                        textShadow: '0 0 10px #00ffff'
                    }}>
                        {formatTime(raceTime)}
                        <div style={{ fontSize: 13, marginTop: 4, color: isNewPb || previousBest === null ? '#00ff88' : '#ff5555', textShadow: 'none' }}>
                            {previousBest === null ? 'NEW PB!' :
                                isNewPb ? `NEW PB! (-${formatTime(previousBest - raceTime)})` :
                                    `+${formatTime(raceTime - previousBest)}`}
                        </div>
                    </div>
                </div>
                {/* Best Lap */}
                <div>
                    <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>BEST LAP</div>
                    <div style={{
                        fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#ff00ff',
                        textShadow: '0 0 10px #ff00ff'
                    }}>{formatTime(bestLapTime)}</div>
                </div>
                {/* Difficulty */}
                <div>
                    <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>DIFFICULTY</div>
                    <div style={{
                        fontSize: 22, fontWeight: 900, letterSpacing: 2,
                        color: diffCfg.color, textShadow: `0 0 10px ${diffCfg.color}`
                    }}>{diffCfg.label}</div>
                </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {onRaceAgain && (
                    <NeonButton onClick={onRaceAgain} color="#00ffff"
                        style={{ padding: '14px 36px', fontSize: 13, letterSpacing: 5 }}>
                        🔄 RACE AGAIN
                    </NeonButton>
                )}
                {onChangeCar && (
                    <GhostButton onClick={onChangeCar} color={car.glowColor}
                        style={{ padding: '13px 28px', fontSize: 12, letterSpacing: 4, border: `1px solid ${car.glowColor}44` }}>
                        🚗 CHANGE CAR
                    </GhostButton>
                )}
                <GhostButton onClick={onMainMenu} color="#ffffff"
                    style={{ padding: '13px 28px', fontSize: 12, letterSpacing: 4 }}>
                    🏠 MAIN MENU
                </GhostButton>
            </div>
        </div>
    );
}
