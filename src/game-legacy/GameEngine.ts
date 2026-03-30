// ============================================================
// GameEngine — Full race with difficulty + Neon + win streak
// ============================================================
//
// Phase flow:
//   select-difficulty → countdown → racing → finished
//
// Safeguards:
//   ✓ Never allows negative Neon
//   ✓ Never starts race without deducting entry
//   ✓ Never credits reward without race completion
//   ✓ Win streak: +5% reward per consecutive 1st place, resets on loss
// ============================================================

import { UpgradeManager } from './UpgradeManager';
import { UpgradeScreen } from './UpgradeScreen';
import { RankManager } from './RankManager';
import { PremiumManager } from './PremiumManager';
import { PvPStakingManager } from './PvPStakingManager';
import { PlatformReserveManager } from './PlatformReserveManager';
import { PvPSelectionScreen } from './PvPSelectionScreen';
import { RaceIntegrityManager } from './RaceIntegrityManager';
import { SoundManager } from './SoundManager';
import { HUDData } from './types';


import { TrackConfig, getTracksForDifficulty, getDefaultTrack, TRACKS } from './TrackConfig';
import { InputManager } from './InputManager';
import { PlayerController } from './PlayerController';
import { AIController } from './AIController';
import { RoadRenderer } from './RoadRenderer';
import { CarRenderer } from './CarRenderer';
import { HUDRenderer } from './HUDRenderer';
import { PreRaceScreen } from './PreRaceScreen';
import { NeonBalanceManager } from './NeonBalanceManager';
import { GarageManager, CAR_PAINTS, CAR_TRAILS } from './CarShop';
import { TrailManager } from './TrailManager';
import { LeaderboardManager } from './LeaderboardManager';
import { LeaderboardScreen } from './LeaderboardScreen';
import { SeasonManager } from './SeasonManager';
import { TournamentScreen } from './TournamentScreen';
import { Tournament } from './TournamentManager';
import { NetworkManager } from './NetworkManager';
import { NetworkController } from './NetworkController';
import { ClanManager } from './ClanManager';
import { ClanScreen } from './ClanScreen';

import { SpectatorManager } from './SpectatorManager';
import { SpectatorScreen } from './SpectatorScreen';
import { EsportsManager } from './EsportsManager';
import { EsportsScreen } from './EsportsScreen';
import { ProceduralTrackGenerator } from './ProceduralTrackGenerator';
import { TrackBuilder } from './TrackBuilder';


import {
    DifficultyTier,
    DifficultyMeta,
    DIFFICULTIES,
    DIFFICULTY_META,
    DifficultyConfig,
    calculateReward,
} from './DifficultyConfig';
import {
    SEGMENT_LENGTH,
    ROAD_WIDTH,
    PLAYER_MAX_SPEED,
    AI_CAR_COUNT,
    NITRO_SPEED_BOOST,
    TRACK_LENGTH,
    TOTAL_SEGMENTS,
} from './constants';

type GamePhase = 'select-difficulty' | 'pvp-lobby' | 'garage' | 'countdown' | 'racing' | 'finished' | 'leaderboard' | 'tournament' | 'clan' | 'spectator-lobby' | 'esports-bracket';

const WIN_STREAK_STORAGE_KEY = 'neon_win_streak';

export class GameEngine {
    private inputManager: InputManager;
    private playerController: PlayerController;
    private aiController: AIController;
    private roadRenderer: RoadRenderer;
    private carRenderer: CarRenderer;
    private hudRenderer: HUDRenderer;
    private preRaceScreen: PreRaceScreen;
    private balanceManager: NeonBalanceManager;
    private garageManager: GarageManager;
    private soundManager: SoundManager;
    private leaderboardScreen: LeaderboardScreen;
    private pvpManager: PvPStakingManager;
    private reserveManager: PlatformReserveManager;
    private pvpScreen: PvPSelectionScreen;
    private tournamentScreen: TournamentScreen;
    public networkManager: NetworkManager;
    private networkController: NetworkController;
    public isMultiplayer: boolean = false;
    private frameCounter: number = 0;

    private clanManager: ClanManager;
    private clanScreen: ClanScreen;

    private spectatorManager: SpectatorManager;
    private spectatorScreen: SpectatorScreen;
    public isSpectating: boolean = false;
    public esportsManager: EsportsManager;
    public esportsScreen: EsportsScreen;
    public trailManager: TrailManager;
    private trackBuilder: TrackBuilder;
    private proceduralGenerator: ProceduralTrackGenerator;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animFrameId: number = 0;
    private lastTime: number = 0;
    private running: boolean = false;
    private paused: boolean = false;

    // Race state
    public phase: GamePhase | 'leaderboard' = 'select-difficulty';
    private countdownTime: number = 4.0;
    private lastCountdownNumber: number = 5;
    private elapsedTime: number = 0;

    // Lap Timing
    private totalLaps: number = 3;
    private lapTimes: number[] = [];
    private lastLap: number = 0;
    private finishTime: number = 0;

    // Scoring
    private score: number = 0;
    private driftCombo: number = 0;
    private driftScoreBuffer: number = 0; // Points accumulating during a drift
    private finishPosition: number = 1;
    private finalLapFlashTimer: number = 0;
    private entryDeducted: boolean = false;       // Safeguard: entry fee taken
    private rewardCredited: boolean = false;      // Safeguard: reward given once
    private isPvP: boolean = false;

    // Difficulty + economy
    private currentTier: DifficultyTier = 'EASY';
    private currentConfig: DifficultyConfig = DIFFICULTIES.EASY;
    private currentMeta: DifficultyMeta = DIFFICULTY_META.EASY;
    private neonWon: number = 0;
    private neonLost: number = 0;
    private winStreak: number = 0;                // Consecutive 1st place wins
    private streakBonus: number = 0;              // Extra neon from streak
    private garageIndex: number = 0;

    // VFX
    private shakeTimer: number = 0;
    private shakeIntensity: number = 0;
    private nitroActive: boolean = false;
    private speedLineParticles: Array<{ x: number; y: number; angle: number; len: number; speed: number; alpha: number }> = [];
    private slipstreamActive: boolean = false;
    private slipstreamStrength: number = 0;
    private slipstreamParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    private speedBlurAlpha: number = 0;
    private currentTrack: TrackConfig = getDefaultTrack();

    private upgradeManager: UpgradeManager;
    private upgradeScreen: UpgradeScreen;
    public rankManager: RankManager;
    public premiumManager: PremiumManager;
    private integrityManager: RaceIntegrityManager;
    private walletAddress: string | null = null;

    // Result
    private garageTab: 'paint' | 'upgrades' | 'trails' | 'premium' = 'upgrades';
    private lastTabTime: number = 0;
    private rpChange: number = 0;

    // ...

    constructor() {
        this.inputManager = new InputManager();
        this.playerController = new PlayerController();
        this.aiController = new AIController();
        this.roadRenderer = new RoadRenderer();
        this.carRenderer = new CarRenderer();
        this.hudRenderer = new HUDRenderer();
        this.preRaceScreen = new PreRaceScreen();
        this.balanceManager = new NeonBalanceManager();
        this.garageManager = new GarageManager();
        this.upgradeManager = new UpgradeManager(this.balanceManager);
        this.upgradeScreen = new UpgradeScreen(this.upgradeManager, this.balanceManager);
        this.premiumManager = new PremiumManager(this.balanceManager);
        this.rankManager = new RankManager(this.premiumManager);
        this.soundManager = new SoundManager();
        this.leaderboardScreen = new LeaderboardScreen();
        this.tournamentScreen = new TournamentScreen(this, this.balanceManager);
        this.networkManager = new NetworkManager();
        this.networkController = new NetworkController(this.networkManager);
        this.integrityManager = new RaceIntegrityManager();

        this.clanManager = new ClanManager(this.balanceManager);
        this.clanScreen = new ClanScreen(this, this.clanManager);

        this.spectatorManager = new SpectatorManager(this.balanceManager);
        this.spectatorScreen = new SpectatorScreen(this, this.spectatorManager);

        this.esportsManager = new EsportsManager();
        this.esportsScreen = new EsportsScreen(this, this.esportsManager);

        this.trailManager = new TrailManager();
        this.trackBuilder = new TrackBuilder();
        this.proceduralGenerator = new ProceduralTrackGenerator();

        this.reserveManager = new PlatformReserveManager();
        this.pvpManager = new PvPStakingManager(this.balanceManager, this.reserveManager);
        this.pvpScreen = new PvPSelectionScreen(this.pvpManager);

        // Bind PvP callbacks
        this.pvpScreen.onBack = () => {
            this.phase = 'select-difficulty';
        };
        this.pvpScreen.onRoomReady = () => {
            this.startPvPRace();
        };

        // Load equipped paint
        this.carRenderer.setPaint(this.garageManager.getEquipped());
        this.winStreak = this.loadWinStreak();
    }

