import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useMatchmaking, MatchRecord } from '../../hooks/useMatchmaking';
import { useRankedMatch } from '../../hooks/useRankedMatch';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import { NeonButton, GhostButton } from './TitleScreen';

const FONT = "'Orbitron', monospace, sans-serif";

interface Props {
    onMatchReady: (matchId: string, stake: number) => void;
    onBack: () => void;
}

// ─── Animated Status Dot ───
function StatusPulse({ color }: { color: string }) {
    return (
        <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
            <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: color, opacity: 0.5,
                animation: 'lobbyPulse 1.5s ease-in-out infinite',
            }} />
            <span style={{
                position: 'relative', width: 10, height: 10, borderRadius: '50%',
                background: color,
            }} />
        </span>
    );
}

// ─── Match Card ───
function MatchCard({
    match,
    isOwn,
    onJoin,
    joining,
    walletAddr,
}: {
    match: MatchRecord;
    isOwn: boolean;
    onJoin: (id: string) => void;
    joining: boolean;
    walletAddr: string | null;
}) {
    const canJoin = match.status === 'waiting' && !isOwn && match.creator_wallet !== walletAddr;

    return (
        <div style={{
            padding: '16px 20px',
            background: isOwn
                ? 'linear-gradient(135deg, rgba(0,255,255,0.06), rgba(255,0,255,0.04))'
                : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isOwn ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            transition: 'all 0.2s ease',
            cursor: canJoin ? 'pointer' : 'default',
        }}
            onMouseEnter={e => {
                if (canJoin) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,0,255,0.5)';
            }}
            onMouseLeave={e => {
                if (canJoin) (e.currentTarget as HTMLDivElement).style.borderColor = isOwn ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.06)';
            }}
        >
            {/* Status */}
            <StatusPulse color={
                match.status === 'waiting' ? '#00ff88' :
                match.status === 'locked' ? '#ffaa00' :
                match.status === 'racing' ? '#ff00ff' : '#666'
            } />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: FONT, fontSize: 13, fontWeight: 700,
                    color: isOwn ? '#00ffff' : '#fff', letterSpacing: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {isOwn ? '🎮 YOUR MATCH' : match.creator_username || match.creator_wallet.slice(0, 8) + '...'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', marginTop: 2 }}>
                    {match.id.slice(0, 12)}...
                </div>
            </div>

            {/* Stake */}
            <div style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 700,
                color: '#ffaa00', minWidth: 80, textAlign: 'center',
            }}>
                {match.entry_fee} SOL
            </div>

            {/* Players */}
            <div style={{
                fontFamily: FONT, fontSize: 12, color: '#888',
                minWidth: 50, textAlign: 'center',
            }}>
                {match.opponent_wallet ? '2/2' : '1/2'}
            </div>

            {/* Status badge */}
            <div style={{
                fontFamily: FONT, fontSize: 10, fontWeight: 700,
                padding: '4px 10px', borderRadius: 4,
                letterSpacing: 1,
                background:
                    match.status === 'waiting' ? 'rgba(0,255,136,0.1)' :
                    match.status === 'locked' ? 'rgba(255,170,0,0.1)' :
                    'rgba(255,0,255,0.1)',
                color:
                    match.status === 'waiting' ? '#00ff88' :
                    match.status === 'locked' ? '#ffaa00' :
                    '#ff00ff',
                textTransform: 'uppercase',
                minWidth: 70,
                textAlign: 'center',
            }}>
                {match.status}
            </div>

            {/* Join button */}
            {canJoin && (
                <button
                    onClick={(e) => { e.stopPropagation(); onJoin(match.id); }}
                    disabled={joining}
                    style={{
                        fontFamily: FONT, fontSize: 11, fontWeight: 700,
                        padding: '8px 16px', borderRadius: 6,
                        border: '1px solid #ff00ff',
                        background: joining ? 'rgba(255,0,255,0.05)' : 'rgba(255,0,255,0.15)',
                        color: '#ff00ff',
                        cursor: joining ? 'not-allowed' : 'pointer',
                        letterSpacing: 1,
                        transition: 'all 0.2s ease',
                        opacity: joining ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                        if (!joining) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,0,255,0.3)';
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 15px rgba(255,0,255,0.4)';
                        }
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,0,255,0.15)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    }}
                >
                    {joining ? 'JOINING...' : 'JOIN'}
                </button>
            )}
        </div>
    );
}

