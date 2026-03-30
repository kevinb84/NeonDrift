import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Road } from './components/Road';
import { Car } from './components/Car';
import { City } from './components/City';
import { Particles } from './components/Particles';
import { AIOpponents } from './components/AIOpponents';
import { RemotePlayer } from './components/RemotePlayer';
import { GhostCar } from './components/GhostCar';
import { FinishLine } from './components/FinishLine';
import { Desert } from './components/Desert';
import { Tunnel } from './components/Tunnel';
import { useGameControls } from './hooks/useGameControls';
import { useRaceState } from './hooks/useRaceState';
import { useCollision } from './hooks/useCollision';
import { useSound } from './hooks/useSound';
import { useMultiplayerSync } from './hooks/useMultiplayerSync';
import { useGhostRecorder } from './hooks/useGhostRecorder';
import { useGhostPlayback } from './hooks/useGhostPlayback';
import type { GhostState } from './hooks/useGhostPlayback';
import type { ReplayData } from './hooks/useGhostRecorder';
import { useSettings } from './menu/SettingsMenu';
import { createSeededRandom } from '../lib/random';
import type { CarConfig, Difficulty, TrackConfig } from './menu/useGameFlow';
import { DIFFICULTY_CONFIG } from './menu/useGameFlow';
import { getCurveOffset } from './utils/curveOffset';
import type { RemotePlayerData } from './hooks/useMultiplayerSync';

const BASE_SPEED = 30;
const MAX_SPEED = 80;
const NITRO_MAX_SPEED = 130;
const ACCEL = 15;
const DECEL = 25;
const LAP_DISTANCE = 2000;
const NITRO_DRAIN = 30;     // % per second while boosting
const NITRO_CHARGE = 8;     // % per second while not boosting
const NITRO_MIN_USE = 10;   // minimum tank % to activate

export interface GameSceneProps {
    car?: CarConfig;
    track?: TrackConfig;
    difficulty?: Difficulty;
    matchConfig: import('./menu/useGameFlow').MatchConfig | null;
    walletAddr?: string | null;
    ghostReplayData?: ReplayData | null;
    onFinish?: (stats: { position: number; raceTime: number; bestLapTime: number }) => void;
}

/** Chase camera — widens FOV during nitro */
function CameraRig({
    speedRef,
    nitroActive,
    playerXRef,
    playerDistRef,
    track,
    cameraShakeRef,
    randomFn
}: {
    speedRef: React.RefObject<number>;
    nitroActive: React.RefObject<boolean>;
    playerXRef: React.RefObject<number>;
    playerDistRef: React.RefObject<number>;
    track?: TrackConfig;
    cameraShakeRef: React.MutableRefObject<number>;
    randomFn: () => number;
}) {
    const { camera } = useThree();
    const target = useRef(new THREE.Vector3());
    const fovTarget = useRef(60);

    useFrame((_, dt) => {
        const spd = speedRef.current ?? BASE_SPEED;
        const playerX = playerXRef.current ?? 0;
        const dist = playerDistRef.current ?? 0;

        // Decay camera shake
        if (cameraShakeRef.current > 0) {
            cameraShakeRef.current = Math.max(0, cameraShakeRef.current - dt * 2.5);
        }
        const shake = cameraShakeRef.current;

        // Current world X position of the car
        const carXWorld = playerX + getCurveOffset(0, dist, track);

        // Sample a point slightly ahead to find the "forward" tangent of the curve
        const lookAheadZ = -5;
        const lookAheadXWorld = playerX + getCurveOffset(lookAheadZ, dist, track);

        const forward = new THREE.Vector3(lookAheadXWorld - carXWorld, 0, lookAheadZ).normalize();

        // Calculate camera target position: behind the car, aligned with the curve
        const camDist = 10 + spd * 0.04;
        const camHeight = 4 + spd * 0.02;

        target.current.set(
            carXWorld - forward.x * camDist + (randomFn() - 0.5) * shake * 2,
            camHeight + (randomFn() - 0.5) * shake * 1.5,
            -forward.z * camDist + (randomFn() - 0.5) * shake * 2
        );

        camera.position.lerp(target.current, dt * (4 + shake * 5)); // Snap faster during shake

        // Determine look-at target smoothly ahead on the track
        const focalZ = -20;
        // Look slightly towards the center of the road rather than the exact lane for a smoother feel
        const focalXWorld = (playerX * 0.6) + getCurveOffset(focalZ, dist, track);
        camera.lookAt(focalXWorld, 0.5, focalZ);

        // FOV widens during nitro for speed rush feel
        fovTarget.current = nitroActive.current ? 78 : 60;
        const cam = camera as THREE.PerspectiveCamera;
        cam.fov = THREE.MathUtils.lerp(cam.fov, fovTarget.current, dt * 5);
        cam.updateProjectionMatrix();
    });

    return null;
}

