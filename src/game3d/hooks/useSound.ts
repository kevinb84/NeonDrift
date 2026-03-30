import { useRef, useCallback, useEffect } from 'react';

/** Procedural sound effects using Web Audio API — no external files needed */
export function useSound() {
    const ctxRef = useRef<AudioContext | null>(null);
    const engineOscRef = useRef<OscillatorNode | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);
    const started = useRef(false);

    // Lazy-init audio context (requires user gesture)
    const ensureCtx = useCallback(() => {
        if (!ctxRef.current) {
            ctxRef.current = new AudioContext();
        }
        if (ctxRef.current.state === 'suspended') {
            ctxRef.current.resume();
        }
        return ctxRef.current;
    }, []);

    // Start engine drone
    const startEngine = useCallback(() => {
        if (started.current) return;
        const ctx = ensureCtx();

        // Low-frequency engine hum
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;

        const gain = ctx.createGain();
        gain.gain.value = 0.06;

        // Low-pass filter for warmth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        engineOscRef.current = osc;
        engineGainRef.current = gain;
        started.current = true;
    }, [ensureCtx]);

    // Update engine pitch based on speed
    const updateEngine = useCallback((speed: number) => {
        if (!engineOscRef.current || !engineGainRef.current) return;
        // Map speed 0-80 → frequency 40-120 Hz
        const freq = 40 + (speed / 80) * 80;
        engineOscRef.current.frequency.setTargetAtTime(freq, 0, 0.1);
        // Volume scales slightly with speed
        const vol = 0.04 + (speed / 80) * 0.06;
        engineGainRef.current.gain.setTargetAtTime(vol, 0, 0.1);
    }, []);

    // Collision impact
    const playCollision = useCallback(() => {
        const ctx = ensureCtx();

        // White noise burst
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        // Low-pass for more thud-like sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
    }, [ensureCtx]);

    // Countdown beep
    const playBeep = useCallback((high = false) => {
        const ctx = ensureCtx();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = high ? 880 : 440;

        const gain = ctx.createGain();
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    }, [ensureCtx]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (engineOscRef.current) {
                engineOscRef.current.stop();
            }
            if (ctxRef.current) {
                ctxRef.current.close();
            }
        };
    }, []);

    return { startEngine, updateEngine, playCollision, playBeep };
}
