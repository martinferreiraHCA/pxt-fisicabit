// =============================================================================
//  sound.ts — Sound and frequency analysis (FisicaBit)
// =============================================================================
//  Project : FisicaBit.com
//  Category: "FisicaBit sound"
//
//  Goal:
//    Provide acoustic analysis blocks accurate enough to build physics
//    experiments — especially the Doppler effect — using:
//      • The micro:bit v2 (internal MEMS microphone, AMPLITUDE/level only)
//      • The micro:bit v1 or v2 + an external electret microphone on P0/P1/P2
//        (AMPLITUDE + real FREQUENCY by ADC sampling)
//
//  WHY AN ANALOG PIN FOR FREQUENCY?
//  ────────────────────────────────
//    The internal microphone of the micro:bit v2 only exposes its signal
//    through the `input.soundLevel()` block, which already integrates and
//    averages the amplitude. To detect the FREQUENCY of a tone we need the
//    raw samples. This is possible by sampling an electret module (MAX4466,
//    MAX9814, KY-037, etc.) connected to an analog pin — on both v1 and v2.
//
//  WIRING — typical electret module (MAX4466, MAX9814, KY-037, LM386…):
//    VCC  → micro:bit 3V
//    GND  → micro:bit GND
//    OUT  → P0, P1 or P2 (analog)
//    Set the module gain to about half before starting.
//
//  SAMPLE RATE (NYQUIST):
//    To measure a frequency f, sample at ≥ 2·f.
//    In practice we recommend 4× f (margin against aliasing).
//      • 8 kHz  → tones up to ~3 kHz (whistles, 440 Hz tuning fork, voice)
//      • 16 kHz → tones up to ~6 kHz (referee whistle, low ultrasound)
//
//  IMPLEMENTED ALGORITHMS (in C++, see shims.cpp):
//    1) Zero crossings (ZCR)
//         - Cost: O(N). Very fast.
//         - Precision: ±(rate/N/2) Hz. Poor with noise or harmonics.
//         - Ideal for: pure tones and demonstration experiments.
//
//    2) Autocorrelation + parabolic interpolation
//         - Cost: O((maxLag-minLag)·N). Slower but robust.
//         - Precision: sub-sample (≪ rate/N).
//         - Ideal for: fine detection and Doppler (whistles, tuning forks…).
//
//    3) Goertzel (1 FFT bin)
//         - Cost: O(N). A target frequency is given.
//         - Returns the ENERGY in that bin — perfect for fine tracking:
//           we sweep several bins around the emitted frequency and keep
//           the maximum (equivalent to a lock-in amplifier).
//         - Ideal for: Doppler shift with an emitter of known frequency.
//
//  DOPPLER — THEORY REMINDER:
//    For a sound source with frequency f₀, speed of sound c,
//    source velocity vₛ and observer velocity vₒ (+ approaching):
//
//       f_observed = f₀ · (c + vₒ) / (c − vₛ)
//
//    Solving for the source velocity (observer at rest):
//
//       vₛ = c · (1 − f₀ / f_observed)
//
//    And for the observer (source at rest):
//
//       vₒ = c · (f_observed / f₀ − 1)
//
//    At 20 °C, c ≈ 343 m/s.
// =============================================================================


/** Sound level, frequency detection, musical notes and Doppler effect blocks for physics experiments. */
//% weight=82
//% color=#1F8A70
//% icon="\uf130"
//% block="FisicaBit sound"
//% groups='["Setup", "Capture", "Sound level", "Frequency detection", "Doppler effect", "Advanced"]'
namespace fisicabitSound {

    // =========================================================================
    // Internal state
    // =========================================================================

    // Default analog pin (P0) and its channel number for the shims
    let _source: FbMicrophoneSource = FbMicrophoneSource.ExternalP0
    let _channel = 0

    // Sampling window (sample rate and buffer size)
    let _sampleRate = 8000
    let _numSamples = 256

    // Default range for the autocorrelation search (Hz)
    let _minHz = 80
    let _maxHz = 3000