/** Scene content — runs inside <Canvas> */
function SceneContent({
    speedRef,
    nitroRef,
    nitroActiveRef,
    onFrame,
    aiSpeedMult,
    bloomIntensity,
    playerDistRef,
    track,
    cameraShakeRef,
    playerKnockbackRef,
    aiKnockbackRef,
    randomFn,
    isRanked,
    getRemoteState,
    getGhostState,
    hasGhost,
}: {
    speedRef: React.MutableRefObject<number>;
    nitroRef: React.MutableRefObject<number>;
    nitroActiveRef: React.MutableRefObject<boolean>;
    onFrame: (speed: number, playerX: number, aiPositions: { x: number; z: number; totalDist: number }[], dt: number) => void;
    aiSpeedMult: number;
    bloomIntensity: number;
    playerDistRef: React.MutableRefObject<number>;
    track?: TrackConfig;
    cameraShakeRef: React.MutableRefObject<number>;
    playerKnockbackRef: React.MutableRefObject<number>;
    aiKnockbackRef: React.MutableRefObject<{ [idx: number]: number }>;
    randomFn: () => number;
    isRanked: boolean;
    getRemoteState: () => RemotePlayerData | null;
    getGhostState?: () => GhostState | null;
    hasGhost: boolean;
}) {
    const controls = useGameControls();
    const playerXRef = useRef(0);
    const aiPosRef = useRef<{ x: number; z: number; totalDist: number }[]>([]);

    useFrame((_, dt) => {
        const ctrl = controls.current;
        if (!ctrl) return;

        // Nitro logic
        const wantsNitro = ctrl.nitro && ctrl.up && nitroRef.current > NITRO_MIN_USE;
        nitroActiveRef.current = wantsNitro && nitroRef.current > 0;

        if (nitroActiveRef.current) {
            nitroRef.current = Math.max(0, nitroRef.current - NITRO_DRAIN * dt);
        } else {
            nitroRef.current = Math.min(100, nitroRef.current + NITRO_CHARGE * dt);
        }

        const cap = nitroActiveRef.current ? NITRO_MAX_SPEED : MAX_SPEED;
        const accel = nitroActiveRef.current ? ACCEL * 2.5 : ACCEL;

        if (ctrl.up) {
            speedRef.current = Math.min(speedRef.current + accel * dt, cap);
        } else if (ctrl.down) {
            speedRef.current = Math.max(speedRef.current - DECEL * dt, BASE_SPEED * 0.3);
        } else {
            speedRef.current = THREE.MathUtils.lerp(speedRef.current, BASE_SPEED, dt * 0.5);
        }

        onFrame(speedRef.current, playerXRef.current, aiPosRef.current, dt);
    });

    const handleAIUpdate = useCallback((_positions: number[]) => {
        // kept for compatibility
    }, []);

    // Get track specific lighting or fallbacks
    const lHem = track?.lighting?.hemisphere || ['#8866dd', '#2a2a44', 1.8];
    const lAmb = track?.lighting?.ambient || ['#443366', 1.2];
    const lDir1 = track?.lighting?.directional1 || [10, 50, 20, 1.5, '#aaaaff'];
    const lDir2 = track?.lighting?.directional2 || [-10, 40, -20, 0.8, '#7777bb'];

    return (
        <>
            {/* ── Lighting ── */}
            <hemisphereLight args={[lHem[0], lHem[1], lHem[2]]} />
            <ambientLight intensity={lAmb[1] as number} color={lAmb[0] as string} />
            <directionalLight position={[lDir1[0] as number, lDir1[1] as number, lDir1[2] as number]} intensity={lDir1[3] as number} color={lDir1[4] as string} />
            <directionalLight position={[lDir2[0] as number, lDir2[1] as number, lDir2[2] as number]} intensity={lDir2[3] as number} color={lDir2[4] as string} />
            <pointLight position={[-20, 15, -10]} intensity={3} color="#ff00ff" distance={100} />
            <pointLight position={[20, 15, -10]} intensity={3} color="#00ffff" distance={100} />
            <pointLight position={[0, 25, -50]} intensity={2} color="#8833ff" distance={120} />
            <pointLight position={[0, 10, 15]} intensity={2} color="#4444aa" distance={60} />

            <fog attach="fog" args={[track?.fogColor || '#150e2a', 50, 280]} />
            <color attach="background" args={[track?.bgColor || '#150e2a']} />

            <CameraRig speedRef={speedRef} nitroActive={nitroActiveRef} playerXRef={playerXRef} playerDistRef={playerDistRef} track={track} cameraShakeRef={cameraShakeRef} randomFn={randomFn} />

            <Road speed={speedRef.current} accentColor={track?.accentColor} envType={track?.envType} playerDistRef={playerDistRef} track={track} />
            <Car controls={controls} speed={speedRef} onPositionChange={(x: number) => { playerXRef.current = x; }} playerDistRef={playerDistRef} track={track} knockbackRef={playerKnockbackRef} />

            {/* AI Opponents — only in practice mode */}
            {!isRanked && (
                <AIOpponents
                    playerSpeed={speedRef}
                    aiSpeedMult={aiSpeedMult}
                    onPositionUpdate={handleAIUpdate}
                    onDetailedUpdate={(cars) => { aiPosRef.current = cars; }}
                    playerDistRef={playerDistRef}
                    track={track}
                    aiKnockbackRef={aiKnockbackRef}
                    randomFn={randomFn}
                />
            )}

            {/* Remote Player — only in ranked mode */}
            {isRanked && (
                <RemotePlayer
                    getState={getRemoteState}
                    playerDistRef={playerDistRef}
                    track={track}
                />
            )}

            {/* Ghost Car — when ghost replay is loaded */}
            {hasGhost && getGhostState && (
                <GhostCar
                    getState={getGhostState}
                    playerDistRef={playerDistRef}
                    track={track}
                />
            )}

            {track?.envType === 'city' && <City speed={speedRef.current} playerDistRef={playerDistRef} track={track} />}
            {track?.envType === 'desert' && <Desert speed={speedRef.current} playerDistRef={playerDistRef} track={track} />}
            {track?.envType === 'tunnel' && <Tunnel speed={speedRef.current} playerDistRef={playerDistRef} track={track} />}
            {track?.envType !== 'desert' && (
                <Particles speed={speedRef.current} playerDistRef={playerDistRef} track={track} />
            )}
            <FinishLine playerDist={playerDistRef} lapDistance={LAP_DISTANCE} />

            <EffectComposer>
                <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.85} intensity={bloomIntensity} mipmapBlur />
            </EffectComposer>
        </>
    );
}

