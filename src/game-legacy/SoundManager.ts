// ============================================================
// SoundManager — Web Audio API synthesized racing sounds
// ============================================================
//
// All sounds are generated procedurally — no audio files needed.
//
// Sounds:
//   🔊 Engine hum (continuous oscillator, pitch = speed)
//   💥 Collision (noise burst + low thud)
//   ⏱️ Countdown beeps (3,2,1 = beep, GO = fanfare)
//   🚀 Nitro whoosh (filtered noise sweep)
//   🏁 Finish fanfare (ascending melody)
//   🖱️ UI click (short tick)
//   💨 Slipstream wind (filtered noise)
// ============================================================

export class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private engineOsc: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private windNode: AudioBufferSourceNode | null = null;
    private windGain: GainNode | null = null;
    private muted: boolean = false;
    private initialized: boolean = false;
    private volume: number = 0.3;

    /** Must be called from user gesture (click/keydown) */
    init(): void {
        if (this.initialized) return;
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch {
            // Web Audio not supported
        }
    }

    /** Ensure AudioContext is resumed (browser autoplay policy) */
    private resume(): void {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ========== Volume ==========

    setVolume(v: number): void {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
    }

    toggleMute(): boolean {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
        return this.muted;
    }

    isMuted(): boolean {
        return this.muted;
    }

    // ========== Engine Sound ==========

    startEngine(): void {
        if (!this.ctx || !this.masterGain || this.engineOsc) return;
        this.resume();

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.masterGain);

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;

        // Add slight detune for richness
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.value = 61;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.15;
        osc2.connect(g2);
        g2.connect(this.engineGain);
        osc2.start();

        // Low-pass filter for warmth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 2;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineOsc.start();
    }

    /** Update engine pitch + volume based on speed ratio (0-1) */
    updateEngine(speedRatio: number): void {
        if (!this.engineOsc || !this.engineGain || !this.ctx) return;

        // Pitch: 60Hz idle → 220Hz at max
        const freq = 60 + speedRatio * 160;
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);

        // Volume: quiet at low speed, louder at high
        const vol = 0.05 + speedRatio * 0.2;
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }

    stopEngine(): void {
        try {
            this.engineOsc?.stop();
        } catch { /* */ }
        this.engineOsc = null;
        this.engineGain = null;
    }

    // ========== Countdown Beep ==========

    playCountdownBeep(number: number): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        const freq = number > 0 ? 440 : 880; // Higher for GO!
        const duration = number > 0 ? 0.15 : 0.3;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // ========== Collision ==========

    playCollision(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        // Low thud
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);

        // Noise burst
        this.playNoiseBurst(0.08, 0.3);
    }

    // ========== Nitro ==========

    playNitroStart(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        // Rising pitch sweep
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.3);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 3;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    // ========== Finish Fanfare ==========

    playFinishFanfare(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        // Ascending notes: C5 E5 G5 C6
        const notes = [523, 659, 784, 1047];
        const t = this.ctx.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = this.ctx!.createGain();
            const start = t + i * 0.15;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    // ========== UI Click ==========

    playUIClick(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playError(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playExampleRaceMusic(): void {
        // Placeholder
    }

    // ========== Slipstream Wind ==========

    startSlipstreamWind(): void {
        if (!this.ctx || !this.masterGain || this.windNode) return;
        this.resume();

        // Create noise buffer
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = buffer;
        this.windNode.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 500;
        filter.Q.value = 1.5;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        this.windNode.connect(filter);
        filter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        this.windNode.start();
    }

    updateSlipstreamWind(strength: number): void {
        if (!this.windGain || !this.ctx) return;
        this.windGain.gain.setTargetAtTime(strength * 0.15, this.ctx.currentTime, 0.1);
    }

    stopSlipstreamWind(): void {
        try { this.windNode?.stop(); } catch { /* */ }
        this.windNode = null;
        this.windGain = null;
    }

    // ========== Lap Complete ==========

    playLapComplete(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        // Two quick ascending beeps
        const t = this.ctx.currentTime;
        [660, 880].forEach((f, i) => {
            const osc = this.ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(0.25, t + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.15);
            osc.connect(g);
            g.connect(this.masterGain!);
            osc.start(t + i * 0.1);
            osc.stop(t + i * 0.1 + 0.15);
        });
    }

    // ========== Helpers ==========

    private playNoiseBurst(duration: number, volume: number): void {
        if (!this.ctx || !this.masterGain) return;

        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }

    // ========== Cleanup ==========

    // Purchase coin sound
    playCoin(): void {
        if (!this.ctx || !this.masterGain) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, t);
        osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    destroy(): void {
        this.stopEngine();
        this.stopSlipstreamWind();
        try { this.ctx?.close(); } catch { /* */ }
        this.ctx = null;
        this.initialized = false;
    }
}