    // Flag telling whether we have already captured something
    let _captured = false

    // =========================================================================
    // Internal helpers
    // =========================================================================

    function _sourceToChannel(source: FbMicrophoneSource): number {
        switch (source) {
            case FbMicrophoneSource.ExternalP0: return 0
            case FbMicrophoneSource.ExternalP1: return 1
            case FbMicrophoneSource.ExternalP2: return 2
            default: return 0
        }
    }

    function _capture(): boolean {
        if (_source == FbMicrophoneSource.InternalV2) {
            // Internal PDM mic v2: first force the audio pipeline to start by
            // calling soundLevel(), then capture raw samples from the CODAL
            // StreamSplitter via the native shim.
            input.soundLevel()
            const r = fisicabitAudioNative.audioSampleInternal(_numSamples)
            _captured = (r >= 0)
            return _captured
        }
        const r = fisicabitAudioNative.audioSample(_channel, _sampleRate, _numSamples)
        _captured = (r >= 0)
        return _captured
    }

    // =========================================================================
    // Blocks — Setup
    // =========================================================================

    /**
     * Chooses the sound source: internal v2 microphone (amplitude only) or
     * an electret module connected to P0/P1/P2 (amplitude + frequency).
     *
     * @param source microphone to use
     */
    //% blockId=fisicabit_snd_fuente
    //% block="set sound source %source"
    //% group="Setup" weight=100
    //% source.defl=FbMicrophoneSource.ExternalP0
    export function setSource(source: FbMicrophoneSource): void {
        _source = source
        _channel = _sourceToChannel(source)
    }

    /**
     * Configures the analysis window: sample rate and number of samples.
     *
     * Rules of thumb:
     *   • sample rate ≥ 4 × the highest frequency you want to detect
     *   • larger N samples → better resolution, slower time response
     *   • window duration = N / sampleRate  (e.g. 256/8000 = 32 ms)
     *
     * @param rate sample rate in Hz
     * @param samples number of samples in the buffer (64..1024)
     */
    //% blockId=fisicabit_snd_ventana
    //% block="set sampling rate %rate with %samples"
    //% group="Setup" weight=95
    //% rate.defl=FbAudioSampleRate.F8kHz
    //% samples.defl=FbAudioBufferSize.N256
    export function setWindow(rate: FbAudioSampleRate, samples: FbAudioBufferSize): void {
        _sampleRate = rate
        _numSamples = samples
    }

    /**
     * Sets the frequency range searched by the autocorrelation algorithm.
     * Narrowing the range speeds the detection up a LOT (cost O((maxLag-minLag)·N)).
     *
     * @param minHz lowest expected frequency (Hz)
     * @param maxHz highest expected frequency (Hz)
     */
    //% blockId=fisicabit_snd_rango
    //% block="limit frequency search to %minHz .. %maxHz Hz"
    //% group="Setup" weight=90
    //% minHz.defl=80 maxHz.defl=3000
    //% minHz.min=20 minHz.max=8000
    //% maxHz.min=40 maxHz.max=10000
    export function setFrequencyRange(minHz: number, maxHz: number): void {
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        _minHz = minHz
        _maxHz = maxHz
    }

    // =========================================================================
    // Blocks — Capture of a sample window
    // =========================================================================

    /**
     * Captures an audio window with the current settings.
     * Call it before using the "last ..." blocks (ZC, autocorrelation, RMS,
     * Goertzel, peak-to-peak).
     *
     * It can be called repeatedly in a `forever` loop for real-time tracking;
     * each call blocks for N / sampleRate seconds.
     *
     * @returns true if the capture succeeded, false in the simulator or with the internal v2 mic
     */
    //% blockId=fisicabit_snd_capturar
    //% block="capture sound window"
    //% group="Capture" weight=100
    export function captureWindow(): boolean {
        return _capture()
    }

