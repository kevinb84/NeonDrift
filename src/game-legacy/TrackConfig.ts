// ============================================================
// TrackConfig — Themed track definitions
// ============================================================
//
// Each track has:
//   - Visual theme (sky, road, grass, rumble colors)
//   - Curve pattern (amplitude + frequency)
//   - Hill pattern (future)
//   - Name, description
//   - Difficulty compatibility
// ============================================================

import { DifficultyTier } from './DifficultyConfig';

export interface TrackTheme {
    skyTop: string;
    skyBottom: string;
    roadLight: string;
    roadDark: string;
    grassLight: string;
    grassDark: string;
    rumbleLight: string;
    rumbleDark: string;
    laneMarker: string;
    fogColor: string;
    sunColor: string;
    buildingColors: string[];
    sidewalkLight: string;
    sidewalkDark: string;
}

export interface TrackCurve {
    amplitude: number;    // How sharp the curves are (pixels offset)
    frequency: number;    // How often curves appear
    secondaryAmp: number; // Secondary wobble
    secondaryFreq: number;
}

export interface TrackConfig {
    id: string;
    name: string;
    emoji: string;
    description: string;
    theme: TrackTheme;
    curve: TrackCurve;
    hillIntensity: number; // 0-1, visual hill effect strength
    availableDifficulties: DifficultyTier[];
}

// ========== Track Definitions ==========

export const TRACKS: Record<string, TrackConfig> = {

    // --- Neon City: Classic urban racing ---
    neon_city: {
        id: 'neon_city',
        name: 'Neon City',
        emoji: '🌃',
        description: 'Neon-lit city streets. Smooth turns.',
        theme: {
            skyTop: '#1a0a2e',
            skyBottom: '#16213e',
            roadLight: '#6b6b6b',
            roadDark: '#636363',
            grassLight: '#10aa10',
            grassDark: '#009a00',
            rumbleLight: '#ff0000',
            rumbleDark: '#ffffff',
            laneMarker: '#cccccc',
            fogColor: 'rgba(10, 10, 30, 0.8)',
            sunColor: '#ff6600',
            buildingColors: ['#2a1a3e', '#1e3a5f', '#3a1a2e', '#1a2a4e', '#2e2a1a', '#1a3e2a'],
            sidewalkLight: '#2a2a40',
            sidewalkDark: '#202030',
        },
        curve: {
            amplitude: 30,
            frequency: 0.02,
            secondaryAmp: 12,
            secondaryFreq: 0.05,
        },
        hillIntensity: 0.3,
        availableDifficulties: ['EASY', 'HARD', 'EXTREME'],
    },

    // --- Sunset Canyon: Desert with sweeping curves ---
    sunset_canyon: {
        id: 'sunset_canyon',
        name: 'Sunset Canyon',
        emoji: '🏜️',
        description: 'Sweeping desert curves. Watch the cliffs.',
        theme: {
            skyTop: '#ff6b35',
            skyBottom: '#ffa62b',
            roadLight: '#8b7355',
            roadDark: '#7a6248',
            grassLight: '#c4a35a',
            grassDark: '#b89048',
            rumbleLight: '#ff4500',
            rumbleDark: '#ffd700',
            laneMarker: '#e0d4a0',
            fogColor: 'rgba(50, 30, 10, 0.5)',
            sunColor: '#ff3300',
            buildingColors: ['#8b4513', '#a0522d', '#cd853f', '#deb887', '#d2691e', '#b8860b'],
            sidewalkLight: '#c4a35a',
            sidewalkDark: '#b89048',
        },
        curve: {
            amplitude: 55,
            frequency: 0.015,
            secondaryAmp: 20,
            secondaryFreq: 0.04,
        },
        hillIntensity: 0.7,
        availableDifficulties: ['HARD', 'EXTREME'],
    },

    // --- Midnight Storm: Rain-soaked with tight turns ---
    midnight_storm: {
        id: 'midnight_storm',
        name: 'Midnight Storm',
        emoji: '⛈️',
        description: 'Rain-soaked track. Tight turns. Low visibility.',
        theme: {
            skyTop: '#0a0a15',
            skyBottom: '#1a1a2e',
            roadLight: '#4a4a52',
            roadDark: '#424248',
            grassLight: '#1a3a1a',
            grassDark: '#143014',
            rumbleLight: '#ff2222',
            rumbleDark: '#cccccc',
            laneMarker: '#888888',
            fogColor: 'rgba(15, 15, 25, 0.9)',
            sunColor: '#6666aa',
            buildingColors: ['#151525', '#1a1a30', '#202035', '#0f0f20', '#181828', '#121222'],
            sidewalkLight: '#2a2a40',
            sidewalkDark: '#202030',
        },
        curve: {
            amplitude: 45,
            frequency: 0.035,
            secondaryAmp: 25,
            secondaryFreq: 0.08,
        },
        hillIntensity: 0.5,
        availableDifficulties: ['EXTREME'],
    },
};

// ========== Helpers ==========

export const TRACK_ORDER: string[] = ['neon_city', 'sunset_canyon', 'midnight_storm'];

export function getTracksForDifficulty(tier: DifficultyTier): TrackConfig[] {
    return TRACK_ORDER
        .map(id => TRACKS[id])
        .filter(t => t.availableDifficulties.includes(tier));
}

export function getDefaultTrack(): TrackConfig {
    return TRACKS['neon_city'];
}
