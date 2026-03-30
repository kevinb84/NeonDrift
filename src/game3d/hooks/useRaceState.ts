import { useRef, useCallback } from 'react';

export interface RaceState {
    phase: 'countdown' | 'racing' | 'finished';
    countdown: number;        // 3, 2, 1, 0 (go)
    lap: number;
    totalLaps: number;
    raceTime: number;         // ms elapsed
    position: number;         // 1-5
    bestLapTime: number;
    lastLapTime: number;
    collisionFlash: number;   // 0-1, decays over time
    speed: number;
}

const INITIAL_STATE: RaceState = {
    phase: 'countdown',
    countdown: 3,
    lap: 1,
    totalLaps: 3,
    raceTime: 0,
    position: 1,
    bestLapTime: Infinity,
    lastLapTime: 0,
    collisionFlash: 0,
    speed: 0,
};

/** Central race state manager */
export function useRaceState() {
    const state = useRef<RaceState>({ ...INITIAL_STATE });
    const startTime = useRef(0);
    const lapStartTime = useRef(0);
    const countdownTimer = useRef(0);
    const countdownStarted = useRef(false);

    const update = useCallback((dt: number) => {
        const s = state.current;

        // Decay collision flash
        if (s.collisionFlash > 0) {
            s.collisionFlash = Math.max(0, s.collisionFlash - dt * 3);
        }

        if (s.phase === 'countdown') {
            if (!countdownStarted.current) {
                countdownTimer.current = 3;
                countdownStarted.current = true;
            }
            countdownTimer.current -= dt;
            s.countdown = Math.ceil(countdownTimer.current);

            if (countdownTimer.current <= 0) {
                s.phase = 'racing';
                s.countdown = 0;
                startTime.current = Date.now();
                lapStartTime.current = Date.now();
            }
        }

        if (s.phase === 'racing') {
            s.raceTime = Date.now() - startTime.current;
        }
    }, []);

    const triggerCollision = useCallback(() => {
        state.current.collisionFlash = 1;
    }, []);

    const completeLap = useCallback(() => {
        const s = state.current;
        if (s.phase !== 'racing') return;

        const lapTime = Date.now() - lapStartTime.current;
        s.lastLapTime = lapTime;
        if (lapTime < s.bestLapTime) s.bestLapTime = lapTime;

        if (s.lap >= s.totalLaps) {
            s.phase = 'finished';
        } else {
            s.lap++;
            lapStartTime.current = Date.now();
        }
    }, []);

    const restart = useCallback(() => {
        Object.assign(state.current, { ...INITIAL_STATE });
        countdownStarted.current = false;
    }, []);

    const setPosition = useCallback((pos: number) => {
        state.current.position = pos;
    }, []);

    return { state, update, triggerCollision, completeLap, restart, setPosition };
}