    /**
     * Returns the actual duration of the captured window in milliseconds.
     */
    //% blockId=fisicabit_snd_duracion
    //% block="window duration (ms)"
    //% group="Capture" weight=90
    export function windowDurationMs(): number {
        if (_sampleRate <= 0) return 0
        return Math.round(_numSamples * 1000 / _sampleRate)
    }

    // =========================================================================
    // Blocks — Sound level (amplitude)
    // =========================================================================

    /**
     * Sound level 0..255 using the internal MEMS microphone of the
     * micro:bit v2. Equivalent to `input.soundLevel()`. Returns 0 on v1.
     */
    //% blockId=fisicabit_snd_nivel_v2
    //% block="internal sound level (v2, 0–255)"
    //% group="Sound level" weight=100
    export function internalSoundLevelV2(): number {
        return input.soundLevel()
    }

    /**
     * RMS amplitude of the last captured window (ADC units, 0..512).
     * Use it as gating: only analyze frequency when there is signal.
     */
    //% blockId=fisicabit_snd_rms
    //% block="last window RMS amplitude"
    //% group="Sound level" weight=90
    export function rmsAmplitude(): number {
        if (!_captured) return 0
        return fisicabitAudioNative.audioRms()
    }

    /**
     * Peak-to-peak range (max − min) of the last captured window.
     */
    //% blockId=fisicabit_snd_pkpk
    //% block="last window peak-to-peak"
    //% group="Sound level" weight=85
    export function peakToPeakAmplitude(): number {
        if (!_captured) return 0
        return fisicabitAudioNative.audioPeakToPeak()
    }

    /**
     * Captures a window, computes its RMS and returns it (all in one step).
     */
    //% blockId=fisicabit_snd_rms_ahora
    //% block="sound RMS amplitude now"
    //% group="Sound level" weight=80
    export function rmsAmplitudeNow(): number {
        if (!_capture()) return 0
        return fisicabitAudioNative.audioRms()
    }

    // =========================================================================
    // Blocks — Frequency detection
    // =========================================================================

    /**
     * Returns the fundamental frequency (Hz, 2 decimals) of the last captured
     * window, using the chosen algorithm.
     *
     * Goertzel needs a target frequency: use the block
     * "Goertzel energy at %targetHz" for that.
     *
     * @param method detection algorithm
     */
    //% blockId=fisicabit_snd_freq_ultima
    //% block="last window frequency (Hz) with %method"
    //% group="Frequency detection" weight=100
    //% method.defl=FbFrequencyMethod.Autocorrelation
    export function lastWindowFrequency(method: FbFrequencyMethod): number {
        if (!_captured) return 0
        let centiHz = 0
        switch (method) {
            case FbFrequencyMethod.ZeroCrossing:
                centiHz = fisicabitAudioNative.audioFrequencyZeroCrossing()
                break
            case FbFrequencyMethod.Autocorrelation:
                centiHz = fisicabitAudioNative.audioFrequencyAutocorrelation(_minHz, _maxHz)
                break
            case FbFrequencyMethod.Goertzel:
                // Goertzel requires a target — return 0 if used here.
                return 0
        }
        return Math.round(centiHz) / 100
    }

    /**
     * Captures + detects the fundamental frequency in a single step.
     * If the RMS amplitude is below `rmsThreshold`, returns 0 (silence).
     *
     * @param method detection algorithm
     * @param rmsThreshold minimum amplitude for the reading to be valid
     */
    //% blockId=fisicabit_snd_freq_ahora
    //% block="sound frequency (Hz) now with %method ignore below RMS %rmsThreshold"
    //% group="Frequency detection" weight=98
    //% method.defl=FbFrequencyMethod.Autocorrelation
    //% rmsThreshold.defl=8 rmsThreshold.min=0 rmsThreshold.max=500
    export function frequencyNow(method: FbFrequencyMethod, rmsThreshold: number): number {
        if (!_capture()) return 0
        if (fisicabitAudioNative.audioRms() < rmsThreshold) return 0
        let centiHz = 0
        switch (method) {
            case FbFrequencyMethod.ZeroCrossing:
                centiHz = fisicabitAudioNative.audioFrequencyZeroCrossing()
                break
            case FbFrequencyMethod.Autocorrelation:
                centiHz = fisicabitAudioNative.audioFrequencyAutocorrelation(_minHz, _maxHz)
                break
            case FbFrequencyMethod.Goertzel:
                return 0
        }
        return Math.round(centiHz) / 100
    }