const FONT = "'Orbitron', monospace, sans-serif";

/** Main game scene */
export function GameScene({ car, track, difficulty, matchConfig, walletAddr, ghostReplayData, onFinish }: GameSceneProps) {
    const { quality } = useSettings();
    const bloomIntensity = quality === 'high' ? 1.6 : 0.6;
    const aiSpeedMult = DIFFICULTY_CONFIG[(difficulty || 'medium') as Difficulty].aiSpeedMult;

    const speedRef = useRef(BASE_SPEED * (car?.speedMult ?? 1));
    const nitroRef = useRef(100);  // starts full
    const nitroActiveRef = useRef(false);
    const distanceRef = useRef(0);
    const lastCountdown = useRef(-1);

    // Physics Refs
    const cameraShakeRef = useRef(0);
    const playerKnockbackRef = useRef(0);
    const aiKnockbackRef = useRef<{ [idx: number]: number }>({});

    // Seeded random for determinism
    const randomFn = useMemo(() => createSeededRandom(matchConfig?.seed || Math.random()), [matchConfig?.seed]);

    // HUD refs
    const hudSpeedRef = useRef<HTMLSpanElement>(null);
    const hudPosRef = useRef<HTMLSpanElement>(null);
    const hudTimeRef = useRef<HTMLSpanElement>(null);
    const hudLapRef = useRef<HTMLSpanElement>(null);
    const nitroBarRef = useRef<HTMLDivElement>(null);
    const nitroGlowRef = useRef<HTMLDivElement>(null);
    const flashRef = useRef<HTMLDivElement>(null);
    const countdownRef = useRef<HTMLDivElement>(null);

    // Systems
    const raceState = useRaceState();
    const collision = useCollision();
    const sound = useSound();
    const [engineStarted, setEngineStarted] = useState(false);

    // Multiplayer sync — only active in ranked mode
    const isRanked = matchConfig?.type === 'ranked';
    const mpMatchId = isRanked ? matchConfig?.matchId || null : null;
    const { broadcastState, getInterpolatedState, remoteStateRef } = useMultiplayerSync(
        mpMatchId,
        walletAddr || null,
        walletAddr ? walletAddr.slice(0, 4) + '...' + walletAddr.slice(-4) : null,
    );

    // Ghost recording (always active — records every race)
    const ghostRecorder = useGhostRecorder();
    const ghostStartedRef = useRef(false);

    // Ghost playback (active when ghostReplayData is provided)
    const ghostPlayback = useGhostPlayback();
    const hasGhost = !!ghostReplayData;

    useEffect(() => {
        if (ghostReplayData) {
            ghostPlayback.loadReplayFromData(ghostReplayData);
        }
    }, [ghostReplayData]);

    // Start engine on first interaction
    useEffect(() => {
        const handler = () => {
            if (!engineStarted) {
                sound.startEngine();
                setEngineStarted(true);
            }
        };
        window.addEventListener('keydown', handler, { once: true });
        return () => window.removeEventListener('keydown', handler);
    }, [engineStarted, sound]);

    const finishedFired = useRef(false);

    const handleFrame = useCallback((speed: number, playerX: number, aiCars: { x: number; z: number; totalDist: number }[], dt: number) => {
        const rs = raceState.state.current;

        // Update race state
        raceState.update(dt);

        // Countdown beeps
        if (rs.phase === 'countdown' && rs.countdown !== lastCountdown.current && rs.countdown > 0) {
            lastCountdown.current = rs.countdown;
            sound.playBeep(false);
        }
        if (rs.phase === 'racing' && lastCountdown.current !== 0) {
            lastCountdown.current = 0;
            sound.playBeep(true); // GO!
        }

        // ── Always-update overlays (must run in all phases) ──

        // Countdown overlay
        if (countdownRef.current) {
            if (rs.phase === 'countdown') {
                countdownRef.current.style.display = 'flex';
                countdownRef.current.textContent = rs.countdown > 0 ? String(rs.countdown) : 'GO!';
            } else {
                countdownRef.current.style.display = 'none';
            }
        }

        // Finish — fire callback once
        if (rs.phase === 'finished' && !finishedFired.current) {
            finishedFired.current = true;

            // Save ghost replay automatically
            if (car && track && walletAddr) {
                ghostRecorder.saveReplay(
                    track.id,
                    car.id,
                    walletAddr,
                    rs.raceTime
                ).then(path => {
                    if (path) console.log('[Ghost] Replay saved:', path);
                });
            }

            if (onFinish) {
                onFinish({
                    position: rs.position,
                    raceTime: rs.raceTime,
                    bestLapTime: rs.bestLapTime,
                });
            }
        }

        // Collision flash
        if (flashRef.current) {
            flashRef.current.style.opacity = String(rs.collisionFlash * 0.5);
        }

        // Nitro HUD (always update)
        const nPct = nitroRef.current;
        if (nitroBarRef.current) {
            nitroBarRef.current.style.width = `${nPct}%`;
            nitroBarRef.current.style.background = nitroActiveRef.current
                ? 'linear-gradient(90deg, #ff6600, #ffaa00)'
                : 'linear-gradient(90deg, #00aaff, #00ffff)';
        }
        if (nitroGlowRef.current) {
            nitroGlowRef.current.style.opacity = nitroActiveRef.current ? '0.3' : '0';
        }

        // Only allow movement during racing
        if (rs.phase !== 'racing') {
            speedRef.current = 0;
            return;
        }

        // Start ghost recording on first racing frame
        if (!ghostStartedRef.current) {
            ghostRecorder.startRecording();
            ghostPlayback.resetPlayback();
            ghostStartedRef.current = true;
        }

        // Record frame for ghost replay
        ghostRecorder.recordFrame(rs.raceTime, playerX, speed, nitroActiveRef.current, distanceRef.current);

        // Track distance for laps
        distanceRef.current += speed * dt;
        if (distanceRef.current >= LAP_DISTANCE) {
            distanceRef.current -= LAP_DISTANCE;
            raceState.completeLap();
        }

        // Collision check
        const hit = collision.checkCollision(playerX, 0, aiCars, dt);
        if (hit) {
            raceState.triggerCollision();

            // Calculate penalty based on hit angle
            const isRearEnd = Math.abs(hit.dx) < 0.6; // Mostly lined up horizontally

            if (isRearEnd) {
                // Slammed into back of AI
                speedRef.current *= collision.SPEED_PENALTY * 0.8; // Harsher penalty
                cameraShakeRef.current = 1.2; // Massive shake

                cameraShakeRef.current = Math.min(cameraShakeRef.current + 0.4, 1.0);
                playerKnockbackRef.current = (randomFn() > 0.5 ? 1 : -1) * 0.5;
                if (aiKnockbackRef.current !== undefined) {
                    aiKnockbackRef.current[hit.aiIndex] = (randomFn() > 0.5 ? 1 : -1) * 0.3;
                }
            } else {
                // Sideswipe
                speedRef.current *= collision.SPEED_PENALTY * 1.5; // Lighter penalty (0.4 * 1.5 = 0.6)
                cameraShakeRef.current = 0.5; // Mild shake

                // Strong lateral push away from each other
                const pushDir = Math.sign(hit.dx); // 1 if player is right of AI, -1 if left
                playerKnockbackRef.current = pushDir * 2.0;
                aiKnockbackRef.current[hit.aiIndex] = -pushDir * 2.0;
            }

            sound.playCollision();
        }

        // Update sound
        sound.updateEngine(speed);

        // Position calculation
        const playerTotal = distanceRef.current;
        if (isRanked) {
            // Ranked: compare against remote player
            const remote = remoteStateRef.current;
            if (remote && remote.totalDist > playerTotal) {
                raceState.setPosition(2); // behind
            } else {
                raceState.setPosition(1); // ahead (or no remote data yet)
            }
        } else {
            // Practice: compare against AI
            const ahead = aiCars.filter((c) => c.totalDist > playerTotal).length;
            raceState.setPosition(ahead + 1);
        }

        // Broadcast local state in ranked mode
        if (isRanked) {
            broadcastState({
                x: playerX,
                speed,
                totalDist: playerTotal,
                lap: rs.lap,
                nitro: nitroActiveRef.current,
                finished: (rs.phase as string) === 'finished',
                raceTime: rs.raceTime,
                timestamp: Date.now(),
            });
        }

        // ── Update HUD ──
        if (hudSpeedRef.current) {
            hudSpeedRef.current.textContent = `${Math.round(speed * 3.6)}`;
        }
        if (hudTimeRef.current) {
            const t = rs.raceTime / 1000;
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            const ms = Math.floor((t % 1) * 100);
            hudTimeRef.current.textContent =
                `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        }
        if (hudPosRef.current) {
            const pos = rs.position;
            const suf = pos === 1 ? 'ST' : pos === 2 ? 'ND' : pos === 3 ? 'RD' : 'TH';
            hudPosRef.current.textContent = `${pos}${suf}`;
        }
        if (hudLapRef.current) {
            hudLapRef.current.textContent = `${rs.lap}/${rs.totalLaps}`;
        }
    }, [raceState, collision, sound]);



    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, background: track?.bgColor || '#150e2a' }}>
            <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />

            <Canvas
                camera={{ position: [0, 5, 12], fov: 60, near: 0.1, far: 400 }}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 2.2 }}
                style={{ width: '100%', height: '100%' }}
            >
                <SceneContent
                    speedRef={speedRef} nitroRef={nitroRef} nitroActiveRef={nitroActiveRef}
                    onFrame={handleFrame} aiSpeedMult={aiSpeedMult}
                    bloomIntensity={bloomIntensity}
                    playerDistRef={distanceRef}
                    track={track}
                    cameraShakeRef={cameraShakeRef}
                    playerKnockbackRef={playerKnockbackRef}
                    aiKnockbackRef={aiKnockbackRef}
                    randomFn={randomFn}
                    isRanked={isRanked}
                    getRemoteState={getInterpolatedState}
                    getGhostState={hasGhost ? () => ghostPlayback.getGhostState(raceState.state.current.raceTime) : undefined}
                    hasGhost={hasGhost}
                />
            </Canvas>

            {/* ── NITRO SPEED TINT ── */}
            <div ref={nitroGlowRef} style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 30%, #0088ff33 100%)',
                pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s',
            }} />

            {/* ── COLLISION FLASH ── */}
            <div ref={flashRef} style={{
                position: 'absolute', inset: 0, background: 'radial-gradient(circle, #ff000066, #ff000022)',
                pointerEvents: 'none', opacity: 0, transition: 'opacity 0.05s',
            }} />

            {/* ── COUNTDOWN OVERLAY ── */}
            <div ref={countdownRef} style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT, fontSize: 120, fontWeight: 900, color: '#ffffff',
                textShadow: '0 0 40px #00ffff, 0 0 80px #ff00ff', pointerEvents: 'none',
            }}>
                3
            </div>

            {/* Finish overlay is handled by PostRaceScreen in Game.tsx */}

            {/* ── HUD ── */}

            {/* Position — top left */}
            <div style={{ position: 'absolute', top: 24, left: 32, pointerEvents: 'none' }}>
                <span ref={hudPosRef} style={{
                    fontFamily: FONT, fontSize: 48, fontWeight: 900,
                    color: '#ffff00', textShadow: '0 0 15px #ffff00, 0 0 30px #ffff0055', letterSpacing: 2,
                }}>1ST</span>
                <div style={{ fontFamily: FONT, fontSize: 11, color: '#ffff0088', textTransform: 'uppercase', letterSpacing: 4, marginTop: 2 }}>
                    Position
                </div>
            </div>

            {/* Lap — top right */}
            <div style={{ position: 'absolute', top: 24, right: 32, pointerEvents: 'none', textAlign: 'right' }}>
                <span ref={hudLapRef} style={{
                    fontFamily: FONT, fontSize: 36, fontWeight: 900,
                    color: '#ff00ff', textShadow: '0 0 15px #ff00ff', letterSpacing: 2,
                }}>1/3</span>
                <div style={{ fontFamily: FONT, fontSize: 11, color: '#ff00ff88', textTransform: 'uppercase', letterSpacing: 4, marginTop: 2 }}>
                    Lap
                </div>
            </div>

            {/* Timer — top center */}
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', textAlign: 'center' }}>
                <span ref={hudTimeRef} style={{
                    fontFamily: FONT, fontSize: 28, fontWeight: 700,
                    color: '#ffffff', textShadow: '0 0 10px #ffffff44', letterSpacing: 3,
                }}>00:00.00</span>
                <div style={{ fontFamily: FONT, fontSize: 10, color: '#ffffff44', textTransform: 'uppercase', letterSpacing: 4, marginTop: 2 }}>
                    Race Time
                </div>
            </div>

            {/* Speed — bottom right */}
            <div style={{ position: 'absolute', bottom: 40, right: 40, display: 'flex', alignItems: 'baseline', gap: 4, pointerEvents: 'none' }}>
                <span ref={hudSpeedRef} style={{
                    fontFamily: FONT, fontSize: 56, fontWeight: 900,
                    color: '#00ffff', textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff55', letterSpacing: 2,
                }}>0</span>
                <span style={{ fontFamily: FONT, fontSize: 16, color: '#00ffff88', textTransform: 'uppercase', letterSpacing: 3 }}>
                    km/h
                </span>
            </div>

            {/* Nitro bar — bottom left */}
            <div style={{ position: 'absolute', bottom: 40, left: 32, pointerEvents: 'none' }}>
                <div style={{ fontFamily: FONT, fontSize: 11, color: '#00ccff88', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 }}>
                    🔥 Nitro
                </div>
                <div style={{
                    width: 140, height: 14, background: 'rgba(0,0,0,0.6)',
                    border: '1px solid #00ccff44', borderRadius: 3, overflow: 'hidden',
                }}>
                    <div ref={nitroBarRef} style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(90deg, #00aaff, #00ffff)',
                        borderRadius: 2, transition: 'width 0.1s',
                        boxShadow: '0 0 8px #00ccff88',
                    }} />
                </div>
            </div>

            {/* Controls */}
            <div style={{
                position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'sans-serif',
                pointerEvents: 'none', userSelect: 'none',
            }}>
                ← → Steer &nbsp;&nbsp; ↑ Accelerate &nbsp;&nbsp; ↓ Brake &nbsp;&nbsp; Shift/Space NITRO
            </div>
        </div>
    );
}
