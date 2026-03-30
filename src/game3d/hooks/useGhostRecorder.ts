import { useRef, useCallback } from 'react';
import { insforge } from '../../lib/insforge';

export interface ReplayFrame {
    time: number;
    x: number;
    speed: number;
    nitro: boolean;
    totalDist: number;
}

export interface ReplayData {
    trackId: string;
    carId: string;
    wallet: string;
    totalTime: number;
    frames: ReplayFrame[];
    timestamp: number;
}

const RECORD_INTERVAL = 100; // ms between frames
const MAX_FRAMES = 1800; // Max 3 mins at 10Hz

export function useGhostRecorder() {
    const framesRef = useRef<ReplayFrame[]>([]);
    const lastRecordRef = useRef(0);
    const isRecordingRef = useRef(false);

    const startRecording = useCallback(() => {
        framesRef.current = [];
        lastRecordRef.current = 0;
        isRecordingRef.current = true;
    }, []);

    const recordFrame = useCallback((time: number, x: number, speed: number, nitro: boolean, totalDist: number) => {
        if (!isRecordingRef.current) return;
        if (framesRef.current.length >= MAX_FRAMES) return;

        if (time - lastRecordRef.current >= RECORD_INTERVAL) {
            framesRef.current.push({
                time,
                x,
                speed,
                nitro,
                totalDist
            });
            lastRecordRef.current = time;
        }
    }, []);

    const saveReplay = useCallback(async (trackId: string, carId: string, wallet: string, totalTime: number) => {
        if (!isRecordingRef.current || framesRef.current.length === 0) return null;
        isRecordingRef.current = false;

        const replayData: ReplayData = {
            trackId,
            carId,
            wallet,
            totalTime,
            frames: framesRef.current,
            timestamp: Date.now()
        };

        const jsonStr = JSON.stringify(replayData);
        // Create a unique file name. Format: track_id/totalTimeMs-wallet.json
        // e.g., neon-city/085450-4EaB...json
        const fileName = `${trackId}/${Math.floor(totalTime)}-${wallet}-${Date.now()}.json`;

        const blob = new Blob([jsonStr], { type: 'application/json' });

        try {
            const { error } = await insforge.storage.from('replays').upload(fileName, blob);
            if (error) {
                console.error("Failed to upload ghost replay:", error);
                return null;
            }
            return fileName;
        } catch (e) {
            console.error("Error saving ghost replay:", e);
            return null;
        }
    }, []);

    return {
        startRecording,
        recordFrame,
        saveReplay
    };
}