    /**
     * Energy detected by Goertzel at a specific target frequency, applied to
     * the last captured window. Useful to detect the presence of a known
     * tone (e.g. a piezo emitter at 4000 Hz).
     *
     * @param targetHz target frequency in Hz
     */
    //% blockId=fisicabit_snd_goertzel
    //% block="Goertzel energy at %targetHz Hz"
    //% group="Frequency detection" weight=90
    //% targetHz.defl=440 targetHz.min=20 targetHz.max=10000
    export function goertzelEnergy(targetHz: number): number {
        if (!_captured) return 0
        return fisicabitAudioNative.audioGoertzel(Math.round(targetHz * 100))
    }

    /**
     * Fine "lock-in" style tuner: sweeps several Goertzel bins around
     * `centerHz` spaced by `stepHz`, and returns the frequency of the bin
     * with the highest energy. The effective granularity is `stepHz`.
     *
     * Ideal for Doppler with an emitter of known frequency: sweep ±200 Hz
     * around the emitted frequency with a 2–5 Hz step.
     *
     * @param centerHz center frequency (Hz)
     * @param spanHz total sweep width (Hz)
     * @param stepHz spacing between bins (Hz)
     */
    //% blockId=fisicabit_snd_lockin
    //% block="lock-in frequency around %centerHz Hz ± %spanHz step %stepHz"
    //% group="Frequency detection" weight=85
    //% centerHz.defl=4000 spanHz.defl=200 stepHz.defl=5
    //% centerHz.min=100 centerHz.max=10000
    //% spanHz.min=10 spanHz.max=2000
    //% stepHz.min=1 stepHz.max=50
    export function lockInFrequency(centerHz: number, spanHz: number, stepHz: number): number {
        if (!_captured) return 0
        if (stepHz < 1) stepHz = 1
        const from = centerHz - spanHz / 2
        const to = centerHz + spanHz / 2
        let bestHz = centerHz
        let bestMag = -1
        for (let f = from; f <= to; f += stepHz) {
            const m = fisicabitAudioNative.audioGoertzel(Math.round(f * 100))
            if (m > bestMag) {
                bestMag = m
                bestHz = f
            }
        }
        // Parabolic refinement: if we have valid neighbours, adjust the peak.
        if (bestHz > from && bestHz < to && stepHz >= 1) {
            const mM = fisicabitAudioNative.audioGoertzel(Math.round((bestHz - stepHz) * 100))
            const mP = fisicabitAudioNative.audioGoertzel(Math.round((bestHz + stepHz) * 100))
            const denom = 2 * (2 * bestMag - mM - mP)
            if (denom != 0) {
                const delta = (mP - mM) / denom
                if (delta > -1 && delta < 1) {
                    bestHz = bestHz + delta * stepHz
                }
            }
        }
        return Math.round(bestHz * 100) / 100
    }

    // =========================================================================
    // Blocks — INTERNAL v2 mic (frequency and musical note detection)
    // =========================================================================
    //
    // These blocks use EXCLUSIVELY the internal microphone of the micro:bit
    // v2 (no external mic or wiring needed). Internally they capture raw
    // samples from the PDM pipeline through the CODAL StreamSplitter.
    //
    // PHYSICAL LIMITS of the internal PDM microphone:
    //   • Sample rate ~11 kHz → Nyquist ~5.5 kHz
    //   • High-pass filter of the decimator → attenuation below ~80 Hz
    //   • USEFUL range in practice: 80 Hz – 4000 Hz
    //
    // This range covers all common musical notes:
    //   E2 (82.4 Hz)  — low E string of guitar/bass
    //   A2 (110 Hz)   — low A
    //   C4 (261.6 Hz) — middle C
    //   A4 (440 Hz)   — tuning A (tuning fork)
    //   C5 (523.3 Hz) — C5
    //   A5 (880 Hz)
    //   C7 (2093 Hz)  — high C on the piano
    //   C8 (4186 Hz)  — practical upper limit
    //
    // It does not cover 20 Hz (infrasound) nor 20 kHz (ultrasound): those
    // frequencies are physically out of reach for the board's PDM mic.
    // =========================================================================

