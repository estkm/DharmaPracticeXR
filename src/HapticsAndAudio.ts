/**
 * Web Audio API procedural synthesis for Tibetan singing bowls and prayer wheel sounds,
 * plus WebXR / Web Vibration API haptics.
 */

export class HapticsAndAudio {
  private audioCtx: AudioContext | null = null;
  private bearingGain: GainNode | null = null;
  private bearingOsc: OscillatorNode | null = null;
  private isAudioUnlocked = false;

  // Ambient Tibetan Singing Bowl & Om Mani Chanting Nodes
  private ambientMasterGain: GainNode | null = null;
  private ambientChantGain: GainNode | null = null;
  private ambientBowlGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private formantFilters: BiquadFilterNode[] = [];
  private chantSchedulerTimer: number | null = null;
  private nextSyllableTime = 0;
  private currentSyllableIdx = 0;

  constructor() {
    this.initAudioUnlock();
  }

  private initAudioUnlock() {
    const unlock = () => {
      this.ensureAudioContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  ensureAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (this.audioCtx && !this.bearingGain) {
      this.setupBearingSound();
      this.setupAmbientChantTrack();
    }
    this.isAudioUnlocked = true;
    return this.audioCtx;
  }

  private setupBearingSound() {
    if (!this.audioCtx) return;
    try {
      // Create continuous subtle whirr for prayer wheel spindle rotation
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, this.audioCtx.currentTime);
      filter.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      this.bearingOsc = osc;
      this.bearingGain = gain;
    } catch (e) {
      console.warn('Could not setup bearing audio:', e);
    }
  }

  updateBearingSpeed(angularSpeed: number, enabled: boolean) {
    if (!this.audioCtx || !this.bearingGain || !this.bearingOsc || !enabled) {
      if (this.bearingGain && this.audioCtx) {
        this.bearingGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
      }
      return;
    }

    const absSpeed = Math.abs(angularSpeed);
    const targetGain = absSpeed > 0.2 ? Math.min(0.06, absSpeed * 0.008) : 0;
    const targetFreq = Math.min(600, 100 + absSpeed * 25);

    const now = this.audioCtx.currentTime;
    this.bearingGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.bearingOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
  }

  /**
   * Sets up procedural Tibetan singing bowl drone and monastic Om Mani vocal chanting track.
   */
  private setupAmbientChantTrack() {
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;

      // 1. Ambient Master Gain (silent until wheel spins)
      this.ambientMasterGain = ctx.createGain();
      this.ambientMasterGain.gain.setValueAtTime(0, ctx.currentTime);

      // Temple acoustic space (stereo delay & feedback for monastic cathedral warmth)
      const delayL = ctx.createDelay();
      delayL.delayTime.value = 0.34;
      const delayR = ctx.createDelay();
      delayR.delayTime.value = 0.51;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 1600;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.35;

      this.ambientMasterGain.connect(ctx.destination);
      this.ambientMasterGain.connect(delayL);
      delayL.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delayL);
      delayFeedback.connect(delayR);
      delayR.connect(ctx.destination);

      // 2. Singing Bowl Resonant Drone (108Hz, 216Hz, 324Hz, 432Hz, 864Hz)
      const bowlBus = ctx.createGain();
      bowlBus.gain.setValueAtTime(0.55, ctx.currentTime);
      this.ambientBowlGain = bowlBus;
      bowlBus.connect(this.ambientMasterGain);

      const bowlPartials = [
        { freq: 108, gain: 0.22, type: 'sine' as OscillatorType }, // Sacred Om base
        { freq: 216, gain: 0.16, type: 'sine' as OscillatorType },
        { freq: 324, gain: 0.09, type: 'sine' as OscillatorType },
        { freq: 432, gain: 0.12, type: 'sine' as OscillatorType }, // Cosmic 432Hz
        { freq: 864, gain: 0.04, type: 'triangle' as OscillatorType },
      ];

