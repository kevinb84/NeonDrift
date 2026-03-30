import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRankedMatch } from '../hooks/useRankedMatch';
import { GameScene } from '../game3d/GameScene';
import { useGameFlow } from '../game3d/menu/useGameFlow';
import { TitleScreen } from '../game3d/menu/TitleScreen';
import { LeaderboardManager } from '../lib/leaderboard';
import { CarSelect } from '../game3d/menu/CarSelect';
import { TrackSelect } from '../game3d/menu/TrackSelect';
import { DifficultySelect } from '../game3d/menu/DifficultySelect';
import { PostRaceScreen } from '../game3d/menu/PostRaceScreen';
import { ModeSelectScreen } from '../game3d/menu/ModeSelectScreen';
import { RankedLobby } from '../game3d/menu/RankedLobby';
import type { CarConfig, Difficulty, TrackConfig } from '../game3d/menu/useGameFlow';
import type { ReplayData } from '../game3d/hooks/useGhostRecorder';

export const Game = () => {
    const {
        state,
        goToCarSelect,
        goToTitle,
        selectCar,
        goToTrackSelect,
        selectTrack,
        goToDifficulty,
        selectDifficulty,
        startRace,
        restartRace,
        finishRace,
        goToModeSelect,
        goToRankedLobby,
        selectMode,
        startRankedMatch,
    } = useGameFlow();

    const location = useLocation();
    const wallet = useWallet();
    const { distributeRewards } = useRankedMatch();

    const [submitStatus, setSubmitStatus] = useState<string>('');
    const [txHash, setTxHash] = useState<string>('');

    // Ghost replay data from location state
    const ghostReplayData = (location.state?.ghostReplayData as ReplayData) || null;

    // Incrementing this key forces GameScene to fully remount (fresh race state)
    const [raceKey, setRaceKey] = useState(0);

    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!hasStartedRef.current && state.phase === 'title') {
            if (location.state?.matchId) {
                hasStartedRef.current = true;
                startRankedMatch(location.state.matchId, 0.1); 
            } else if (location.state?.autoStartRanked) {
                hasStartedRef.current = true;
                goToRankedLobby();
            }
        }
    }, [location.state, state.phase, startRankedMatch, goToRankedLobby]);

    const handleFinish = useCallback((stats: { position: number; raceTime: number; bestLapTime: number }) => {
        const previousBest = LeaderboardManager.getLocalBest(state.selectedTrack.id, state.difficulty);
        const isNewPb = LeaderboardManager.recordLocalTime(state.selectedTrack.id, state.difficulty, stats.raceTime);
        
        finishRace({ ...stats, previousBest, isNewPb });

        // Submit to blockchain if it's a ranked match
        if (state.matchConfig?.type === 'ranked' && state.matchConfig.matchId) {
            if (stats.position === 1) { // Basic assumption: win = 1st place
                setSubmitStatus('Submitting result...');
                setTxHash('');
                // Use setTimeout to ensure UI updates before async work freezes Thread
                setTimeout(async () => {
                    if (!wallet.publicKey) {
                        setSubmitStatus('Error: Wallet auto-disconnected.');
                        return;
                    }

                    try {
                        const matchId = state.matchConfig!.matchId!;
                        
                        // 1. Get the signature from the Local Oracle Server
                        setSubmitStatus('Requesting oracle signature from server...');
                        
                        const res = await fetch('http://localhost:3001/sign-reward', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                matchId: matchId,
                                winnerPubkey: wallet.publicKey.toBase58(),
                            })
                        });
                        
                        const data = await res.json();

                        if (!res.ok || !data.success) {
                            throw new Error(data.error || 'Oracle signature failed');
                        }

                        // 2. Call the new distributeRewards hook with the oracle signature
                        setSubmitStatus('Sending blockchain transaction...');
                        const result = await distributeRewards(
                            matchId,
                            wallet.publicKey,
                            data.signature
                        );
                        
                        setTxHash(result.signature);
                        setSubmitStatus('Winner Paid ✓');
                    } catch (err: any) {
                        setSubmitStatus(`Error: ${err.message || String(err)}`);
                        console.error('Submission failed', err);
                    }
                }, 100);
            } else {
                setSubmitStatus('You did not win this race. No rewards distributed.');
            }
        } else {
            // Async fire-and-forget submission - ONLY IF NOT RANKED (practice/leaderboard mode)
            if (state.matchConfig?.type !== 'ranked') {
                LeaderboardManager.submitScore(
                    state.selectedTrack.id,
                    state.difficulty,
                    state.selectedCar.id,
                    stats.raceTime,
                    stats.position
                );
            }
        }
    }, [finishRace, state, distributeRewards, location.state]);

    const handleRaceAgain = useCallback(() => {
        setRaceKey(k => k + 1);
        restartRace();
    }, [restartRace]);

    const handleChangeCar = useCallback(() => {
        goToCarSelect();
    }, [goToCarSelect]);

    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
            marginLeft: 'calc(-50vw + 50%)',
        }}>
            {/* ── Title Screen ── */}
            {state.phase === 'title' && (
                <TitleScreen onStart={goToModeSelect} />
            )}

            {/* ── Mode Selection ── */}
            {state.phase === 'mode-select' && (
                <ModeSelectScreen
                    onSelect={(type, stake) => {
                        if (type === 'ranked') {
                            goToRankedLobby();
                        } else {
                            selectMode(type, stake);
                        }
                    }}
                    onBack={goToTitle}
                />
            )}

            {/* ── Ranked Lobby (Real-time Matchmaking) ── */}
            {state.phase === 'ranked-lobby' && (
                <RankedLobby
                    onMatchReady={(matchId, stake) => {
                        startRankedMatch(matchId, stake);
                    }}
                    onBack={goToModeSelect}
                />
            )}

            {/* ── Car Selection ── */}
            {state.phase === 'car-select' && (
                <CarSelect
                    selected={state.selectedCar}
                    onSelect={(car: CarConfig) => selectCar(car)}
                    onConfirm={() => {
                        if (state.matchConfig?.type === 'ranked') {
                            startRace();
                        } else {
                            goToTrackSelect();
                        }
                    }}
                    onBack={state.matchConfig?.type === 'ranked' ? goToRankedLobby : goToTitle}
                />
            )}

            {/* ── Track Selection ── */}
            {state.phase === 'track-select' && (
                <TrackSelect
                    selected={state.selectedTrack}
                    onSelect={(track: TrackConfig) => selectTrack(track)}
                    onConfirm={goToDifficulty}
                    onBack={goToCarSelect}
                />
            )}

            {/* ── Difficulty Selection ── */}
            {state.phase === 'difficulty' && (
                <DifficultySelect
                    selected={state.difficulty}
                    onSelect={(d: Difficulty) => selectDifficulty(d)}
                    onConfirm={startRace}
                    onBack={goToTrackSelect}
                />
            )}

            {/* ── Racing + Post-Race ── */}
            {(state.phase === 'racing' || state.phase === 'finished') && (
                <>
                    <GameScene
                        key={raceKey}
                        car={state.selectedCar}
                        track={state.selectedTrack}
                        difficulty={state.difficulty}
                        matchConfig={state.matchConfig}
                        walletAddr={wallet.publicKey?.toBase58() || null}
                        ghostReplayData={ghostReplayData}
                        onFinish={handleFinish}
                    />

                    {/* Ranked Match Submission Full-Screen Overlay (Hides PostRaceScreen during pending tx) */}
                    {state.phase === 'finished' && state.matchConfig?.type === 'ranked' && submitStatus && !submitStatus.includes('Paid') && !submitStatus.includes('Error') && !submitStatus.includes('not win') && (
                        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
                            <div className="p-8 border border-primary/50 text-white rounded-xl shadow-[0_0_50px_rgba(0,255,255,0.2)] text-center max-w-lg">
                                <h3 className="text-primary font-bold text-2xl mb-6 tracking-widest font-['Orbitron']">
                                    ON-CHAIN VERIFICATION
                                </h3>
                                <div className="text-lg text-slate-300 space-y-4">
                                    {submitStatus.includes('oracle') ? (
                                        <div className="flex flex-col items-center gap-4 text-cyan-400">
                                            <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                            <span>Requesting Oracle Signature...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 text-primary">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                            <span>Waiting for Blockchain Confirmation...</span>
                                        </div>
                                    )}
                                    <p className="font-mono text-sm opacity-50 pt-4">Do not close this window</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Show normal Post Race screen if NOT ranked, or if ranked and finished submitting (success or error) */}
                    {state.phase === 'finished' && state.raceStats && 
                     (!state.matchConfig || state.matchConfig.type !== 'ranked' || submitStatus.includes('Paid') || submitStatus.includes('Error') || submitStatus.includes('not win')) && (
                        <>
                            <PostRaceScreen
                                position={state.raceStats.position}
                                raceTime={state.raceStats.raceTime}
                                bestLapTime={state.raceStats.bestLapTime}
                                previousBest={state.raceStats.previousBest}
                                isNewPb={state.raceStats.isNewPb}
                                car={state.selectedCar}
                                difficulty={state.difficulty}
                                onRaceAgain={state.matchConfig?.type === 'ranked' ? undefined : handleRaceAgain}
                                onChangeCar={state.matchConfig?.type === 'ranked' ? undefined : handleChangeCar}
                                onMainMenu={goToTitle}
                            />

                            {/* Show final success/error status on top of PostRaceScreen for ranked matches */}
                            {state.matchConfig?.type === 'ranked' && submitStatus && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[101] flex flex-col items-center">
                                    <div className="px-6 py-4 bg-black/80 backdrop-blur-md border border-primary/50 text-white rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.3)] min-w-[350px] text-center">
                                        <h3 className="text-primary font-bold text-lg mb-2 tracking-widest font-['Orbitron']">
                                            RANKED MATCH RESULTS
                                        </h3>
                                        
                                        <div className="mb-4 pt-2 border-t border-primary/20 flex justify-between px-4">
                                            <span className="text-slate-400 text-sm">Winner</span>
                                            <span className="font-bold text-cyan-400">
                                                {submitStatus.includes('Paid') ? 'YOU' : 'OPPONENT'}
                                            </span>
                                        </div>

                                        <div className="mb-4 flex justify-between px-4">
                                            <span className="text-slate-400 text-sm">Prize Pool</span>
                                            <span className="font-bold text-yellow-400">
                                                {(state.matchConfig.stake * 2).toFixed(2)} SOL
                                            </span>
                                        </div>

                                        <div className="text-sm text-slate-300 border-t border-primary/20 pt-3">
                                            <p className={`font-mono ${submitStatus.includes('Error') ? 'text-red-400' : submitStatus.includes('Paid') ? 'text-green-400' : 'text-slate-300'}`}>
                                                {submitStatus}
                                            </p>
                                            {txHash && (
                                                <p className="mt-2 text-xs text-slate-400 break-all bg-black/50 p-2 rounded">
                                                    TX: {txHash}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};
