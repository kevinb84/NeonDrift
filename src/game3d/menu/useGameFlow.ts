import { useState, useCallback } from 'react';

export type GamePhase = 'title' | 'mode-select' | 'ranked-lobby' | 'car-select' | 'track-select' | 'difficulty' | 'racing' | 'finished';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type EnvType = 'city' | 'desert' | 'tunnel';
export type MatchType = 'practice' | 'ranked';

export interface MatchConfig {
    type: MatchType;
    stake: number;
    seed: number;
    matchId?: string;
}

export interface CarConfig {
    id: string;
    name: string;
    color: string;
    glowColor: string;
    topSpeed: number;    // 1-10
    handling: number;    // 1-10
    nitro: number;       // 1-10
    /** Multiplier applied to BASE_SPEED/MAX_SPEED in GameScene */
    speedMult: number;
    steerMult: number;
}

export interface TrackConfig {
    id: string;
    name: string;
    description: string;
    envType: EnvType;
    fogColor: string;
    bgColor: string;
    accentColor: string;
    curvature: {
        amplitude: number;
        frequency: number;
    };
    aiDifficultyScale: number;
    lighting: {
        hemisphere: [string, string, number];
        ambient: [string, number];
        directional1: [number, number, number, number, string]; // x, y, z, intensity, color
        directional2: [number, number, number, number, string];
    };
}

export const CARS: CarConfig[] = [
    {
        id: 'phantom',
        name: 'PHANTOM',
        color: '#0d0d1a',
        glowColor: '#00ffff',
        topSpeed: 7,
        handling: 8,
        nitro: 7,
        speedMult: 1.0,
        steerMult: 1.0,
    },
    {
        id: 'spectre',
        name: 'SPECTRE',
        color: '#1a001a',
        glowColor: '#ff00ff',
        topSpeed: 9,
        handling: 5,
        nitro: 9,
        speedMult: 1.2,
        steerMult: 0.85,
    },
    {
        id: 'titan',
        name: 'TITAN',
        color: '#0a0a00',
        glowColor: '#ffaa00',
        topSpeed: 5,
        handling: 10,
        nitro: 5,
        speedMult: 0.85,
        steerMult: 1.2,
    },
];

export const TRACKS: TrackConfig[] = [
    {
        id: 'neon-city',
        name: 'NEON CITY',
        description: 'Blaze through the high-density skyscrapers of the future.',
        envType: 'city',
        fogColor: '#150e2a',
        bgColor: '#0a0818',
        accentColor: '#00ffff',
        curvature: { amplitude: 30, frequency: 0.0005 }, // Moderate curves
        aiDifficultyScale: 1.0,
        lighting: {
            hemisphere: ['#8866dd', '#2a2a44', 1.8],
            ambient: ['#443366', 1.2],
            directional1: [10, 50, 20, 1.5, '#aaaaff'],
            directional2: [-10, 40, -20, 0.8, '#7777bb'],
        }
    },
    {
        id: 'desert-highway',
        name: 'DESERT HIGHWAY',
        description: 'A relentless straightaway through the scorched synthwave dunes.',
        envType: 'desert',
        fogColor: '#2a1a0e',
        bgColor: '#1a0f08',
        accentColor: '#ffaa00',
        curvature: { amplitude: 15, frequency: 0.0002 }, // Very long straights
        aiDifficultyScale: 0.85, // Easier AI
        lighting: {
            hemisphere: ['#ff8844', '#2a1100', 1.5],
            ambient: ['#aa5522', 1.0],
            directional1: [15, 30, 40, 2.0, '#ffaa44'], // Sunset-like highlight
            directional2: [-20, 10, -50, 0.5, '#aa3300'],
        }
    },
    {
        id: 'neon-tunnel',
        name: 'NEON TUNNEL',
        description: 'Claustrophobic speed in an enclosed tube of light.',
        envType: 'tunnel',
        fogColor: '#050505',
        bgColor: '#010101',
        accentColor: '#ff00ff',
        curvature: { amplitude: 50, frequency: 0.001 }, // Sharp, fast curves
        aiDifficultyScale: 1.15, // Harder AI
        lighting: {
            hemisphere: ['#220044', '#000000', 0.5], // Very dark ambient
            ambient: ['#110022', 0.3],
            directional1: [0, 10, 10, 0.5, '#ff00ff'], // Mostly rely on emissive lights in the tunnel
            directional2: [0, 5, -20, 0.5, '#00ffff'],
        }
    },
];