// ─── Event Toast ───
function EventToast({ event, onDismiss }: { event: { type: string; match: MatchRecord }; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const messages: Record<string, { icon: string; text: string; color: string }> = {
        'new_match': { icon: '🎮', text: 'New match created!', color: '#00ff88' },
        'player_joined': { icon: '⚔️', text: 'Player joined a match!', color: '#ff00ff' },
        'match_locked': { icon: '🔒', text: 'Match locked!', color: '#ffaa00' },
        'match_racing': { icon: '🏎️', text: 'Race in progress!', color: '#00ffff' },
        'match_completed': { icon: '🏆', text: 'Match completed!', color: '#00ff88' },
        'match_cancelled': { icon: '❌', text: 'Match cancelled', color: '#ff4444' },
    };

    const msg = messages[event.type] || { icon: '📡', text: 'Update', color: '#888' };

    return (
        <div style={{
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.85)',
            border: `1px solid ${msg.color}33`,
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: FONT, fontSize: 11,
            color: msg.color,
            animation: 'toastSlide 0.3s ease-out',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
        }} onClick={onDismiss}>
            <span style={{ fontSize: 16 }}>{msg.icon}</span>
            <span style={{ letterSpacing: 1 }}>{msg.text}</span>
        </div>
    );
}

// ─── Waiting Overlay ───
function WaitingForOpponent({ match, onCancel }: { match: MatchRecord; onCancel: () => void }) {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(d => d.length >= 3 ? '' : d + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            textAlign: 'center', padding: '40px 0',
        }}>
            <div style={{
                width: 80, height: 80, margin: '0 auto 24px',
                border: '3px solid rgba(0,255,255,0.2)',
                borderTop: '3px solid #00ffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <h3 style={{
                fontFamily: FONT, fontSize: 22, fontWeight: 700,
                color: '#00ffff', letterSpacing: 3, marginBottom: 12,
            }}>
                WAITING FOR OPPONENT{dots}
            </h3>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#666', marginBottom: 8 }}>
                Match ID: <span style={{ color: '#888' }}>{match.id}</span>
            </p>
            <p style={{ fontFamily: FONT, fontSize: 14, color: '#ffaa00', marginBottom: 32 }}>
                ⚡ {match.entry_fee} SOL Stake
            </p>
            <p style={{ fontSize: 12, color: '#555', marginBottom: 24 }}>
                Share the Match ID with a friend, or wait for someone to join from the lobby.
            </p>
            <GhostButton onClick={onCancel} color="#ff4444">CANCEL MATCH</GhostButton>
        </div>
    );
}

// ─── Match Ready Overlay ───
function MatchReady({ match, isCreator }: { match: MatchRecord; isCreator: boolean }) {
    const opponent = isCreator ? match.opponent_username : match.creator_username;

    return (
        <div style={{
            textAlign: 'center', padding: '40px 0',
        }}>
            <div style={{
                fontSize: 60, marginBottom: 16,
                animation: 'readyBounce 0.6s ease-out',
            }}>⚔️</div>
            <h3 style={{
                fontFamily: FONT, fontSize: 26, fontWeight: 900,
                color: '#ff00ff', letterSpacing: 4, marginBottom: 16,
                textShadow: '0 0 30px rgba(255,0,255,0.5)',
            }}>
                OPPONENT FOUND!
            </h3>
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24,
                marginBottom: 24,
            }}>
                <div style={{
                    padding: '12px 20px',
                    background: 'rgba(0,255,255,0.08)',
                    border: '1px solid rgba(0,255,255,0.3)',
                    borderRadius: 8,
                    fontFamily: FONT, fontSize: 13, color: '#00ffff',
                    letterSpacing: 1,
                }}>
                    {isCreator ? 'YOU' : (match.creator_username || match.creator_wallet.slice(0, 8))}
                </div>
                <span style={{ fontFamily: FONT, fontSize: 18, color: '#ff00ff', fontWeight: 900 }}>VS</span>
                <div style={{
                    padding: '12px 20px',
                    background: 'rgba(255,0,255,0.08)',
                    border: '1px solid rgba(255,0,255,0.3)',
                    borderRadius: 8,
                    fontFamily: FONT, fontSize: 13, color: '#ff00ff',
                    letterSpacing: 1,
                }}>
                    {isCreator ? (opponent || '???') : 'YOU'}
                </div>
            </div>
            <p style={{ fontFamily: FONT, fontSize: 14, color: '#ffaa00', marginBottom: 8 }}>
                ⚡ {match.entry_fee} SOL each
            </p>
            <p style={{ fontFamily: FONT, fontSize: 11, color: '#555', letterSpacing: 2 }}>
                LAUNCHING RACE...
            </p>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// Main RankedLobby Component