    /**
     * "All in one" block to drop straight into a `forever` loop: captures
     * audio from the INTERNAL MICROPHONE of the micro:bit v2 and returns
     * the fundamental frequency in Hz. No parameters, no wiring.
     *
     *   forever:
     *       let f = fisicabitSound.detectFrequency()
     *       basic.showNumber(f)
     *
     * Internally it uses:
     *   • Internal v2 PDM microphone (via the CODAL StreamSplitter)
     *   • 512 samples @ ~11 kHz (~46 ms window)
     *   • Autocorrelation with sub-sample parabolic interpolation
     *   • Range 60 – 4500 Hz (low E2 up to high C8)
     *   • RMS gating (silence returns 0)
     *
     * Returns 0 if there is not enough signal or when running on v1 (no mic).
     * In the simulator it returns 440 Hz (A4) as a test tone.
     */
    //% blockId=fisicabit_snd_detectar_frecuencia
    //% block="detect frequency (Hz)"
    //% group="Frequency detection" weight=110
    export function detectFrequency(): number {
        return internalFrequencyV2()
    }

    /**
     * "All in one" block to detect the musical note closest to the sound
     * picked up by the INTERNAL microphone of the v2, no wiring needed.
     *
     *   forever:
     *       basic.showString(fisicabitSound.detectNote())
     *
     * Returns the name in standard MIDI notation (A4, C#5, ...) or
     * "—" if there is not enough signal. In the simulator it returns "A4".
     */
    //% blockId=fisicabit_snd_detectar_nota
    //% block="detect musical note"
    //% group="Frequency detection" weight=108
    export function detectNote(): string {
        const f = detectFrequency()
        if (f <= 0) return "—"
        return noteName(f)
    }

    /**
     * Detects the dominant frequency of the sound picked up by the INTERNAL
     * MICROPHONE of the micro:bit v2, without extra hardware.
     *
     * Captures an audio window from the PDM pipeline, applies autocorrelation
     * with parabolic interpolation and returns the frequency in Hz with
     * 2 decimals.
     *
     * Useful range ~80 Hz – 4000 Hz (limited by the internal PDM mic).
     * Returns 0 if the sound level is too low.
     */
    //% blockId=fisicabit_snd_freq_interna
    //% block="internal mic frequency (Hz)"
    //% group="Frequency detection" weight=80
    export function internalFrequencyV2(): number {
        // Uses the native audio shim (sim/audio.ts in the simulator,
        // shims.cpp + StreamSplitter on hardware). Range 60..4500 Hz —
        // the useful range of the internal PDM mic (low E2 .. high C8).
        return fisicabitAudioNative.detectInternalMicFrequency(60, 4500, 512)
    }

    /**
     * Returns the name of the musical note closest to a given frequency
     * (Western note names with octave, e.g. "A4").
     *
     * Uses the standard reference A4 = 440 Hz and the formula:
     *    n (MIDI) = 69 + 12 · log₂(f / 440)
     *
     * Returns "—" if the frequency is outside a reasonable range
     * (<20 Hz or >10 kHz).
     *
     * @param frequencyHz frequency in Hz
     */
    //% blockId=fisicabit_snd_nombre_nota
    //% block="note name for %frequencyHz Hz"
    //% group="Frequency detection" weight=78
    //% frequencyHz.defl=440
    export function noteName(frequencyHz: number): string {
        if (frequencyHz < 20 || frequencyHz > 10000) return "—"
        const midi = 69 + 12 * Math.log(frequencyHz / 440) / Math.log(2)
        const midiR = Math.round(midi)
        if (midiR < 0 || midiR > 127) return "—"
        const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        const octave = Math.floor(midiR / 12) - 1
        return names[midiR % 12] + octave
    }

