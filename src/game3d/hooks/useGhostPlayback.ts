import { useRef, useCallback, useState } from 'react';
import { insforge } from '../../lib/insforge';
import type { ReplayData } from './useGhostRecorder';

export interface GhostState {
    x: number;
    speed: number;
    totalDist: number;
    nitro: boolean;
    finished: boolean;
}

/**
 * Loads a ghost replay from InsForge Storage and provides
 * per-frame interpolated state to render a ghost car.
 */
export function useGhostPlayback() {
    const [replayData, setReplayData] = useState<ReplayData | null>(null);
    const [loading, setLoading] = useState(false);
    const currentFrameIdx = useRef(0);

    const loadReplay = useCallback(async (filePath: string) => {
        setLoading(true);
        try {
            const { data, error } = await insforge.storage.from('replays').download(filePath);
            if (error || !data) {
                console.error('[Ghost] Failed to download replay:', error);
                setLoading(false);
                return false;
            }
            const text = await data.text();
            const parsed = JSON.parse(text) as ReplayData;
            setReplayData(parsed);
            currentFrameIdx.current = 0;
            setLoading(false);
            return true;
        } catch (e) {
            console.error('[Ghost] Error loading replay:', e);
            setLoading(false);
            return false;
        }
    }, []);

    const loadReplayFromData = useCallback((data: ReplayData) => {
        setReplayData(data);
        currentFrameIdx.current = 0;
    }, []);

    const resetPlayback = useCallback(() => {
        currentFrameIdx.current = 0;
    }, []);

    /**
     * Given the current race time in ms, returns a perfectly interpolated
     * ghost position between recorded frames.
     */
    const getGhostState = useCallback((raceTimeMs: number): GhostState | null => {
        if (!replayData || replayData.frames.length === 0) return null;

        const frames = replayData.frames;

        // Find the two adjacent frames that bracket the current time
        let idx = currentFrameIdx.current;

        // Fast-forward idx if needed (don't go backwards for perf)
        while (idx < frames.length - 1 && frames[idx + 1].time <= raceTimeMs) {
            idx++;
        }
        currentFrameIdx.current = idx;

        // If past the last frame, ghost is finished
        if (idx >= frames.length - 1) {
            const last = frames[frames.length - 1];
            return {
                x: last.x,
                speed: last.speed,
                totalDist: last.totalDist,
                nitro: last.nitro,
                finished: true,
            };
        }

        const a = frames[idx];
        const b = frames[idx + 1];
        const range = b.time - a.time;
        const t = range > 0 ? (raceTimeMs - a.time) / range : 0;

        return {
            x: a.x + (b.x - a.x) * t,
            speed: a.speed + (b.speed - a.speed) * t,
            totalDist: a.totalDist + (b.totalDist - a.totalDist) * t,
            nitro: t > 0.5 ? b.nitro : a.nitro,
            finished: false,
        };
    }, [replayData]);

    return {
        loadReplay,
        loadReplayFromData,
        resetPlayback,
        getGhostState,
        replayData,
        loading,
    };
}