export const DIFFICULTY_CONFIG: Record<Difficulty, { aiSpeedMult: number; label: string; desc: string; color: string }> = {
    easy: { aiSpeedMult: 0.75, label: 'EASY', color: '#00ff88', desc: 'AI opponents run at 75% speed. Great for learning the track.' },
    medium: { aiSpeedMult: 1.0, label: 'MEDIUM', color: '#ffaa00', desc: 'Balanced competition. AI matches your base pace closely.' },
    hard: { aiSpeedMult: 1.3, label: 'HARD', color: '#ff3333', desc: 'Aggressive AI. You\'ll need every drop of nitro to win.' },
};

export interface GameFlowState {
    phase: GamePhase;
    selectedCar: CarConfig;
    selectedTrack: TrackConfig;
    difficulty: Difficulty;
    raceStats: { position: number; raceTime: number; bestLapTime: number; previousBest: number | null; isNewPb: boolean } | null;
    matchConfig: MatchConfig | null;
}

export function useGameFlow() {
    const [state, setState] = useState<GameFlowState>({
        phase: 'title',
        selectedCar: CARS[0],
        selectedTrack: TRACKS[0],
        difficulty: 'medium',
        raceStats: null,
        matchConfig: null,
    });

    const goToCarSelect = useCallback(() => setState(s => ({ ...s, phase: 'car-select' })), []);
    const goToTitle = useCallback(() => setState(s => ({ ...s, phase: 'title', raceStats: null, matchConfig: null })), []);
    const goToModeSelect = useCallback(() => setState(s => ({ ...s, phase: 'mode-select' })), []);
    const goToRankedLobby = useCallback(() => setState(s => ({ ...s, phase: 'ranked-lobby' })), []);

    const selectMode = useCallback((type: MatchType, stake: number = 0) => {
        const seed = Math.floor(Math.random() * 1000000);
        setState(s => ({
            ...s,
            phase: 'car-select',
            matchConfig: { type, stake, seed }
        }));
    }, []);

    const startRankedMatch = useCallback((matchId: string, stake: number = 0) => {
        let seed = 12345;
        try {
            let hash = 0;
            for (let i = 0; i < matchId.length; i++) {
                hash = Math.imul(31, hash) + matchId.charCodeAt(i) | 0;
            }
            seed = Math.abs(hash);
        } catch(e) {}
        
        setState(s => ({
            ...s,
            phase: 'car-select',
            matchConfig: { type: 'ranked', stake, seed, matchId }
        }));
    }, []);

    const selectCar = useCallback((car: CarConfig) => setState(s => ({ ...s, selectedCar: car })), []);
    const goToTrackSelect = useCallback(() => setState(s => ({ ...s, phase: 'track-select' })), []);
    const selectTrack = useCallback((track: TrackConfig) => setState(s => ({ ...s, selectedTrack: track })), []);
    const goToDifficulty = useCallback(() => setState(s => ({ ...s, phase: 'difficulty' })), []);
    const selectDifficulty = useCallback((d: Difficulty) => setState(s => ({ ...s, difficulty: d })), []);
    const startRace = useCallback(() => setState(s => ({ ...s, phase: 'racing' })), []);
    const restartRace = useCallback(() => setState(s => ({ ...s, phase: 'racing', raceStats: null })), []);
    const finishRace = useCallback((stats: { position: number; raceTime: number; bestLapTime: number; previousBest: number | null; isNewPb: boolean }) =>
        setState(s => ({ ...s, phase: 'finished', raceStats: stats })), []);

    return {
        state,
        goToCarSelect,
        goToTitle,
        goToModeSelect,
        goToRankedLobby,
        selectMode,
        startRankedMatch,
        selectCar,
        goToTrackSelect,
        selectTrack,
        goToDifficulty,
        selectDifficulty,
        startRace,
        restartRace,
        finishRace,
    };
}