    /**
     * Deviation in cents between a measured frequency and the closest
     * musical note. 100 cents = 1 semitone. Positive = sharp (slightly
     * above the exact note), negative = flat.
     *
     * Typical range: [-50, +50]. Useful for tuning instruments.
     *
     * @param frequencyHz measured frequency in Hz
     */
    //% blockId=fisicabit_snd_detune
    //% block="detune (cents) for %frequencyHz Hz"
    //% group="Frequency detection" weight=76
    //% frequencyHz.defl=440
    export function detuneCents(frequencyHz: number): number {
        if (frequencyHz < 20) return 0
        const midi = 69 + 12 * Math.log(frequencyHz / 440) / Math.log(2)
        const cents = (midi - Math.round(midi)) * 100
        return Math.round(cents)
    }

    /**
     * Detects the musical note closest to the sound picked up by the
     * INTERNAL MICROPHONE of the micro:bit v2. A single step: PDM capture
     * + autocorrelation + conversion to note name.
     *
     * Practical range: E2 (82 Hz) .. C8 (4186 Hz).
     * Returns "—" if there is not enough signal.
     */
    //% blockId=fisicabit_snd_nota_interna
    //% block="internal mic detected note"
    //% group="Frequency detection" weight=82
    export function internalNoteV2(): string {
        const f = internalFrequencyV2()
        if (f <= 0) return "—"
        return noteName(f)
    }

    /**
     * Frequency in Hz of a musical note given by its MIDI number.
     *
     * Standard MIDI mapping:
     *   21 = A0 (27.5 Hz)   60 = C4 (261.6 Hz)   69 = A4 (440 Hz)
     *   72 = C5             84 = C6              96 = C7
     *
     * @param midi MIDI note number (0..127)
     */
    //% blockId=fisicabit_snd_midi_a_hz
    //% block="frequency (Hz) of MIDI note %midi"
    //% group="Frequency detection" weight=74
    //% midi.defl=69 midi.min=0 midi.max=127
    export function midiNoteFrequency(midi: number): number {
        const f = 440 * Math.pow(2, (midi - 69) / 12)
        return Math.round(f * 100) / 100
    }

    // =========================================================================
    // Blocks — Doppler effect
    // =========================================================================

    /**
     * Velocity deduced from the Doppler shift between an emitted and an
     * observed frequency.
     *
     * Formulas:
     *    f_obs = f₀ · (c + vₒ) / (c − vₛ)
     *    vₛ = c · (1 − f₀ / f_obs)     (observer at rest)
     *    vₒ = c · (f_obs / f₀ − 1)     (source at rest)
     *
     * Sign convention: POSITIVE velocity = the source/observer is
     * APPROACHING; negative = moving AWAY.
     *
     * @param emittedHz actual frequency emitted by the source (Hz)
     * @param observedHz frequency detected by the microphone (Hz)
     * @param speedOfSound speed of sound in the medium (m/s, typically 343)
     * @param variable which velocity to compute
     * @param unit output unit
     */
    //% blockId=fisicabit_snd_doppler_v
    //% block="Doppler velocity: emitted %emittedHz Hz, observed %observedHz Hz (c=%speedOfSound m/s) → %variable in %unit"
    //% group="Doppler effect" weight=100
    //% emittedHz.defl=4000 observedHz.defl=4000
    //% speedOfSound.defl=343
    //% variable.defl=FbDopplerVariable.SourceVelocity
    //% unit.defl=FbSpeedUnit.MetersPerSecond
    //% inlineInputMode=external
    export function dopplerVelocity(
        emittedHz: number,
        observedHz: number,
        speedOfSound: number,
        variable: FbDopplerVariable,
        unit: FbSpeedUnit
    ): number {
        if (emittedHz <= 0 || observedHz <= 0 || speedOfSound <= 0) return 0
        let vMs = 0
        switch (variable) {
            case FbDopplerVariable.SourceVelocity:
                // vₛ = c · (1 − f₀ / f_obs)
                vMs = speedOfSound * (1 - emittedHz / observedHz)
                break
            case FbDopplerVariable.ObserverVelocity:
                // vₒ = c · (f_obs / f₀ − 1)
                vMs = speedOfSound * (observedHz / emittedHz - 1)
                break
        }
        if (unit == FbSpeedUnit.KilometersPerHour) vMs = vMs * 3.6
        return Math.round(vMs * 100) / 100
    }

