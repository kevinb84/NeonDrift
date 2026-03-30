import { useEffect, useRef, useState } from 'react';

/**
 * useGameAudio handles loading and playing background music and dynamic engine sounds.
 * It expects music.mp3 and engine.mp3 to be placed in the public/audio/ directory.
 * If the files don't exist yet, it safely creates a Web Audio synthesizer fallback for the engine!
 */
export function useGameAudio() {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const oscRef = useRef<OscillatorNode | null>(null);
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    
    // Synth engine state
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize audio system
    const initAudio = () => {
        if (isInitialized) return;

        // 1. Setup Background Music
        const music = new Audio('/audio/music.mp3');
        music.loop = true;
        music.volume = 0.3; 
        music.play().catch(() => console.log('Music file not found yet. Drop music.mp3 in public/audio/'));
        musicAudioRef.current = music;

        // 2. Setup Web Audio API for dynamic engine sound
        const ctx = new window.AudioContext();
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40, ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.Q.setValueAtTime(5, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();

        oscRef.current = osc;
        filterRef.current = filter;
        engineGainRef.current = gain;

        setIsInitialized(true);
    };

    // Fast update function designed to be called in useFrame or rAF
    const updateAudio = (speed: number, isRacing: boolean) => {
        if (!isInitialized || !audioCtxRef.current || !oscRef.current || !filterRef.current || !engineGainRef.current) return;

        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;

        if (isRacing) {
            // Fade in engine sound when racing starts
            engineGainRef.current.gain.setTargetAtTime(0.15, now, 0.1);

            // Modulate engine pitch
            const maxSpeed = 150;
            const normalizedSpeed = Math.min(Math.abs(speed), maxSpeed) / maxSpeed;
            
            const targetFreq = 40 + (normalizedSpeed * 80);
            oscRef.current.frequency.setTargetAtTime(targetFreq, now, 0.1);

            const targetFilterFreq = 200 + (normalizedSpeed * 1800);
            filterRef.current.frequency.setTargetAtTime(targetFilterFreq, now, 0.1);
        } else {
            // Fade out when not racing
            engineGainRef.current.gain.setTargetAtTime(0, now, 0.5);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (musicAudioRef.current) {
                musicAudioRef.current.pause();
                musicAudioRef.current.src = '';
            }
            if (oscRef.current) {
                oscRef.current.stop();
                oscRef.current.disconnect();
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    return { initAudio, updateAudio, isInitialized };
}