// ═══════════════════════════════════════════════════
export function RankedLobby({ onMatchReady, onBack }: Props) {
    const wallet = useWallet();
    const { isAuthenticated, isAuthenticating, authenticateWithWallet } = useWalletAuth();
    const {
        matches, myMatch, error, events, clearEvent,
        createMatchEntry, joinMatchEntry, cancelMatch, findMyMatch,
    } = useMatchmaking();
    const { createMatch: createOnChain, joinMatch: joinOnChain, lockMatch: lockOnChain, isReady: contractReady, loading: chainLoading } = useRankedMatch();

    const [stake, setStake] = useState('0.1');
    const [joining, setJoining] = useState(false);
    const [creating, setCreating] = useState(false);
    const launchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Check if user already has an active match on mount
    useEffect(() => {
        if (wallet.publicKey) {
            findMyMatch();
        }
    }, [wallet.publicKey, findMyMatch]);

    // Auto-launch race when match becomes locked (opponent joined)
    useEffect(() => {
        if (myMatch && myMatch.status === 'locked' && !launchTimerRef.current) {
            launchTimerRef.current = setTimeout(() => {
                onMatchReady(myMatch.id, myMatch.entry_fee);
            }, 2500); // 2.5s delay so both players see the "OPPONENT FOUND!" screen
        }

        return () => {
            if (launchTimerRef.current) {
                clearTimeout(launchTimerRef.current);
                launchTimerRef.current = null;
            }
        };
    }, [myMatch?.status, myMatch?.id]);

    // ─── Create Match ───
    const handleCreate = useCallback(async () => {
        if (!wallet.publicKey || !contractReady) return;
        setCreating(true);

        try {
            const matchId = crypto.randomUUID();
            const entryFee = parseFloat(stake) || 0.1;

            // 1. Create on-chain escrow
            await createOnChain(matchId, entryFee);

            // 2. Join on-chain (deposit SOL)
            await joinOnChain(matchId);

            // 3. Record in InsForge DB for real-time matchmaking
            await createMatchEntry(matchId, entryFee);

        } catch (err: any) {
            console.error('Create match failed:', err);
            alert('Failed to create match: ' + (err.message || String(err)));
        } finally {
            setCreating(false);
        }
    }, [wallet.publicKey, contractReady, stake, createOnChain, joinOnChain, createMatchEntry]);

    // ─── Join Match ───
    const handleJoin = useCallback(async (matchId: string) => {
        if (!wallet.publicKey || !contractReady) return;
        setJoining(true);

        try {
            // 1. Find the match to get entry fee
            const match = matches.find(m => m.id === matchId);
            if (!match) throw new Error('Match not found');

            // 2. Join on-chain (deposit SOL into escrow)
            await joinOnChain(matchId);

            // 3. Lock on-chain
            await lockOnChain(matchId);

            // 4. Update InsForge DB (this triggers real-time update for the other player)
            await joinMatchEntry(matchId);

        } catch (err: any) {
            console.error('Join match failed:', err);
            alert('Failed to join match: ' + (err.message || String(err)));
        } finally {
            setJoining(false);
        }
    }, [wallet.publicKey, contractReady, matches, joinOnChain, lockOnChain, joinMatchEntry]);

    // ─── Cancel Match ───
    const handleCancel = useCallback(async () => {
        if (!myMatch) return;
        try {
            await cancelMatch(myMatch.id);
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    }, [myMatch, cancelMatch]);

    const isCreator = myMatch?.creator_wallet === wallet.publicKey?.toBase58();
    const walletAddr = wallet.publicKey?.toBase58() || null;
    const waitingMatches = matches.filter(m =>
        m.status === 'waiting' && m.creator_wallet !== walletAddr
    );

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(5, 5, 20, 0.97)',
            backdropFilter: 'blur(20px)',
            fontFamily: FONT,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            overflow: 'auto',
            zIndex: 50,
        }}>
            {/* CSS Animations */}
            <style>{`
                @keyframes lobbyPulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(2); opacity: 0; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes readyBounce {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.3); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes toastSlide {
                    from { transform: translateX(100px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(0,255,255,0.1); }
                    50% { box-shadow: 0 0 40px rgba(0,255,255,0.25); }
                }
            `}</style>

            {/* Event Toasts */}
            <div style={{
                position: 'fixed', top: 20, right: 20, zIndex: 100,
                display: 'flex', flexDirection: 'column', gap: 8,
            }}>
                {events.map((event, i) => (
                    <EventToast key={i} event={event} onDismiss={() => clearEvent(i)} />
                ))}
            </div>

            {/* Header */}
            <div style={{ paddingTop: 60, paddingBottom: 20, textAlign: 'center' }}>
                <h2 style={{
                    color: '#fff', fontSize: 38, fontWeight: 900,
                    letterSpacing: 6, textShadow: '0 0 20px #ff00ff44',
                }}>
                    RANKED <span style={{ color: '#ff00ff' }}>LOBBY</span>
                </h2>
                <p style={{ color: '#555', fontSize: 12, letterSpacing: 3, marginTop: 8 }}>
                    REAL-TIME MATCHMAKING • SOLANA MAINNET
                </p>
            </div>

            {/* Main content */}
            <div style={{ width: '100%', maxWidth: 700, padding: '0 24px', flex: 1 }}>

                {/* Not connected */}
                {!wallet.connected ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
                            Connect your Phantom Wallet to enter ranked matchmaking.
                        </p>
                        <WalletMultiButton style={{
                            background: 'linear-gradient(135deg, #ff00ff, #8800ff)',
                            fontFamily: FONT, borderRadius: 8, padding: '0 32px',
                        }} />
                    </div>
                ) : !isAuthenticated ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
                            Wallet connected. Now authenticate with the Neon game server.
                        </p>
                        <GhostButton color="#00ffff" onClick={async () => {
                            try {
                                await authenticateWithWallet();
                            } catch (e: any) {
                                alert('Authentication failed: ' + e.message);
                            }
                        }} disabled={isAuthenticating}>
                            {isAuthenticating ? 'AUTHENTICATING...' : 'SECURE LOGIN ⚡'}
                        </GhostButton>
                    </div>
                ) : myMatch?.status === 'locked' ? (
                    /* Match ready — opponent found */
                    <MatchReady match={myMatch} isCreator={isCreator} />
                ) : myMatch?.status === 'waiting' ? (
                    /* Waiting for opponent */
                    <WaitingForOpponent match={myMatch} onCancel={handleCancel} />
                ) : (
                    /* No active match — show lobby */
                    <>
                        {/* Create Match */}
                        <div style={{
                            padding: 24,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(0,255,255,0.15)',
                            borderRadius: 12,
                            marginBottom: 24,
                            animation: 'glowPulse 3s ease-in-out infinite',
                        }}>
                            <h3 style={{ color: '#00ffff', fontSize: 16, letterSpacing: 2, marginBottom: 16 }}>
                                CREATE MATCH
                            </h3>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ color: '#555', fontSize: 10, letterSpacing: 2, display: 'block', marginBottom: 6 }}>
                                        STAKE (SOL)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={stake}
                                        onChange={(e) => setStake(e.target.value)}
                                        style={{
                                            width: '100%', background: 'rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(0,255,255,0.2)', borderRadius: 6,
                                            color: '#fff', padding: '12px', fontFamily: 'monospace',
                                            fontSize: 18, textAlign: 'center', outline: 'none',
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,255,255,0.5)'}
                                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,255,255,0.2)'}
                                    />
                                </div>
                                <NeonButton
                                    onClick={handleCreate}
                                    color="#00ffff"
                                    style={{
                                        padding: '12px 28px',
                                        filter: (creating || chainLoading || !contractReady) ? 'grayscale(1)' : 'none',
                                        pointerEvents: (creating || chainLoading || !contractReady) ? 'none' : 'auto',
                                    }}
                                >
                                    {creating || chainLoading ? '⏳ CREATING...' : '+ CREATE MATCH'}
                                </NeonButton>
                            </div>
                            {error && <p style={{ color: '#ff4444', fontSize: 11, marginTop: 8 }}>{error}</p>}
                            {!contractReady && (
                                <p style={{ color: '#ffaa00', fontSize: 11, marginTop: 8, letterSpacing: 1 }}>
                                    ⚠ Waiting for Anchor program connection...
                                </p>
                            )}
                        </div>

                        {/* Available Matches */}
                        <div style={{
                            padding: 24,
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 12,
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: 16,
                            }}>
                                <h3 style={{ color: '#fff', fontSize: 14, letterSpacing: 2 }}>
                                    OPEN MATCHES
                                </h3>
                                <span style={{
                                    fontFamily: 'monospace', fontSize: 11, color: '#555',
                                    padding: '2px 8px', background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 4,
                                }}>
                                    {waitingMatches.length} available
                                </span>
                            </div>

                            {waitingMatches.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🏎️</div>
                                    <p style={{ color: '#555', fontSize: 13, lineHeight: 1.6 }}>
                                        No matches available right now.
                                        <br />
                                        Create one and wait for a challenger!
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {waitingMatches.map(match => (
                                        <MatchCard
                                            key={match.id}
                                            match={match}
                                            isOwn={false}
                                            onJoin={handleJoin}
                                            joining={joining}
                                            walletAddr={walletAddr}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Back button */}
            <div style={{ padding: '32px 0' }}>
                <GhostButton onClick={onBack} color="#fff">BACK TO MODES</GhostButton>
            </div>
        </div>
    );
}