    /**
     * Frequency expected to be observed for a given velocity.
     * Useful to CHECK experiments: compute the "theoretical" frequency
     * and compare it with the one returned by the microphone.
     *
     *    f_obs = f₀ · (c + vₒ) / (c − vₛ)
     *
     * @param emittedHz emitted frequency (Hz)
     * @param sourceVelocity source velocity (m/s, + approaching)
     * @param observerVelocity observer velocity (m/s, + approaching)
     * @param speedOfSound speed of sound (m/s)
     */
    //% blockId=fisicabit_snd_doppler_f
    //% block="expected observed frequency: emitted %emittedHz Hz, source %sourceVelocity m/s, observer %observerVelocity m/s (c=%speedOfSound m/s)"
    //% group="Doppler effect" weight=95
    //% emittedHz.defl=4000
    //% sourceVelocity.defl=0 observerVelocity.defl=0
    //% speedOfSound.defl=343
    //% inlineInputMode=external
    export function expectedDopplerFrequency(
        emittedHz: number,
        sourceVelocity: number,
        observerVelocity: number,
        speedOfSound: number
    ): number {
        if (speedOfSound <= 0) return 0
        const denom = speedOfSound - sourceVelocity
        if (denom == 0) return 0
        const fObs = emittedHz * (speedOfSound + observerVelocity) / denom
        return Math.round(fObs * 100) / 100
    }

    /**
     * Speed of sound in air at a given temperature in °C.
     * Classic approximation: c ≈ 331.3 + 0.606·T  (m/s).
     *
     * @param temperatureC air temperature in °C
     */
    //% blockId=fisicabit_snd_c_sonido
    //% block="speed of sound in air at %temperatureC °C"
    //% group="Doppler effect" weight=90
    //% temperatureC.defl=20
    export function speedOfSoundInAir(temperatureC: number): number {
        return Math.round((331.3 + 0.606 * temperatureC) * 100) / 100
    }

    // =========================================================================
    // Blocks — Advanced (direct buffer access)
    // =========================================================================

    /**
     * Number of samples available in the last captured buffer.
     */
    //% blockId=fisicabit_snd_buf_len
    //% block="buffer length"
    //% group="Advanced" weight=100
    //% advanced=true
    export function bufferLength(): number {
        return fisicabitAudioNative.audioBufferLength()
    }

    /**
     * Sample at index `i` of the last captured buffer (raw ADC value).
     *
     * @param i index (0 .. buffer length − 1)
     */
    //% blockId=fisicabit_snd_buf_get
    //% block="sample at index %i"
    //% group="Advanced" weight=95
    //% advanced=true
    //% i.min=0 i.max=1023
    export function sampleAt(i: number): number {
        return fisicabitAudioNative.audioReadSample(i)
    }

    /**
     * DC offset (mean) estimated in the last capture.
     */
    //% blockId=fisicabit_snd_dc
    //% block="DC offset of last window"
    //% group="Advanced" weight=90
    //% advanced=true
    export function dcOffset(): number {
        return fisicabitAudioNative.audioDcOffset()
    }

    /**
     * Effective sample rate (Hz) of the last capture.
     */
    //% blockId=fisicabit_snd_rate
    //% block="effective sample rate (Hz)"
    //% group="Advanced" weight=85
    //% advanced=true
    export function effectiveSampleRate(): number {
        return fisicabitAudioNative.audioSampleRate()
    }
}