    init(canvas: HTMLCanvasElement, walletAddress?: string): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.inputManager.init(canvas);
        if (walletAddress) this.walletAddress = walletAddress;
        this.preRaceScreen.init(canvas);
        this.pvpScreen.init(canvas);
        this.resize();
    }

    public setWalletAddress(address: string | null): void {
        this.walletAddress = address;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.phase = 'select-difficulty';
        this.preRaceScreen.reset();
        this.preRaceScreen.winStreak = this.winStreak;
        this.loop(this.lastTime);
    }

    stop(): void {
        this.running = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    }

    resize(): void {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
        }
    }

    destroy(): void {
        this.stop();
        this.inputManager.destroy();
        this.preRaceScreen.destroy();
        this.soundManager.destroy();
    }

    // ========== Loop ==========

    private loop = (timestamp: number): void => {
        if (!this.running) return;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        if (!this.paused) {
            this.update(dt);
            if (this.phase === 'racing') {
                // Integrity Check
                if (this.playerController && this.playerController.car) {
                    this.integrityManager.update(dt, this.playerController.car);
                }
            }
        } else {
            // Still process input to unpause
            this.inputManager.update();
            const input = this.inputManager.getState();
            // Toggle pause logic handled in update() usually, but here we can check directly 
            // to unpause. 
            if ((input.pause && !this.inputManager.prevPause) || (input.keys && input.keys['KeyP'])) { // KeyP or touch pause
                this.paused = false;
                this.soundManager.playUIClick();
                // Reset prevPause to avoid re-triggering immediately
                this.inputManager.prevPause = true;
            }
            this.inputManager.prevPause = true;
        }

        // Spectator logic: override phase if race ends
        if (this.isSpectating && this.phase === 'finished') {
            // Settle bets
            // Find winner
            // Find winner
            // In AI race, we need to know who finished first. 
            // Logic: Check AI cars z position?
            // Since we dont have full race events for AI, we'll approximations
            // For now, we only settle if we saw the finish.

            // Hack: Just find the car furthest ahead
            let maxZ = 0;
            let winnerId = '0';
            this.aiController.cars.forEach((c, i) => {
                if (c.z > maxZ) {
                    maxZ = c.z;
                    winnerId = i.toString();
                }
            });
            const res = this.spectatorManager.resolveRace(winnerId);
            if (res.winnings > 0) alert(res.message);

            this.isSpectating = false;
            this.phase = 'select-difficulty';
            this.preRaceScreen.reset();
        }

        this.render();
        this.animFrameId = requestAnimationFrame(this.loop);
    };

    private update(dt: number): void {
        const input = this.inputManager.getState();

        // Toggle Pause (Touch or P key)
        // Note: For keyboard 'P', we rely on the OS auto-repeat delay or simple toggle. 
        // Ideally we'd map 'P' to a 'pause' input bit in InputManager, but this works for now.
        if ((input.pause && !this.inputManager.prevPause) || (input.keys && input.keys['KeyP'] && !this.inputManager.prevPause)) {
            this.paused = !this.paused;
            this.soundManager.playUIClick();
            // Hack: set prevPause to true so we don't toggle again immediately next frame if key is held
            this.inputManager.prevPause = true;
            return;
        }

        // --- Select difficulty ---
        if (this.phase === 'select-difficulty') {
            // Check for claim (Dev feature)
            if (this.preRaceScreen.isClaimRequested()) {
                this.soundManager.init();
                this.soundManager.playCoin();
                this.balanceManager.add(100);
                this.preRaceScreen.resetClaim();
            }

            if (this.preRaceScreen.isConfirmed()) {
                const tier = this.preRaceScreen.getSelectedTier();
                const config = DIFFICULTIES[tier];

                if (!this.balanceManager.canAfford(config.entryCost)) {
                    this.preRaceScreen.triggerInsufficientFlash();
                    return;
                }

                // Init audio on first user gesture
                this.soundManager.init();
                this.soundManager.playUIClick();

                // SAFEGUARD: Deduct before race starts
                this.balanceManager.subtract(config.entryCost);
                this.entryDeducted = true;
                this.rewardCredited = false;
                this.startRace(tier);
            }

            // G key to enter Garage
            if (input.keys && input.keys['KeyG']) {
                // Init audio if not already
                this.soundManager.init();

                this.phase = 'garage';
                this.soundManager.playUIClick();
                // Reset index to currently equipped or 0
                const current = this.garageManager.getEquippedId();
                const idx = CAR_PAINTS.findIndex(p => p.id === current);
                this.garageIndex = idx >= 0 ? idx : 0;
            }

            // V key to enter PvP
            if (input.keys && input.keys['KeyV']) {
                this.phase = 'pvp-lobby';
                this.soundManager.playUIClick();
            }

            // L key for Leaderboard
            if (input.keys && input.keys['KeyL']) {
                this.phase = 'leaderboard';
                this.soundManager.playUIClick();
                this.loadLeaderboard();
            }

            // T key for Tournament
            if (input.keys && input.keys['KeyT']) {
                this.phase = 'tournament';
                this.soundManager.playUIClick();
                this.tournamentScreen.refresh();
            }

            // C key for Clan
            if (input.keys && input.keys['KeyC']) {
                this.phase = 'clan';
                this.soundManager.playUIClick();
            }

            // S key for Spectator
            if (input.keys && input.keys['KeyS']) {
                this.spectatorScreen.init(['0', '1', '2', '3', '4', '5']);
                this.phase = 'spectator-lobby';
                this.soundManager.playUIClick();
            }
            return;
        }

        // --- PvP Lobby ---
        if (this.phase === 'pvp-lobby') {
            this.pvpScreen.handleInput(this.inputManager);
            return;
        }

        // --- Garage ---
        // --- Garage ---
        if (this.phase === 'garage') {
            // Tab Switching (Keyboard)
            if (input.keys && input.keys['Tab']) {
                const now = performance.now();
                if (now - this.lastTabTime > 300) {
                    if (this.garageTab === 'upgrades') this.garageTab = 'paint';
                    else if (this.garageTab === 'paint') this.garageTab = 'trails';
                    else if (this.garageTab === 'trails') this.garageTab = 'premium';
                    else this.garageTab = 'upgrades';

                    this.garageIndex = 0; // Reset selection
                    this.soundManager.playUIClick();
                    this.lastTabTime = now;
                }
            }

            // Tab Switching (Mouse)
            if (input.mouse && input.mouse.click && this.canvas) {
                const mx = input.mouse.x;
                const my = input.mouse.y;
                const tabW = 160;
                const tabX = this.canvas.width / 2 - tabW * 2;

                if (my < 50) {
                    // Tab 1
                    if (mx >= tabX && mx < tabX + tabW && this.garageTab !== 'upgrades') {
                        this.garageTab = 'upgrades'; this.garageIndex = 0; this.soundManager.playUIClick();
                    }
                    // Tab 2
                    else if (mx >= tabX + tabW && mx < tabX + tabW * 2 && this.garageTab !== 'paint') {
                        this.garageTab = 'paint'; this.garageIndex = 0; this.soundManager.playUIClick();
                    }
                    // Tab 3
                    else if (mx >= tabX + tabW * 2 && mx < tabX + tabW * 3 && this.garageTab !== 'trails') {
                        this.garageTab = 'trails'; this.garageIndex = 0; this.soundManager.playUIClick();
                    }
                    // Tab 4
                    else if (mx >= tabX + tabW * 3 && mx < tabX + tabW * 4 && this.garageTab !== 'premium') {
                        this.garageTab = 'premium'; this.garageIndex = 0; this.soundManager.playUIClick();
                    }
                }
            }

            if (this.garageTab === 'upgrades') {
                this.upgradeScreen.handleInput(this.inputManager);
                if (input.keys && input.keys['Escape']) { this.phase = 'select-difficulty'; this.soundManager.playUIClick(); }
            } else if (this.garageTab === 'paint') {
                // Paint Shop Logic
                if (input.left && !this.inputManager.prevLeft) {
                    this.garageIndex = (this.garageIndex - 1 + CAR_PAINTS.length) % CAR_PAINTS.length;
                    this.soundManager.playUIClick();
                    this.carRenderer.setPaint(CAR_PAINTS[this.garageIndex]);
                }
                if (input.right && !this.inputManager.prevRight) {
                    this.garageIndex = (this.garageIndex + 1) % CAR_PAINTS.length;
                    this.soundManager.playUIClick();
                    this.carRenderer.setPaint(CAR_PAINTS[this.garageIndex]);
                }
                if (input.enter && !this.inputManager.prevEnter) {
                    const paint = CAR_PAINTS[this.garageIndex];
                    if (this.garageManager.isOwned(paint.id)) {
                        this.garageManager.equip(paint.id);
                        this.soundManager.playUIClick();
                    } else {
                        const success = this.garageManager.purchase(paint.id, (cost) => this.balanceManager.subtract(cost));
                        if (success) {
                            this.soundManager.playCoin();
                            this.garageManager.equip(paint.id);
                        } else {
                            this.soundManager.playError();
                        }
                    }
                }
                if (input.keys && input.keys['Escape']) {
                    this.phase = 'select-difficulty';
                    this.carRenderer.setPaint(this.garageManager.getEquipped());
                    this.soundManager.playUIClick();
                }
            } else if (this.garageTab === 'trails') {
                // Trail Shop Logic
                // Navigation
                if (input.left && !this.inputManager.prevLeft) {
                    this.garageIndex = (this.garageIndex - 1 + CAR_TRAILS.length) % CAR_TRAILS.length;
                    this.soundManager.playUIClick();
                }
                if (input.right && !this.inputManager.prevRight) {
                    this.garageIndex = (this.garageIndex + 1) % CAR_TRAILS.length;
                    this.soundManager.playUIClick();
                }

                // Action
                if (input.enter && !this.inputManager.prevEnter) {
                    const trail = CAR_TRAILS[this.garageIndex];
                    if (this.garageManager.isTrailOwned(trail.id)) {
                        this.garageManager.equipTrail(trail.id);
                        this.soundManager.playUIClick();
                    } else {
                        const success = this.garageManager.purchaseTrail(trail.id, (cost) => this.balanceManager.subtract(cost));
                        if (success) {
                            this.soundManager.playCoin();
                            this.garageManager.equipTrail(trail.id);
                        } else {
                            this.soundManager.playError();
                        }
                    }
                }

                // Exit
                if (input.keys && input.keys['Escape']) {
                    this.phase = 'select-difficulty';
                    this.soundManager.playUIClick();
                }

            } else {
                // Premium Shop
                if ((input.left && !this.inputManager.prevLeft) || (input.right && !this.inputManager.prevRight)) {
                    this.garageIndex = this.garageIndex === 0 ? 1 : 0;
                    this.soundManager.playUIClick();
                }
                if (input.enter && !this.inputManager.prevEnter) {
                    const days = this.garageIndex === 0 ? 7 : 30;
                    const res = this.premiumManager.purchasePremium(days);
                    if (res.success) this.soundManager.playCoin();
                    else this.soundManager.playError();
                }
                if (input.keys && input.keys['Escape']) { this.phase = 'select-difficulty'; this.soundManager.playUIClick(); }
            }
            return;
        }

        // --- Leaderboard ---
        if (this.phase === 'leaderboard') {
            this.leaderboardScreen.handleInput(input);
            if (input.keys && input.keys['Escape']) {
                this.phase = 'select-difficulty';
                this.soundManager.playUIClick();
            }
            return;
        }

        // --- Tournament ---
        if (this.phase === 'tournament') {
            this.tournamentScreen.handleInput(input);
            return;
        }

        // --- Clan ---
        if (this.phase === 'clan') {
            if (input.mouse && input.mouse.click && this.canvas) {
                this.clanScreen.handleClick(input.mouse.x, input.mouse.y);
                input.mouse.click = false; // Consume click
            }
            if (input.keys && input.keys['Escape']) {
                this.phase = 'select-difficulty';
                this.soundManager.playUIClick();
            }
            return;
        }

        // --- Spectator Lobby ---
        if (this.phase === 'spectator-lobby') {
            if (input.mouse && input.mouse.click && this.canvas) {
                this.spectatorScreen.handleClick(input.mouse.x, input.mouse.y);
                input.mouse.click = false; // Consume click
            }
            if (input.keys && input.keys['Escape']) {
                this.phase = 'select-difficulty';
                this.soundManager.playUIClick();
            }
            return;
        }

        // --- Esports Bracket ---
        if (this.phase === 'esports-bracket') {
            if (input.mouse && input.mouse.click && this.canvas) {
                this.esportsScreen.handleClick(input.mouse.x, input.mouse.y);
                input.mouse.click = false; // Consume click
            }
            if (input.keys && input.keys['Escape']) {
                this.phase = 'tournament'; // Back to tournament list
                this.soundManager.playUIClick();
            }
            return;
        }

        // --- Countdown ---
        if (this.phase === 'countdown') {
            this.countdownTime -= dt;

            // Countdown beeps
            const num = Math.ceil(this.countdownTime);
            if (num !== this.lastCountdownNumber && num >= 0 && num <= 3) {
                this.soundManager.playCountdownBeep(num);
                this.lastCountdownNumber = num;
            }

            if (this.countdownTime <= 0) {
                this.phase = 'racing';
                this.soundManager.startEngine();
                this.soundManager.startSlipstreamWind();
            }
            return;
        }

        // --- Finished ---
        if (this.phase === 'finished') {
            if (input.nitro || input.up) {
                this.phase = 'select-difficulty';
                this.preRaceScreen.reset();
                this.preRaceScreen.winStreak = this.winStreak;
                this.soundManager.playUIClick();
            }
            return;
        }

        // === Racing ===
        // SAFEGUARD: Never race without entry deduction
        if (!this.entryDeducted) {
            this.phase = 'select-difficulty';
            this.preRaceScreen.reset();
            return;
        }

        this.elapsedTime += dt;
        // Nitro sound
        if (input.nitro && !this.nitroActive) this.soundManager.playNitroStart();
        this.nitroActive = input.nitro;

        // Engine pitch
        this.soundManager.updateEngine(this.playerController.car.speed / PLAYER_MAX_SPEED);

        // Slipstream wind volume
        this.soundManager.updateSlipstreamWind(this.slipstreamStrength);

        // Mute toggle (M key)
        if (input.down && input.left) {
            // Reserved for future mute key
        }

        this.detectSlipstream();
        this.playerController.update(dt, input);


        // AI / Network Update
        if (this.isMultiplayer) {
            this.networkController.update(dt, this.playerController.car.z);
            // Send Input
            this.networkManager.sendInput({
                t: Date.now(),
                i: this.frameCounter++,
                data: {
                    th: input.up ? 1 : 0,
                    b: input.down ? 1 : 0,
                    s: input.left ? -1 : (input.right ? 1 : 0),
                    n: input.nitro
                }
            });
        } else {
            this.aiController.update(dt, this.playerController.car.z);
        }

        this.checkCollisions();

        this.updateShake(dt);
        this.updateSpeedLines(dt);
        this.updateSlipstreamParticles(dt);

        this.updateSpeedBlur(dt);

        this.trailManager.update(dt);
        this.updateSpeedLines(dt);
        // Spawn player trails
        const trailStyle = this.garageManager.getEquippedTrail();
        if (trailStyle.id !== 'none' && this.playerController.car.speed > 50) {
            const p = this.playerController.car;
            // Spawn at rear wheels approximately
            const speedRatio = p.speed / PLAYER_MAX_SPEED;
            this.trailManager.spawn(p.x, p.z, speedRatio, trailStyle);
        }

        const speedRatio = this.playerController.car.speed / PLAYER_MAX_SPEED;
        if (speedRatio > 0.85) {
            this.shakeIntensity = Math.max(this.shakeIntensity, (speedRatio - 0.85) * 12);
            this.shakeTimer = Math.max(this.shakeTimer, 0.05);
        }

        if (this.finalLapFlashTimer > 0) this.finalLapFlashTimer -= dt;
        // Check for lap completion
        this.checkLapCompletion();

        // --- Drift Scoring ---
        const driftAngle = Math.abs(this.playerController.car.driftAngle || 0);
        const speedKmh = this.playerController.car.speed * 3.6;
        const DRIFT_MIN_ANGLE = 0.25; // ~15 degrees
        const DRIFT_MIN_SPEED = 50;   // km/h

        if (driftAngle > DRIFT_MIN_ANGLE && speedKmh > DRIFT_MIN_SPEED) {
            // Scoring Rate: Angle * Speed * Multiplier
            const scoreRate = driftAngle * (speedKmh / 100) * 100 * dt;
            this.driftScoreBuffer += scoreRate;
            this.driftCombo += scoreRate;

            // Visual feedback (Shake?)
            if (driftAngle > 0.5) {
                this.shakeIntensity = Math.min(this.shakeIntensity + 2 * dt, 5);
                this.shakeTimer = 0.1;
            }
        } else {
            // End of Drift
            if (this.driftScoreBuffer > 0) {
                // Bank the score
                this.score += Math.floor(this.driftScoreBuffer);
                this.driftScoreBuffer = 0;
                // Reset combo after a delay? For now instant reset on straight
                if (driftAngle < 0.1) this.driftCombo = 0;
            }
        }

        // Update input edge detection
        this.inputManager.update();
    }

    // ========== Race Start ==========

    private startRace(tier: DifficultyTier): void {
        console.log('[GameEngine] startRace called with tier:', tier);
        try {
            this.isPvP = false;
            if (!this.balanceManager.canAfford(DIFFICULTIES[tier].entryCost)) {
                console.log('[GameEngine] startRace: Insufficient funds');
                this.preRaceScreen.triggerInsufficientFlash();
                this.soundManager.playError();
                return;
            }

            // Deduct entry
            this.balanceManager.subtract(DIFFICULTIES[tier].entryCost);
            this.entryDeducted = true;
            this.rewardCredited = false;
            this.neonWon = 0;
            this.neonLost = 0;
            this.winStreak = this.loadWinStreak(); // reload
            this.rpChange = 0;

            this.score = 0;
            this.driftCombo = 0;
            this.driftScoreBuffer = 0;

            this.currentTier = tier;
            this.currentConfig = DIFFICULTIES[tier];
            this.currentMeta = DIFFICULTY_META[tier];

            // Generate Procedural Track based on Tier
            console.log('[GameEngine] Generating procedural track...');
            const proceduralSegments = this.proceduralGenerator.generate(tier);

            // 1. Build Render Data (Legacy/Visuals)
            console.log('[GameEngine] Building render data...');
            const trackData = this.trackBuilder.build(proceduralSegments);
            this.roadRenderer.setTrackData(trackData);

            // 2. Physics & Upgrades
            this.playerController.setPerformance(
                this.upgradeManager.getEngineMultiplier(),
                this.upgradeManager.getTiresMultiplier(),
                this.upgradeManager.getNitroBoostMultiplier()
            );

            // 3. Build Physics Spline (New Physics Engine)
            console.log('[GameEngine] Generating physics spline...');
            const trackSpline = this.trackBuilder.generateSpline(proceduralSegments);
            this.playerController.setTrack(trackSpline);

            // Sync Track Length
            this.trackLength = trackSpline.totalLength;
            this.roadRenderer.setTrackLength(this.trackLength);
            this.integrityManager.setTrackLength(this.trackLength);

            // VERIFICATION LOG: Track Closure
            const endP = trackSpline.points[trackSpline.points.length - 1];
            const dx = endP.x - 0;
            const dy = endP.y - 0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const endHeading = Math.atan2(-endP.dy, endP.dx);
            let hDiff = endHeading - Math.PI / 2;
            while (hDiff > Math.PI) hDiff -= Math.PI * 2;
            while (hDiff < -Math.PI) hDiff += Math.PI * 2;

            console.log(`[TrackVerification] Tier: ${tier}`);
            console.log(`[TrackVerification] Closure Error: Distance=${dist.toFixed(2)}m, Heading=${(hDiff * 180 / Math.PI).toFixed(2)} deg`);

            // Setup AI
            this.aiController.setTrackLength(this.trackLength);

            // Setup Network
            this.networkController.setTrackLength(this.trackLength);

            this.aiController.setDifficulty(this.currentConfig);
            this.aiController.reset(5); // 5 AI

            // Track setup...
            // Use metadata from procedural generation if available?
            // For now, assume procedural overrides physical properties, 
            // but we need visual themes (sky, ground colors) from a "TrackConfig".
            // Let's pick a random theme?
            const builtInTracks = getTracksForDifficulty(this.currentTier);
            const themeTrack = builtInTracks[Math.floor(Math.random() * builtInTracks.length)];
            this.currentTrack = {
                ...themeTrack,
                // Ensure name reflects procedural?
                name: themeTrack.name + " (Proc)"
            };

            this.reset();
            this.phase = 'countdown';
            this.soundManager.playExampleRaceMusic();
            console.log('[GameEngine] Race started successfully. Phase set to countdown.');

        } catch (e) {
            console.error('[GameEngine] FATAL ERROR in startRace:', e);
            // Refund?
            this.entryDeducted = false;
            this.phase = 'select-difficulty';
        }
    }

    startPvPRace(): void {
        const room = this.pvpManager.getCurrentRoom();
        if (!room) return;

        this.isPvP = true;
        this.entryDeducted = true; // Already deducted in manager
        this.rewardCredited = false;

        let tier: DifficultyTier = 'HARD';
        // Map difficulty string to Tier
        if (room.difficulty === 'EXTREME') tier = 'EXTREME';
        else if (room.difficulty === 'EASY') tier = 'EASY';

        this.currentTier = room.isRanked ? 'RANKED' : tier;
        this.currentConfig = DIFFICULTIES[tier]; // Physics difficulty
        this.currentMeta = DIFFICULTY_META[tier];

        // 1v1 Setup
        this.aiController.setDifficulty(this.currentConfig);
        this.aiController.reset(1); // 1 Opponent

        // Track - Procedural
        const proceduralSegments = this.proceduralGenerator.generate(tier);

        // 1. Render Data
        const trackData = this.trackBuilder.build(proceduralSegments);
        this.roadRenderer.setTrackData(trackData);

        // 2. Physics Spline
        const trackSpline = this.trackBuilder.generateSpline(proceduralSegments);
        this.playerController.setTrack(trackSpline);

        // Sync Track Length
        this.trackLength = trackSpline.totalLength;
        this.roadRenderer.setTrackLength(this.trackLength);
        this.integrityManager.setTrackLength(this.trackLength);

        // this.currentTrack = ... (Legacy track config ignored for geometry)

        this.reset();
        this.phase = 'countdown';
        this.soundManager.playExampleRaceMusic();
    }

    startMultiplayerRace(roomId: string): void {
        this.isMultiplayer = true;
        this.isPvP = true; // Treated as PvP for generic logic
        this.entryDeducted = true;
        this.rewardCredited = false;

        // TODO: Fetch tier from room info or packet
        const tier: DifficultyTier = 'HARD';
        this.currentTier = tier;
        this.currentConfig = DIFFICULTIES[tier];
        this.currentMeta = DIFFICULTY_META[tier];

        // Track should be synced from server, using default for now
        this.currentTrack = getDefaultTrack();

        // Join Network Room
        // The NetworkManager should already be connected/joining
        console.log(`Starting Multiplayer Race directly in Room: ${roomId}`);

        this.reset();
        this.phase = 'countdown';
        this.soundManager.playExampleRaceMusic();
    }

    public startSpectating(): void {
        this.isSpectating = true;
        this.entryDeducted = true; // No entry fee to watch
        this.rewardCredited = false;

        this.currentTier = 'HARD'; // Exciting race
        this.currentConfig = DIFFICULTIES['HARD'];
        this.currentMeta = DIFFICULTY_META['HARD'];

        // 6 AI cars (Player slot unused/hidden or reused as AI)
        // We will just use AI Controller with 6 cars and hide player render
        this.aiController.setDifficulty(this.currentConfig);
        this.aiController.reset(6);

        // Track
        const tracks = getTracksForDifficulty('HARD');
        this.currentTrack = tracks[Math.floor(Math.random() * tracks.length)];

        this.reset();
        this.phase = 'countdown';
        this.soundManager.playExampleRaceMusic();
    }

    private reset(): void {
        this.elapsedTime = 0;
        this.lastLap = 0;
        this.lapTimes = [];
        this.finishTime = 0;
        this.finalLapFlashTimer = 0;
        this.shakeTimer = 0;
        this.nitroActive = false;
        this.slipstreamActive = false;
        this.slipstreamStrength = 0;
        this.speedBlurAlpha = 0;
        this.slipstreamParticles = [];
        this.lastCountdownNumber = 5;

        // Stop any previous engine/wind sounds
        this.soundManager.stopEngine();
        this.soundManager.stopSlipstreamWind();

        this.playerController.reset();
        this.aiController.reset();
        this.initSpeedLines();
        this.integrityManager.reset();
        this.isMultiplayer = false; // Default reset


        // APPLY UPGRADES
        const engineMult = this.upgradeManager.getEngineMultiplier();
        const tiresMult = this.upgradeManager.getTiresMultiplier();
        const nitroBoost = this.upgradeManager.getNitroBoostMultiplier();

        this.playerController.setPerformance(engineMult, tiresMult, nitroBoost);
    }

    // ========== Render ==========

    private renderScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.save();
        if (this.shakeTimer > 0) {
            ctx.translate(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
        }
        ctx.clearRect(-10, -10, w + 20, h + 20);

        const player = this.playerController.car;

        let cameraZ = player.z;
        let cameraX = player.x;

        // Spectator Camera: Follow Leader
        if (this.isSpectating) {
            let leader = this.aiController.cars[0];
            let maxZ = -1;
            this.aiController.cars.forEach(c => {
                if (c.z > maxZ) {
                    maxZ = c.z;
                    leader = c;
                }
            });
            if (leader) {
                cameraZ = leader.z;
                cameraX = leader.x;
            }
        }

        // Calculate Camera Y (Height)
        // Camera Height = Ground Height + Offset
        let cameraY = 1500; // Base height

        // Get ground height at cameraZ
        // We need to access the track data from roadRenderer? 
        // Or cleaner: RoadRenderer should expose a getHeightAt(z) method?
        // For now, let's access it directly if we can, or just pass 0 if we can't easily get it yet.
        // Actually, RoadRenderer has the data. Let's make RoadRenderer.getHeightAt(z) public or access trackData.

        // Let's see if we can perform a quick lookup here
        const segIndex = Math.floor(cameraZ / SEGMENT_LENGTH) % TOTAL_SEGMENTS;
        const trackData = (this.roadRenderer as any).trackData; // Quick access or add getter
        if (trackData && trackData.height) {
            // Smooth interpolation
            // const segZ = Math.floor(cameraZ / SEGMENT_LENGTH) * SEGMENT_LENGTH;
            // const t = (cameraZ - segZ) / SEGMENT_LENGTH;
            // const h1 = trackData.height[segIndex] || 0;
            // const h2 = trackData.height[(segIndex + 1) % trackData.totalSegments] || 0;
            // const groundY = h1 + (h2 - h1) * t;

            // For now, simple stepping to match render
            const groundY = trackData.height[segIndex] || 0;
            cameraY += groundY;
        }

        this.roadRenderer.render(ctx, w, h, cameraZ, cameraX, cameraY);

        const opponents = this.isMultiplayer ? this.networkController.cars : this.aiController.cars;

        // If spectating, we might just render opponents?
        // Actually aiController has everyone?
        // In standard mode, player is separate. 
        // In spectate mode, we spawned 6 AI.
        // We should skip rendering 'player' car if spectating.

        this.carRenderer.render(ctx, w, h, opponents, this.isSpectating ? null : player, cameraZ, cameraX, this.roadRenderer);

        if (!this.isSpectating) {
            if (this.nitroActive || player.speed > PLAYER_MAX_SPEED * 0.8) this.renderSpeedLines(ctx, w, h);
            if (this.nitroActive) this.renderNitroTint(ctx, w, h);
            if (this.slipstreamStrength > 0.05) this.renderSlipstream(ctx, w, h);
            if (this.speedBlurAlpha > 0.01) this.renderSpeedBlur(ctx, w, h);
        }

        ctx.restore();
    }

    private render(): void {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.phase === 'select-difficulty') {
            ctx.clearRect(0, 0, w, h);
            this.roadRenderer.render(ctx, w, h, 0, 0, 1500);
            this.preRaceScreen.render(ctx, w, h, this.balanceManager.getBalance());
            // Hint
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '14px "Inter", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('[G] WORKSHOP | [C] CLAN | [S] SPECTATE', w - 20, 75);
            return;
        }

        if (this.phase === 'pvp-lobby') {
            this.pvpScreen.render(ctx, w, h);
            return;
        }

        // Main Race Render
        if (this.phase === 'countdown' || this.phase === 'racing' || this.phase === 'finished') {
            ctx.clearRect(0, 0, w, h);
            const p = this.playerController.car;

            // 1. Road & Environment
            this.roadRenderer.render(ctx, w, h, p.z, p.x);

            // 2. Trails (Before cars)
            this.trailManager.render(ctx, this.roadRenderer, p.z, w, h, p.x);

            // 3. Cars
            const cars = this.isMultiplayer ? this.networkController.cars : this.aiController.cars;
            this.carRenderer.render(
                ctx, w, h,
                cars,
                this.isSpectating ? null : p,
                p.z,
                p.x,
                this.roadRenderer,
                this.premiumManager.isActive()
            );

            // 4. VFX overlays
            this.renderSpeedLines(ctx, w, h);
            if (this.nitroActive) this.renderNitroTint(ctx, w, h);
        }

        if (this.phase === 'garage') {
            // Render Tab Headers
            ctx.fillStyle = '#0a0a15';
            ctx.fillRect(0, 0, w, h);

            // Tabs background bar
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, w, 50);

            const tabW = 160; // Reduced width for 4 tabs
            const tabX = w / 2 - tabW * 2;

            // Tab 1: Upgrades
            ctx.textAlign = 'center';
            ctx.font = 'bold 18px "Inter", sans-serif';
            ctx.fillStyle = this.garageTab === 'upgrades' ? '#00e5ff' : '#666';
            ctx.fillText("PERFORMANCE", tabX + tabW * 0.5, 32);
            if (this.garageTab === 'upgrades') ctx.fillRect(tabX + tabW * 0.5 - 60, 46, 120, 4);

            // Tab 2: Paint
            ctx.fillStyle = this.garageTab === 'paint' ? '#ff0055' : '#666';
            ctx.fillText("PAINT", tabX + tabW * 1.5, 32);
            if (this.garageTab === 'paint') ctx.fillRect(tabX + tabW * 1.5 - 40, 46, 80, 4);

            // Tab 3: Trails
            ctx.fillStyle = this.garageTab === 'trails' ? '#00e5ff' : '#666';
            ctx.fillText("TRAILS", tabX + tabW * 2.5, 32);
            if (this.garageTab === 'trails') ctx.fillRect(tabX + tabW * 2.5 - 40, 46, 80, 4);

            // Tab 4: Premium
            ctx.fillStyle = this.garageTab === 'premium' ? '#ffd700' : '#666';
            ctx.fillText("PREMIUM", tabX + tabW * 3.5, 32);
            if (this.garageTab === 'premium') ctx.fillRect(tabX + tabW * 3.5 - 50, 46, 100, 4);

            // Tab Hint
            ctx.font = '12px "Inter", sans-serif';
            ctx.fillStyle = '#444';
            ctx.textAlign = 'center';
            ctx.fillText("[TAB] Switch View", w / 2, 20);

            if (this.garageTab === 'upgrades') {
                this.upgradeScreen.render(ctx, w, h);
            } else if (this.garageTab === 'paint') {
                this.renderPaintShop(ctx, w, h);
            } else if (this.garageTab === 'trails') {
                this.renderTrailShop(ctx, w, h);
            } else {
                this.renderPremiumShop(ctx, w, h);
            }
            return;
        }

        if (this.phase === 'leaderboard') {
            // Draw background scene dimmed
            this.roadRenderer.render(ctx, w, h, 0, 0); // Use 0,0 for static background
            this.leaderboardScreen.render(ctx, w, h);
            return;
        }

        if (this.phase === 'tournament') {
            this.roadRenderer.render(ctx, w, h, 0, 0); // Use 0,0 for static background
            this.tournamentScreen.render(ctx, w, h);
            return;
        }

        if (this.phase === 'spectator-lobby') {
            this.roadRenderer.render(ctx, w, h, 0, 0);
            this.spectatorScreen.render(ctx, w, h);
            return;
        }

        if (this.phase === 'clan') {
            this.clanScreen.render(ctx, w, h);
            return;
        }

        if (this.phase === 'esports-bracket') {
            this.esportsScreen.render(ctx, w, h);
            return;
        }

        if (this.paused) {
            // Draw background scene static
            this.renderScene(ctx, w, h);

            // Dim
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, w, h);

            ctx.font = 'bold 48px "Inter", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00e5ff';
            ctx.fillText('PAUSED', w / 2, h / 2);
            ctx.shadowBlur = 0;

            ctx.font = '24px "Inter", sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText('Tap Pause button to resume', w / 2, h / 2 + 50);

            // Draw HUD still (for pause button)
            const hudData = this.getHUDData();
            this.hudRenderer.render(ctx, w, h, hudData, this.inputManager);
            return;
        }

        this.renderScene(ctx, w, h);
        ctx.restore();

        if (this.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, w, h);

            ctx.font = 'bold 48px "Inter", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00e5ff';
            ctx.fillText('PAUSED', w / 2, h / 2);
            ctx.shadowBlur = 0;

            ctx.font = '24px "Inter", sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText('Tap Pause button to resume', w / 2, h / 2 + 50);
        }

        const hudData = this.getHUDData();
        this.hudRenderer.render(ctx, w, h, hudData, this.inputManager);
        this.renderProgressBar(ctx, w, h);
        if (this.slipstreamActive) this.renderSlipstreamIndicator(ctx, w, h);
        if (this.phase === 'racing') this.renderDifficultyBadge(ctx, w);
        if (this.finalLapFlashTimer > 0) this.renderFinalLapFlash(ctx, w, h);
        if (this.phase === 'countdown') this.renderCountdown(ctx, w, h);
        else if (this.phase === 'finished') this.renderResults(ctx, w, h);
    }

    // ========== Paint Shop Render ==========

    private renderPaintShop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        // Background (Partial, below tabs)
        // ctx.fillStyle = '#050510';
        // ctx.fillRect(0, 50, w, h - 50); 
        // Actually, the main render loop clears/fills background in 'garage' phase block.
        // We just render content here.

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00e5ff';
        ctx.fillText('NEON GARAGE', w / 2, 90); // Moved down
        ctx.shadowBlur = 0;

        // Balance
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.balanceManager.getBalance()} 💎`, w - 40, 60);

        // Preview Selected Car (Center)
        // We'll draw it large
        ctx.save();
        ctx.translate(w / 2, h * 0.4);
        ctx.scale(2.5, 2.5);
        this.carRenderer.drawPlayerGTCar(ctx, 0, 0, {
            ...this.playerController.car,
            x: 0,
            speed: 0,
            steerOffset: 0
        }, this.premiumManager.isActive());
        ctx.restore();

        // Selected Paint Info
        const paint = CAR_PAINTS[this.garageIndex];
        const owned = this.garageManager.isOwned(paint.id);
        const equipped = this.garageManager.getEquippedId() === paint.id;

        ctx.textAlign = 'center';
        ctx.font = 'bold 28px "Inter", sans-serif';
        ctx.fillStyle = paint.bodyColor;
        ctx.fillText(`${paint.emoji} ${paint.name}`, w / 2, h * 0.6);

        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(paint.description, w / 2, h * 0.6 + 30);

        // Action Prompt
        const canAfford = this.balanceManager.canAfford(paint.unlockCost);
        ctx.font = 'bold 20px "Inter", sans-serif';
        if (equipped) {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('✅ EQUIPPED', w / 2, h * 0.75);
        } else if (owned) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('PRESS [ENTER] TO EQUIP', w / 2, h * 0.75);
        } else {
            if (canAfford) {
                ctx.fillStyle = '#ffff00';
                ctx.fillText(`PRESS [ENTER] TO BUY (${paint.unlockCost} 💎)`, w / 2, h * 0.75);
            } else {
                ctx.fillStyle = '#ff4444';
                ctx.fillText(`LOCKED (COST: ${paint.unlockCost} 💎)`, w / 2, h * 0.75);
            }
        }

        // Paint Grid (Bottom)
        const gridW = 50;
        const gridGap = 10;
        const totalW = CAR_PAINTS.length * (gridW + gridGap) - gridGap;
        const startX = (w - totalW) / 2;
        const gy = h - 100;

        for (let i = 0; i < CAR_PAINTS.length; i++) {
            const p = CAR_PAINTS[i];
            const x = startX + i * (gridW + gridGap);
            const isSel = i === this.garageIndex;
            const isOwned = this.garageManager.isOwned(p.id);

            // Box
            ctx.fillStyle = p.bodyColor;
            ctx.globalAlpha = isOwned ? 1.0 : 0.3;
            ctx.fillRect(x, gy, gridW, gridW);
            ctx.globalAlpha = 1.0;

            // Selection Highlight
            if (isSel) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 2, gy - 2, gridW + 4, gridW + 4);
            }

            // Lock icon
            if (!isOwned) {
                ctx.fillStyle = '#000000';
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔒', x + gridW / 2, gy + gridW / 2 + 7);
            }
        }

        // Instructions
        ctx.fillStyle = '#888';
        ctx.font = '16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("← / → Select   |   ENTER to Buy/Equip   |   ESC Back", w / 2, h - 50);
    }

    // ========== Trail Shop Render ==========

    private renderTrailShop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff';
        ctx.fillText('NEON TRAILS', w / 2, 90);
        ctx.shadowBlur = 0;

        // Balance
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(this.balanceManager.getBalance())} 💎`, w - 40, 60);

        // Preview (Center - Player Car with Trail)
        // We'll draw the car and the selected trail
        ctx.save();
        ctx.translate(w / 2, h * 0.4);
        ctx.scale(2.0, 2.0);

        // Render Trail Preview (fake movement)
        const trail = CAR_TRAILS[this.garageIndex];
        // Just draw a static representation of the trail behind the car
        if (trail.id !== 'none') {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = trail.color;
            ctx.shadowBlur = 10; ctx.shadowColor = trail.color;
            // Draw 2 lines
            ctx.fillRect(-15, 40, 5, 40);
            ctx.fillRect(10, 40, 5, 40);
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Draw Car (Top down)
        this.carRenderer.drawPlayerGTCar(ctx, 0, 0, {
            ...this.playerController.car,
            x: 0,
            speed: 100, // Simulate speed for effects
            steerOffset: 0
        }, this.premiumManager.isActive());
        ctx.restore();

        // Selected Trail Info
        const owned = this.garageManager.isTrailOwned(trail.id);
        const equipped = this.garageManager.getEquippedTrailId() === trail.id;

        ctx.textAlign = 'center';
        ctx.font = 'bold 28px "Inter", sans-serif';
        ctx.fillStyle = trail.color;
        ctx.fillText(`${trail.emoji} ${trail.name}`, w / 2, h * 0.6);

        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(trail.description, w / 2, h * 0.6 + 30);

        // Action Prompt
        const canAfford = this.balanceManager.canAfford(trail.unlockCost);
        ctx.font = 'bold 20px "Inter", sans-serif';
        if (equipped) {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('✅ EQUIPPED', w / 2, h * 0.75);
        } else if (owned) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('PRESS [ENTER] TO EQUIP', w / 2, h * 0.75);
        } else {
            if (canAfford) {
                ctx.fillStyle = '#ffff00';
                ctx.fillText(`PRESS [ENTER] TO BUY (${trail.unlockCost} 💎)`, w / 2, h * 0.75);
            } else {
                ctx.fillStyle = '#ff4444';
                ctx.fillText(`LOCKED (COST: ${trail.unlockCost} 💎)`, w / 2, h * 0.75);
            }
        }

        // Instructions
        ctx.fillStyle = '#888';
        ctx.font = '16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("← / → Select   |   ENTER to Buy/Equip   |   ESC Back", w / 2, h - 50);
    }


    private renderPremiumShop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const cx = w / 2;

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#ffd700'; // Gold
        ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700';
        ctx.fillText('PREMIUM MEMBERSHIP', cx, 90);
        ctx.shadowBlur = 0;

        // Balance
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(this.balanceManager.getBalance())} 💎`, w - 40, 60);

        // Status
        const isActive = this.premiumManager.isActive();
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = isActive ? '#00ff00' : '#888';
        ctx.fillText(`STATUS: ${isActive ? 'ACTIVE' : 'INACTIVE'}`, cx, 140);

        if (isActive) {
            ctx.font = '16px "Inter", sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.fillText(`Expires in: ${this.premiumManager.getTimeRemaining()}`, cx, 165);
        }

        // Feature List
        const features = [
            "🏆 +10% Rank Points per Race",
            "💎 +20% Neon Earnings (All Sources)",
            "✨ Exclusive Gold Nameplate",
            "🎨 Support Development"
        ];

        let fy = 220;
        ctx.textAlign = 'left';
        ctx.font = '20px "Inter", sans-serif';
        ctx.fillStyle = '#fff';

        features.forEach(f => {
            ctx.fillText(f, cx - 150, fy);
            fy += 35;
        });

        // Purchasing Options (Cards)
        const optY = 400;
        const optW = 220;
        const optH = 180;
        const gap = 40;
        const startX = cx - optW - gap / 2;

        // Option 1: 7 Days
        this.renderPremiumCard(ctx, startX, optY, optW, optH, "7 DAYS", 1000, this.garageIndex === 0);

        // Option 2: 30 Days
        this.renderPremiumCard(ctx, startX + optW + gap, optY, optW, optH, "30 DAYS", 3500, this.garageIndex === 1);

        // Instructions
        ctx.fillStyle = '#888';
        ctx.font = '16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("← / → Select   |   ENTER to Buy   |   ESC Back", cx, h - 50);
    }

    private renderPremiumCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, cost: number, isSelected: boolean) {
        ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.2)' : 'rgba(20, 20, 20, 0.8)';
        ctx.strokeStyle = isSelected ? '#ffd700' : '#444';
        ctx.lineWidth = isSelected ? 3 : 1;

        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillText(title, x + w / 2, y + 50);

        ctx.font = 'bold 28px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${cost} 💎`, x + w / 2, y + 100);

        if (isSelected) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillText("SELECTED", x + w / 2, y + 150);
        }
    }


    private renderDifficultyBadge(ctx: CanvasRenderingContext2D, _w: number): void {
        ctx.save();
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillStyle = this.currentMeta.color;
        ctx.textAlign = 'left';
        ctx.fillText(`${this.currentMeta.emoji} ${this.currentMeta.label}`, 20, 135);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(`${this.currentTrack.emoji} ${this.currentTrack.name}`, 20, 150);
        if (this.winStreak > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`🔥 ×${this.winStreak}`, 20, 165);
        }
        ctx.restore();
    }

    // ========== Countdown ==========

    private renderCountdown(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);

        const n = Math.ceil(this.countdownTime);
        let text: string, color: string, fontSize: number;

        if (n >= 4) { text = 'GET READY'; color = '#ffffff'; fontSize = Math.min(48, w * 0.06); }
        else if (n > 0) { text = String(n); color = n === 1 ? '#ff4444' : n === 2 ? '#ffaa00' : '#00e5ff'; fontSize = Math.min(120, w * 0.12); }
        else { text = 'GO!'; color = '#00ff88'; fontSize = Math.min(100, w * 0.1); }

        const pulse = 1 + Math.sin(this.countdownTime * Math.PI * 4) * 0.1;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(pulse, pulse);
        ctx.shadowBlur = 30; ctx.shadowColor = color;
        ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.font = `bold ${Math.min(18, w * 0.02)}px "Inter", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('↑ Accelerate  ← → Steer  ↓ Brake  SPACE Nitro', w / 2, h / 2 + 80);

        ctx.font = `bold ${Math.min(22, w * 0.025)}px "Inter", sans-serif`;
        ctx.fillStyle = this.currentMeta.color;
        ctx.fillText(`${this.currentMeta.emoji} ${this.currentMeta.label} — Entry: ${this.currentConfig.entryCost} 💎`, w / 2, h / 2 + 115);
    }

    // ========== Progress Bar ==========

    private renderProgressBar(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
        if (this.phase !== 'racing') return;
        const bW = w * 0.3, bH = 8, bX = (w - bW) / 2, bY = 12;

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bX, bY, bW, bH);

        const progress = Math.min(this.playerController.car.z / (TRACK_LENGTH * this.totalLaps), 1);
        const g = ctx.createLinearGradient(bX, 0, bX + bW, 0);
        g.addColorStop(0, '#00e5ff'); g.addColorStop(1, '#00ff88');
        ctx.fillStyle = g;
        ctx.fillRect(bX, bY, bW * progress, bH);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 1; i < this.totalLaps; i++) {
            const mx = bX + (i / this.totalLaps) * bW;
            ctx.fillRect(mx - 1, bY - 2, 2, bH + 4);
        }

        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(progress * 100)}%`, bX + bW / 2, bY + bH + 14);
    }

    // ========== Results (Neon + Win Streak) ==========

    private renderResults(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        let y = h * 0.08;

        ctx.shadowBlur = 20; ctx.shadowColor = '#00e5ff';
        ctx.font = `bold ${Math.min(44, w * 0.05)}px "Inter", sans-serif`;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('RACE COMPLETE', cx, y);
        ctx.shadowBlur = 0;

        y += 50;

        const posColor = this.finishPosition === 1 ? '#ffd700' : this.finishPosition === 2 ? '#c0c0c0' : this.finishPosition === 3 ? '#cd7f32' : '#ffffff';
        ctx.font = `bold ${Math.min(64, w * 0.065)}px "Inter", sans-serif`;
        ctx.fillStyle = posColor;
        ctx.shadowBlur = 15; ctx.shadowColor = posColor;
        ctx.fillText(this.ordinal(this.finishPosition), cx, y);
        ctx.shadowBlur = 0;

        y += 30;
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillStyle = this.currentMeta.color;
        ctx.fillText(`${this.currentMeta.emoji} ${this.currentMeta.label} Mode`, cx, y);

        y += 40;

        // Results Box (Ranked or Neon)
        if (this.currentTier === 'RANKED') {
            const bxW = Math.min(360, w * 0.5);
            const bxH = 140;
            const bxX = cx - bxW / 2;

            // Box style (Purple/Gold)
            ctx.fillStyle = 'rgba(100, 0, 255, 0.1)';
            ctx.strokeStyle = 'rgba(160, 50, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(bxX, y - 8, bxW, bxH, 8); ctx.fill(); ctx.stroke();

            let row = y + 25;

            const rankInfo = this.rankManager.getRankInfo();

            // Rank Icon + Name
            ctx.font = 'bold 24px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = rankInfo.color;
            ctx.fillText(`${rankInfo.icon} ${rankInfo.tier} `, cx, row);

            row += 35;

            // Current RP
            ctx.font = 'bold 36px "Inter", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(`${rankInfo.rp} RP`, cx, row);

            row += 35;

            // Change
            const sign = this.rpChange >= 0 ? '+' : '';
            const changeColor = this.rpChange > 0 ? '#00ff88' : this.rpChange < 0 ? '#ff4444' : '#aaa';
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.fillStyle = changeColor;
            ctx.fillText(`${sign}${this.rpChange} RP`, cx, row);

            y += bxH + 18;
        } else {
            // Neon results box
            const bxW = Math.min(300, w * 0.42);
            const bxH = this.streakBonus > 0 ? 130 : 105;
            const bxX = cx - bxW / 2;
            ctx.fillStyle = 'rgba(0,229,255,0.07)';
            ctx.strokeStyle = 'rgba(0,229,255,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bxX, y - 8, bxW, bxH, 8);
            ctx.fill(); ctx.stroke();

            let row = y + 18;

            // Entry cost
            ctx.font = 'bold 14px "Inter", sans-serif';
            ctx.textAlign = 'left'; ctx.fillStyle = '#888';
            ctx.fillText('Entry Cost:', bxX + 15, row);
            ctx.textAlign = 'right'; ctx.fillStyle = '#ff6666';
            ctx.fillText(`- ${this.neonLost} 💎`, bxX + bxW - 15, row);
            row += 25;

            // Base reward
            ctx.textAlign = 'left'; ctx.fillStyle = '#888';
            ctx.fillText('Reward:', bxX + 15, row);
            ctx.textAlign = 'right';
            ctx.fillStyle = this.neonWon > 0 ? '#00ff88' : '#ff6666';
            ctx.fillText(this.neonWon > 0 ? `+ ${this.neonWon} 💎` : '0 💎', bxX + bxW - 15, row);
            row += 25;

            // Streak bonus (if any)
            if (this.streakBonus > 0) {
                ctx.textAlign = 'left'; ctx.fillStyle = '#ffd700';
                ctx.fillText(`🔥 Streak Bonus(×${this.winStreak}): `, bxX + 15, row);
                ctx.textAlign = 'right';
                ctx.fillText(`+ ${this.streakBonus} 💎`, bxX + bxW - 15, row);
                row += 25;
            }

            // Net line
            const net = (this.neonWon + this.streakBonus) - this.neonLost;
            ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillText('Net:', bxX + 15, row);
            ctx.textAlign = 'right';
            ctx.fillStyle = net >= 0 ? '#00ff88' : '#ff4444';
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.fillText(`${net >= 0 ? '+' : ''}${net} 💎`, bxX + bxW - 15, row);

            y += bxH + 18;

            // New balance
            ctx.font = 'bold 22px "Inter", sans-serif';
            ctx.fillStyle = '#00e5ff'; ctx.textAlign = 'center';
            ctx.fillText(`Balance: ${Math.floor(this.balanceManager.getBalance())} 💎`, cx, y);
        }

        y += 35;

        // Time
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.formatTime(this.finishTime), cx, y);
        y += 18;
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('TOTAL TIME', cx, y);

        y += 25;
        ctx.font = 'bold 14px "Inter", sans-serif';
        const bestLap = this.lapTimes.length > 0 ? Math.min(...this.lapTimes) : 0;
        for (let i = 0; i < this.lapTimes.length; i++) {
            const isBest = this.lapTimes[i] === bestLap;
            ctx.fillStyle = isBest ? '#00ff88' : '#aaa';
            ctx.fillText(`${isBest ? '★ ' : ''}Lap ${i + 1}: ${this.formatTime(this.lapTimes[i])} `, cx, y);
            y += 20;
        }

        // Win streak info
        if (this.winStreak > 0 && this.finishPosition === 1) {
            y += 8;
            ctx.font = 'bold 15px "Inter", sans-serif';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`🔥 ${this.winStreak} Win Streak — +${this.winStreak * 5}% next race`, cx, y);
        }

        // Restart
        ctx.font = 'bold 18px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        if (Math.sin(Date.now() * 0.005) > 0) {
            ctx.fillText('Press ↑ or SPACE to continue', cx, h * 0.94);
        }
    }

    // ========== Slipstream ==========

    private detectSlipstream(): void {
        const player = this.playerController.car;
        let best = 0; let found = false;

        for (const ai of this.aiController.cars) {
            const dz = ai.z - player.z;
            if (dz < SEGMENT_LENGTH * 2 || dz > SEGMENT_LENGTH * 25) continue;
            if (Math.abs(ai.x - player.x) > 0.35) continue;
            const s = 1 - (dz - SEGMENT_LENGTH * 2) / (SEGMENT_LENGTH * 23);
            if (s > best) { best = s; found = true; }
        }

        this.slipstreamActive = found;
        this.slipstreamStrength += ((found ? best : 0) - this.slipstreamStrength) * 0.1;
        this.playerController.inSlipstream = found;
        this.playerController.slipstreamStrength = this.slipstreamStrength;

        if (found && this.canvas) {
            for (let i = 0; i < 2; i++) {
                this.slipstreamParticles.push({
                    x: this.canvas.width / 2 + (Math.random() - 0.5) * 40,
                    y: this.canvas.height * 0.7 + Math.random() * 50,
                    vx: (Math.random() - 0.5) * 30,
                    vy: -50 - Math.random() * 80,
                    life: 0.5 + Math.random() * 0.5,
                });
            }
        }
    }

    private updateSlipstreamParticles(dt: number): void {
        for (let i = this.slipstreamParticles.length - 1; i >= 0; i--) {
            const p = this.slipstreamParticles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life <= 0) this.slipstreamParticles.splice(i, 1);
        }
        if (this.slipstreamParticles.length > 50) this.slipstreamParticles.splice(0, this.slipstreamParticles.length - 50);
    }

    private renderSlipstream(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.save();
        ctx.globalAlpha = this.slipstreamStrength * 0.4;
        const g = ctx.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.5, w * 0.5);
        g.addColorStop(0, 'rgba(0,200,255,0.15)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(150,230,255,0.6)';
        for (const p of this.slipstreamParticles) {
            ctx.globalAlpha = Math.max(0, p.life / 0.75) * this.slipstreamStrength;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    private renderSlipstreamIndicator(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
        ctx.save();
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillStyle = `rgba(0, 200, 255, ${0.7 + Math.sin(Date.now() * 0.008) * 0.3})`;
        ctx.shadowBlur = 10; ctx.shadowColor = '#00c8ff';
        ctx.textAlign = 'center';
        ctx.fillText('💨 SLIPSTREAM', w / 2, 45);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ========== Speed Blur ==========

    private updateSpeedBlur(dt: number): void {
        const r = this.playerController.car.speed / PLAYER_MAX_SPEED;
        this.speedBlurAlpha += ((r > 0.75 ? (r - 0.75) * 0.6 : 0) - this.speedBlurAlpha) * 3 * dt;
    }

    private renderSpeedBlur(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const g = ctx.createRadialGradient(w / 2, h * 0.6, w * 0.15, w / 2, h * 0.5, w * 0.65);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.6, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(10, 15, 30, ${this.speedBlurAlpha})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        if (this.speedBlurAlpha > 0.03) {
            ctx.strokeStyle = `rgba(100, 150, 200, ${this.speedBlurAlpha * 0.3})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(w / 2 + Math.cos(a) * w * 0.45, h * 0.5 + Math.sin(a) * w * 0.45);
                ctx.lineTo(w / 2 + Math.cos(a) * w * 0.7, h * 0.5 + Math.sin(a) * w * 0.7);
                ctx.stroke();
            }
        }
    }

    // ========== Final Lap Flash ==========

    private renderFinalLapFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.save();
        ctx.font = `bold ${Math.min(72, w * 0.07)}px "Inter", sans - serif`;
        ctx.fillStyle = `rgba(255, 68, 68, ${Math.min(this.finalLapFlashTimer / 2, 0.8)})`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff4444';
        ctx.fillText('FINAL LAP!', w / 2, h * 0.35);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ========== VFX ==========

    private triggerShake(i: number, d: number): void {
        this.shakeIntensity = Math.max(this.shakeIntensity, i);
        this.shakeTimer = Math.max(this.shakeTimer, d);
    }

    private updateShake(dt: number): void {
        if (this.shakeTimer > 0) { this.shakeTimer -= dt; if (this.shakeTimer <= 0) { this.shakeTimer = 0; this.shakeIntensity = 0; } }
    }

    private initSpeedLines(): void {
        this.speedLineParticles = [];
        for (let i = 0; i < 60; i++) {
            this.spawnSpeedLineParticle(true);
        }
    }

    private spawnSpeedLineParticle(randomPos: boolean = false) {
        // Spawn around center
        const angle = Math.random() * Math.PI * 2;
        // Start near center (0.5, 0.4) usually horizon
        // If randomPos (init), dist can be anywhere 0..1
        // If respawn, dist is small (0.1) so they emerge from center
        const dist = randomPos ? Math.random() : 0.05 + Math.random() * 0.1;

        const cx = 0.5;
        const cy = 0.4; // Slightly above center matches horizon

        this.speedLineParticles.push({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            angle: angle,
            speed: 0.5 + Math.random() * 1.5, // Reduced speed multiplier, we'll scale in update
            len: 0.05 + Math.random() * 0.1,
            alpha: 0.2 + Math.random() * 0.5
        });
    }

    private updateSpeedLines(dt: number): void {
        // Scale speed by player speed? 20m segments = 400 speed unit ~ 80m/s
        // Let's make it fast.
        const speedMult = 2.0;

        for (let i = this.speedLineParticles.length - 1; i >= 0; i--) {
            const p = this.speedLineParticles[i];

            p.x += Math.cos(p.angle) * p.speed * speedMult * dt;
            p.y += Math.sin(p.angle) * p.speed * speedMult * dt;

            // Grow length as it moves out
            p.len += dt * 0.5;

            // Check bounds (0..1)
            // If off screen, respawn
            if (p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) {
                this.speedLineParticles.splice(i, 1);
                this.spawnSpeedLineParticle(false);
            }
        }
    }

    private renderSpeedLines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const pSpeed = this.playerController.car.speed;
        const maxSpeed = PLAYER_MAX_SPEED;

        // Intensity based on speed (start showing at 50% max speed)
        let intensity = 0;
        if (this.nitroActive) intensity = 1.0;
        else if (pSpeed > maxSpeed * 0.5) {
            intensity = (pSpeed - maxSpeed * 0.5) / (maxSpeed * 0.5);
        }

        if (intensity <= 0.01) return;

        ctx.lineWidth = 2;
        // White/Cyan streaks

        for (const p of this.speedLineParticles) {
            // Calculate tail
            const tailX = p.x * w;
            const tailY = p.y * h;

            // Calculate head (outward)
            const headX = tailX + Math.cos(p.angle) * p.len * 100 * intensity;
            const headY = tailY + Math.sin(p.angle) * p.len * 100 * intensity;

            const alpha = p.alpha * intensity * 0.8;

            const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(1, `rgba(200, 255, 255, ${alpha})`);

            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.stroke();
        }
    }

    private renderNitroTint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.7);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,180,255,0.15)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,229,255,0.06)';
        ctx.fillRect(0, 0, 35, h);
        ctx.fillRect(w - 35, 0, 35, h);
    }

    // ========== Collisions ==========

    private checkCollisions(): void {
        const p = this.playerController.car;
        const px = p.x * ROAD_WIDTH, pw = p.width * ROAD_WIDTH;

        for (const ai of this.aiController.cars) {
            const dz = Math.abs(ai.z - p.z);
            if (dz > SEGMENT_LENGTH * 2) continue;
            const dx = Math.abs(px - ai.x * ROAD_WIDTH);
            if (dx < (pw + ai.width * ROAD_WIDTH) * 0.8 && dz < SEGMENT_LENGTH) {
                this.playerController.applyCollision();
                ai.braking = true;
                this.triggerShake(10, 0.35);
                this.soundManager.playCollision();
                p.x += p.x < ai.x ? -0.05 : 0.05;
            }
        }
    }

    // ========== Lap Tracking + Race End ==========

    private trackLength: number = TRACK_LENGTH;

    // ...

    private checkLapCompletion(): void {
        const playerZ = this.playerController.car.z;
        const currentLap = Math.floor(playerZ / this.trackLength) + 1;

        if (currentLap > this.lastLap + 1 && this.lastLap > 0) {
            const lapTime = this.elapsedTime - this.lapTimes.reduce((a, b) => a + b, 0);
            this.lapTimes.push(lapTime);
            this.soundManager.playLapComplete();
            if (currentLap === this.totalLaps) this.finalLapFlashTimer = 3.0;
        }
        this.lastLap = currentLap - 1;

        // SAFEGUARD: Only credit reward once, only after race completion
        if (currentLap > this.totalLaps && !this.rewardCredited) {
            if (this.lapTimes.length < this.totalLaps) {
                this.lapTimes.push(this.elapsedTime - this.lapTimes.reduce((a, b) => a + b, 0));
            }
            this.finishTime = this.elapsedTime;
            this.finishPosition = this.aiController.getPlayerPosition(playerZ);
            this.phase = 'finished';
            this.rewardCredited = true;

            // Stop racing sounds, play fanfare
            this.soundManager.stopEngine();
            this.soundManager.stopSlipstreamWind();
            this.soundManager.playFinishFanfare();

            const report = this.integrityManager.getReport();
            let isValid = report.isValid;
            if (isValid && !this.integrityManager.validateLap(this.finishTime)) {
                console.warn("Lap validation failed: Impossible time");
                isValid = false;
            }
            if (!isValid) console.warn("Run Flagged as Invalid by Anti-Cheat:", report.violations);

            if (this.isPvP) {
                const won = this.finishPosition === 1;
                const result = this.pvpManager.resolveRace(won && isValid);
                if (won && isValid) {
                    this.neonWon = result.prize;
                    // Premium Bonus
                    if (this.premiumManager.isActive()) {
                        this.neonWon = Math.floor(this.neonWon * 1.2);
                    }
                }
                else this.neonLost = this.pvpManager.getCurrentRoom()?.stake || 0;

                if (this.currentTier === 'RANKED') {
                    const stake = this.pvpManager.getCurrentRoom()?.stake || 0;
                    if (stake >= 50) {
                        const change = (won && isValid) ? 40 : -10;
                        this.rankManager.addRP(change);
                        this.rpChange = change;
                    }
                }
            } else {
                const baseReward = calculateReward(this.finishPosition, this.currentTier);
                this.neonWon = isValid ? baseReward : 0;

                // Premium Bonus
                if (this.neonWon > 0 && this.premiumManager.isActive()) {
                    this.neonWon = Math.floor(this.neonWon * 1.2);
                }

                if (this.currentTier === 'RANKED' && isValid) {
                    const { change } = this.rankManager.processRaceResult(this.finishPosition);
                    this.rpChange = change;
                } else {
                    this.rpChange = 0;
                }

                if (this.finishPosition === 1 && isValid) {
                    this.streakBonus = Math.floor(baseReward * this.winStreak * 0.05);
                    this.winStreak++;
                } else {
                    this.streakBonus = 0;
                    this.winStreak = 0;
                }
                this.saveWinStreak();

                if (this.neonWon + this.streakBonus > 0) this.balanceManager.add(this.neonWon + this.streakBonus);
            }

            if (isValid && this.walletAddress) {
                LeaderboardManager.submitScore(this.walletAddress, this.currentTrack.id, this.currentTier, this.finishTime * 1000);
            }

            // RECORD GLOBAL STATS
            if (isValid) {
                const season = SeasonManager.getCurrentSeason();
                const pid = this.walletAddress || 'Guest'; // Simple Guest ID for non-connected
                LeaderboardManager.recordRaceCompletion(
                    pid,
                    this.finishPosition === 1,
                    this.balanceManager.getBalance(),
                    this.rankManager.getRP(),
                    season.seasonId
                );
            }
        }
    }

    // ========== HUD ==========

    private getHUDData(): HUDData {
        const p = this.playerController.car;
        const totalRacers = this.isMultiplayer ? this.networkController.cars.length + 1 : AI_CAR_COUNT + 1;
        const position = this.isMultiplayer ? this.networkController.getPlayerPosition(p.z) : this.aiController.getPlayerPosition(p.z);

        return {
            position,
            totalRacers,
            lap: Math.min(Math.floor(p.z / TRACK_LENGTH) + 1, this.totalLaps),
            totalLaps: this.totalLaps,
            speed: (p.speed / (PLAYER_MAX_SPEED + NITRO_SPEED_BOOST)) * 450,
            timer: this.elapsedTime,
            nitroAmount: this.nitroActive ? 1 : 0,
            score: Math.floor(this.score + this.driftScoreBuffer),
            driftCombo: Math.floor(this.driftCombo)
        };
    }

    // ========== Win Streak Persistence ==========

    private loadWinStreak(): number {
        try {
            const v = localStorage.getItem(WIN_STREAK_STORAGE_KEY);
            if (v !== null) { const n = parseInt(v); if (!isNaN(n) && n >= 0) return n; }
        } catch { /* */ }
        return 0;
    }

    private saveWinStreak(): void {
        try { localStorage.setItem(WIN_STREAK_STORAGE_KEY, String(this.winStreak)); } catch { /* */ }
    }

    // ========== Helpers ==========

    private formatTime(s: number): string {
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')} `;
    }

    private ordinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    private loadLeaderboard() {
        this.leaderboardScreen.setLoading(true);
        LeaderboardManager.getTopScores(this.currentTrack.id, this.currentTier, 10).then(scores => {
            this.leaderboardScreen.setScores(scores, this.currentTrack.name, this.currentTier);
        });
    }

    showLeaderboard() {
        this.phase = 'leaderboard';
        this.leaderboardScreen.setLoading(true);
        this.leaderboardScreen.setScores([], this.currentTrack.name, this.currentTier);

        LeaderboardManager.getTopScores(this.currentTrack.id, this.currentTier)
            .then(scores => {
                this.leaderboardScreen.setScores(scores, this.currentTrack.name, this.currentTier);
            });
    }

    showTournamentScreen() {
        this.phase = 'tournament';
        this.tournamentScreen.refresh();
    }

    startTournamentRace(t: Tournament) {
        // Configure Race
        this.currentTier = t.difficulty;
        this.currentConfig = DIFFICULTIES[t.difficulty];
        this.currentMeta = DIFFICULTY_META[t.difficulty];

        // Find Track
        this.currentTrack = TRACKS[t.trackId];
        if (!this.currentTrack) {
            console.error(`Track with ID ${t.trackId} not found for tournament.`);
            this.phase = 'select-difficulty'; // Fallback
            return;
        }

        // Setup AI
        this.aiController.setDifficulty(this.currentConfig);
        this.aiController.reset(5); // Standard AI count for now

        this.reset();
        this.phase = 'countdown';
        this.soundManager.playExampleRaceMusic();
    }
}
