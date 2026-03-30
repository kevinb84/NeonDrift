import { NeonButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

const CONTROLS = [
    { key: '↑  /  W', action: 'Accelerate' },
    { key: '↓  /  S', action: 'Brake / Reverse' },
    { key: '←  /  A', action: 'Steer Left' },
    { key: '→  /  D', action: 'Steer Right' },
    { key: 'Shift / Space', action: 'Nitro Boost (hold)' },
];

interface Props { onClose: () => void; }

export function ControlsPanel({ onClose }: Props) {
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
                border: '1px solid #00ffff44',
                background: '#0a0818',
                borderRadius: 4,
                padding: '40px 48px',
                fontFamily: FONT,
                boxShadow: '0 0 60px #00ffff22',
            }}>
                <h2 style={{
                    fontSize: 22, fontWeight: 900, letterSpacing: 6,
                    color: '#00ffff', textShadow: '0 0 10px #00ffff',
                    margin: '0 0 32px 0',
                }}>CONTROLS</h2>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        {CONTROLS.map(({ key, action }) => (
                            <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{
                                    padding: '12px 0', fontSize: 13, fontWeight: 700,
                                    color: '#00ffff', letterSpacing: 2,
                                    fontFamily: 'monospace', width: '50%',
                                }}>{key}</td>
                                <td style={{
                                    padding: '12px 0', fontSize: 11,
                                    color: 'rgba(255,255,255,0.55)', letterSpacing: 2,
                                }}>{action}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: 12, padding: '12px 16px', background: '#ffffff08', borderRadius: 3 }}>
                    <span style={{ fontSize: 10, color: '#ffaa0099', letterSpacing: 2 }}>
                        💡 TIP: Hold nitro while accelerating for maximum speed burst.
                        Nitro recharges automatically when not in use.
                    </span>
                </div>

                <div style={{ marginTop: 32 }}>
                    <NeonButton onClick={onClose} color="#00ffff"
                        style={{ width: '100%', padding: '12px', fontSize: 12, letterSpacing: 5 }}>
                        CLOSE
                    </NeonButton>
                </div>
            </div>
        </div>
    );
}
