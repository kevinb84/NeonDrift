import { MatchType } from './useGameFlow';
import { NeonButton, GhostButton } from './TitleScreen';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    onSelect: (type: MatchType, stake: number) => void;
    onBack: () => void;
}

export function ModeSelectScreen({ onSelect, onBack }: Props) {
    const { connected } = useWallet();

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(5, 5, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
        }}>
            <h2 style={{
                color: '#fff', fontSize: 42, fontWeight: 900,
                letterSpacing: 6, marginBottom: 60,
                textAlign: 'center', textShadow: '0 0 20px #00ffff'
            }}>
                SELECT <span style={{ color: '#00ffff' }}>GAME MODE</span>
            </h2>

            <div style={{ display: 'flex', gap: 40, width: '100%', maxWidth: 900, justifyContent: 'center' }}>
                {/* Practice Mode */}
                <div style={{
                    flex: 1, padding: 40, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(0,255,255,0.2)', borderRadius: 12,
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    <h3 style={{ color: '#00ffff', fontSize: 24, marginBottom: 16 }}>PRACTICE</h3>
                    <p style={{ color: '#ccc', textAlign: 'center', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
                        Casual racing without stakes. Perfect for mastering the track and testing your skills.
                    </p>
                    <div style={{ marginTop: 'auto' }}>
                        <NeonButton onClick={() => onSelect('practice', 0)} color="#00ffff" style={{ padding: '12px 32px' }}>
                            ENTER PRACTICE
                        </NeonButton>
                    </div>
                </div>

                {/* Ranked Mode */}
                <div style={{
                    flex: 1, padding: 40, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,0,255,0.2)', borderRadius: 12,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Glow effect */}
                    <div style={{
                        position: 'absolute', top: -50, right: -50,
                        width: 150, height: 150, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,0,255,0.1), transparent 70%)',
                        pointerEvents: 'none',
                    }} />
                    <h3 style={{ color: '#ff00ff', fontSize: 24, marginBottom: 16 }}>
                        RANKED
                        <span style={{
                            fontSize: 10, marginLeft: 8, padding: '3px 8px',
                            background: 'rgba(255,0,255,0.15)', borderRadius: 4,
                            verticalAlign: 'middle', letterSpacing: 1,
                        }}>LIVE</span>
                    </h3>
                    <p style={{ color: '#ccc', textAlign: 'center', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                        Stake Neon and race for real rewards. Real-time matchmaking with on-chain escrow.
                    </p>
                    <div style={{
                        display: 'flex', gap: 16, justifyContent: 'center',
                        marginBottom: 32, fontSize: 11, color: '#888',
                    }}>
                        <span>🔒 Escrow Protected</span>
                        <span>⚡ Live Matching</span>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        {!connected ? (
                            <WalletMultiButton style={{
                                background: 'linear-gradient(135deg, #ff00ff, #8800ff)',
                                fontFamily: FONT, borderRadius: 8, padding: '0 32px',
                            }} />
                        ) : (
                            <NeonButton
                                onClick={() => onSelect('ranked', 0)}
                                color="#ff00ff"
                                style={{ padding: '12px 32px' }}
                            >
                                ENTER LOBBY
                            </NeonButton>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 60 }}>
                <GhostButton onClick={onBack} color="#fff">BACK TO TITLE</GhostButton>
            </div>
        </div>
    );
}