      // Slow LFO for singing bowl rim friction pulsing (0.16 Hz ~ 6.2s period)
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.16;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain);
      lfo.start();
      this.ambientOscs.push(lfo);

      bowlPartials.forEach((p) => {
        const osc = ctx.createOscillator();
        const pGain = ctx.createGain();
        osc.type = p.type;
        osc.frequency.setValueAtTime(p.freq, ctx.currentTime);
        pGain.gain.setValueAtTime(p.gain, ctx.currentTime);

        lfoGain.connect(pGain.gain);
        osc.connect(pGain);
        pGain.connect(bowlBus);

        osc.start();
        this.ambientOscs.push(osc);
      });

      // 3. Om Mani Padme Hum Monastic Vocal Chanting Engine
      const chantBus = ctx.createGain();
      chantBus.gain.setValueAtTime(0.45, ctx.currentTime);
      this.ambientChantGain = chantBus;
      chantBus.connect(this.ambientMasterGain);

      // Deep harmonic vocal source (Tibetan monk throat drone)
      const monkOsc1 = ctx.createOscillator();
      monkOsc1.type = 'sawtooth';
      monkOsc1.frequency.setValueAtTime(108, ctx.currentTime);

      const monkOsc2 = ctx.createOscillator();
      monkOsc2.type = 'sawtooth';
      monkOsc2.frequency.setValueAtTime(108.35, ctx.currentTime); // Chorus beating

      const subOsc = ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(54, ctx.currentTime); // Deep undertone

      // Breath noise component
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.03;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1100;
      noiseFilter.Q.value = 1.8;
      noiseSource.connect(noiseFilter);
      noiseSource.start();

      const vocalPreGain = ctx.createGain();
      vocalPreGain.gain.value = 0.35;
      monkOsc1.connect(vocalPreGain);
      monkOsc2.connect(vocalPreGain);
      subOsc.connect(vocalPreGain);
      noiseFilter.connect(vocalPreGain);

      monkOsc1.start();
      monkOsc2.start();
      subOsc.start();
      this.ambientOscs.push(monkOsc1, monkOsc2, subOsc);

      // Formant Filter Bank for vocal vowels (F1, F2, F3)
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 380;
      f1.Q.value = 5.5;

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 820;
      f2.Q.value = 6.5;

      const f3 = ctx.createBiquadFilter();
      f3.type = 'bandpass';
      f3.frequency.value = 2200;
      f3.Q.value = 7.5;

      this.formantFilters = [f1, f2, f3];

      vocalPreGain.connect(f1);
      vocalPreGain.connect(f2);
      vocalPreGain.connect(f3);

      f1.connect(chantBus);
      f2.connect(chantBus);
      f3.connect(chantBus);

      // Start chant syllable sequencer loop
      this.startChantSequencer();
    } catch (e) {
      console.warn('Could not setup ambient chant track:', e);
    }
  }

  private startChantSequencer() {
    if (this.chantSchedulerTimer !== null) return;

    // Six syllables of Om Mani Padme Hum + breath pause
    const syllables = [
      { name: 'OM', dur: 2.8, f1: 380, f2: 820, f3: 2200, amp: 1.0, bowl: true },
      { name: 'MA', dur: 1.6, f1: 720, f2: 1240, f3: 2500, amp: 0.9, bowl: false },
      { name: 'NI', dur: 1.6, f1: 290, f2: 2150, f3: 2800, amp: 0.85, bowl: false },
      { name: 'PAD', dur: 1.6, f1: 680, f2: 1180, f3: 2400, amp: 0.95, bowl: false },
      { name: 'ME', dur: 1.6, f1: 480, f2: 1850, f3: 2600, amp: 0.85, bowl: false },
      { name: 'HUM', dur: 2.8, f1: 340, f2: 800, f3: 2200, amp: 1.0, bowl: false },
      { name: 'BREATH', dur: 1.4, f1: 300, f2: 750, f3: 2000, amp: 0.15, bowl: false },
    ];

    const runStep = () => {
      if (!this.audioCtx || this.formantFilters.length < 3 || !this.ambientChantGain) return;
      const ctx = this.audioCtx;
      const syl = syllables[this.currentSyllableIdx];
      const now = ctx.currentTime;
      const rampTime = Math.min(0.4, syl.dur * 0.25);

      // Formant transition
      this.formantFilters[0].frequency.setTargetAtTime(syl.f1, now, rampTime);
      this.formantFilters[1].frequency.setTargetAtTime(syl.f2, now, rampTime);
      this.formantFilters[2].frequency.setTargetAtTime(syl.f3, now, rampTime);

      // Vocal envelope
      this.ambientChantGain.gain.setTargetAtTime(syl.amp * 0.45, now, rampTime);

      // Soft singing bowl bell chime at beginning of each mantra cycle
      if (syl.bowl) {
        this.playSoftSingingBowlPing();
      }

      this.currentSyllableIdx = (this.currentSyllableIdx + 1) % syllables.length;
      this.chantSchedulerTimer = window.setTimeout(runStep, syl.dur * 1000);
    };

    runStep();
  }

  /**
   * Subtle singing bowl chime ping accompanying chanting repetition
   */
  private playSoftSingingBowlPing() {
    if (!this.audioCtx || !this.ambientMasterGain) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, now); // Sacred 432Hz

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(gain);
      gain.connect(this.ambientMasterGain);
      osc.start(now);
      osc.stop(now + 3.3);
    } catch {
      // ignore
    }
  }

  /**
   * Updates ambient singing bowl & Om Mani chanting track based on prayer wheel spinning speed.
   */
  updateAmbientTrack(angularSpeed: number, soundEnabled: boolean, chantEnabled: boolean) {
    if (!this.audioCtx || !this.ambientMasterGain) return;

    const absSpeed = Math.abs(angularSpeed);
    const isSpinning = absSpeed > 0.2; // Wheel is spinning

    if (soundEnabled && chantEnabled && isSpinning) {
      // Scale ambient volume with spin speed, smoothly capped for peaceful meditation
      const targetGain = Math.min(0.38, 0.16 + absSpeed * 0.025);
      const now = this.audioCtx.currentTime;
      this.ambientMasterGain.gain.setTargetAtTime(targetGain, now, 0.35);
    } else {
      // Gently fade out when stopped or disabled (natural singing bowl acoustic decay)
      const now = this.audioCtx.currentTime;
      this.ambientMasterGain.gain.setTargetAtTime(0, now, 0.85);
    }
  }
  playTick(enabled: boolean, volume = 0.15) {
    if (!enabled) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.02);

      gain.gain.setValueAtTime(volume * 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      // ignore
    }
  }

  /**
   * Plays authentic Tibetan singing bowl bell chime upon completing a full 360° mantra revolution.
   */
  playMantraChime(enabled: boolean, speedMultiplier = 1) {
    if (!enabled) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tibetan bell fundamental and harmonic series:
      // F#4 ~ 369.99 Hz, with metallic non-integer partials ~ 1.0, 2.76, 5.4, 8.9
      const fundamental = 392; // G4 warm temple bell
      const partials = [
        { mult: 1.0, gain: 0.35, decay: 1.8 },
        { mult: 2.76, gain: 0.18, decay: 1.4 },
        { mult: 5.4, gain: 0.09, decay: 0.8 },
        { mult: 8.9, gain: 0.04, decay: 0.5 },
      ];

      const masterGain = ctx.createGain();
      const vol = Math.min(0.4, 0.2 + speedMultiplier * 0.05);
      masterGain.gain.setValueAtTime(vol, now);
      masterGain.connect(ctx.destination);

      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const pGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * p.mult, now);

        pGain.gain.setValueAtTime(p.gain, now);
        pGain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(pGain);
        pGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + p.decay);
      });
    } catch (e) {
      console.warn('Error playing mantra chime:', e);
    }
  }

  /**
   * Deep harmonic Tibetan singing gong played on reaching 108 mantras or milestones.
   */
  playMilestoneGong(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [216, 324, 432, 648]; // 432Hz sacred harmonic tuning
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.5, now);
      masterGain.connect(ctx.destination);

      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3 / chords.length, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.08);
        osc.stop(now + 4.0);
      });
    } catch (e) {
      console.warn('Error playing milestone gong:', e);
    }
  }

  /**
   * Haptic feedback targeting controller or fallback navigator.vibrate
   */
  triggerHaptic(
    type: 'tick' | 'mantra' | 'milestone',
    enabled: boolean,
    controllers?: unknown[]
  ) {
    if (!enabled) return;

    // 1. WebXR Gamepad Haptics (Controllers / Hands)
    let triggeredXR = false;
    if (controllers && controllers.length > 0) {
      for (const ctrl of controllers) {
        // Find associated gamepad
        const gamepad = (ctrl as unknown as { gamepad?: Gamepad }).gamepad;
        if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
          const actuator = gamepad.hapticActuators[0];
          if (actuator && typeof actuator.pulse === 'function') {
            if (type === 'tick') {
              actuator.pulse(0.2, 10);
            } else if (type === 'mantra') {
              actuator.pulse(0.65, 35);
            } else if (type === 'milestone') {
              actuator.pulse(0.9, 70);
            }
            triggeredXR = true;
          }
        } else if (gamepad && 'vibrationActuator' in gamepad) {
          const vib = (gamepad as unknown as {
            vibrationActuator?: {
              playEffect?: (
                type: string,
                params: {
                  duration: number;
                  strongMagnitude: number;
                  weakMagnitude: number;
                }
              ) => Promise<void>;
            };
          }).vibrationActuator;

          if (vib && typeof vib.playEffect === 'function') {
            if (type === 'tick') {
              vib.playEffect('dual-rumble', {
                duration: 15,
                strongMagnitude: 0.1,
                weakMagnitude: 0.3,
              });
            } else if (type === 'mantra') {
              vib.playEffect('dual-rumble', {
                duration: 40,
                strongMagnitude: 0.4,
                weakMagnitude: 0.7,
              });
            } else if (type === 'milestone') {
              vib.playEffect('dual-rumble', {
                duration: 90,
                strongMagnitude: 0.8,
                weakMagnitude: 1.0,
              });
            }
            triggeredXR = true;
          }
        }
      }
    }

    // 2. Fallback to standard Vibration API for mobile screens / handheld
    if (!triggeredXR && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'tick') {
          navigator.vibrate(10);
        } else if (type === 'mantra') {
          navigator.vibrate([25, 20, 30]);
        } else if (type === 'milestone') {
          navigator.vibrate([60, 40, 80, 40, 100]);
        }
      } catch {
        // ignore
      }
    }
  }

  dispose() {
    if (this.chantSchedulerTimer !== null) {
      clearTimeout(this.chantSchedulerTimer);
      this.chantSchedulerTimer = null;
    }
    this.ambientOscs.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.ambientOscs = [];
    if (this.ambientMasterGain && this.audioCtx) {
      this.ambientMasterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
    if (this.bearingGain && this.audioCtx) {
      this.bearingGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
  }
}
