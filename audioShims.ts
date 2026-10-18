// =============================================================================
//  audioShims.ts — Audio capture and DSP in pure TypeScript
// =============================================================================
//
//  The whole audio pipeline of the fisicabitSound module lives here and does
//  not depend on any native shim. This way the MakeCode simulator loads
//  without problems (earlier attempts to use C++ shims made pxt fail while
//  resolving `pxsim.fisicabitNative`, and the simulator never finished
//  loading).
//
//  - Sampling: `pins.analogReadPin()` + `control.waitMicros()`.
//  - DSP: zero-crossing, autocorrelation with parabolic interpolation,
//    Goertzel, RMS and peak-to-peak, all in TS.
//  - Internal v2 mic (InternalV2): amplitude only via `input.soundLevel()`.
//    To detect FREQUENCY on the v2 an electret module (MAX4466/MAX9814/KY-037)
//    must be connected to P0/P1/P2.
// =============================================================================

/**
 * Internal audio capture and DSP helpers (sampling, zero-crossing,
 * autocorrelation, Goertzel, RMS) used by the FisicaBit sound blocks.
 */
namespace fisicabitAudioNative {

    // Constants
    const PI2 = 6.283185307179586   // 2·π, we avoid Math.PI for portability
    const BIG_NEG = -2147483000     // initial "minimum" value without exponent notation

    // =========================================================================
    // NATIVE SHIM: PDM capture + autocorrelation (internal v2 mic)
    // =========================================================================
    //
    // This is the canonical pxt pattern for functions that have both a C++
    // implementation (hardware) and a TS fallback (simulator):
    //
    //   //% shim=fisicabitNative::audioInternalDetectFrequency
    //   function _hwDetectFrequency(...): number {
    //       return 44000   // ← TS body = simulator fallback
    //   }
    //
    // How pxt handles it:
    //   • On HARDWARE: pxt replaces the TS body with a call to the C++
    //     `fisicabitNative::audioInternalDetectFrequency` in shims.cpp.
    //   • In the SIMULATOR: pxt uses the TS body as is (returns 44000
    //     centi-Hz = 440 Hz = A4 as a test tone).
    //
    // Key requirement: this function is declared ONLY here.
    // There is NO second declaration in nativeShims.ts with //% shim=.
    // Duplicating the declaration confuses pxt and breaks resolution.
    // =========================================================================

    //% shim=fisicabitNative::audioInternalDetectFrequency
    function _hwDetectFrequency(numSamples: number, minHzCenti: number, maxHzCenti: number): number {
        // ── TS body: only runs in the simulator ──
        // Returns 440 Hz (A4) in centi-Hz if the range includes it,
        // otherwise the center of the requested range.
        const A4 = 44000
        if (A4 >= minHzCenti && A4 <= maxHzCenti) return A4
        return Math.idiv(minHzCenti + maxHzCenti, 2)
    }

    /**
     * Internal helper, not a block. Validates the parameters and runs the
     * internal-microphone frequency detection pipeline (PDM capture +
     * autocorrelation). Returns the frequency in Hz with 2 decimals.
     * @param minHz lowest frequency to search for (Hz)
     * @param maxHz highest frequency to search for (Hz)
     * @param numSamples number of samples to capture (64..1024)
     */
    export function detectInternalMicFrequency(minHz: number, maxHz: number, numSamples: number): number {
        if (numSamples < 64) numSamples = 64
        if (numSamples > 1024) numSamples = 1024
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        // soundLevel() starts the audio pipeline the first time
        input.soundLevel()
        const centiHz = _hwDetectFrequency(
            numSamples,
            Math.round(minHz * 100),
            Math.round(maxHz * 100)
        )
        return Math.round(centiHz) / 100
    }

    // Sample buffer state
    let _buf: number[] = []
    let _dc = 512
    let _rate = 8000
    let _activeChannel = 0   // 0=P0, 1=P1, 2=P2

    function _readPin(): number {
        if (_activeChannel == 1) return pins.analogReadPin(AnalogPin.P1)
        if (_activeChannel == 2) return pins.analogReadPin(AnalogPin.P2)
        return pins.analogReadPin(AnalogPin.P0)
    }

    /**
     * Internal helper, not a block. Samples an analog pin at a fixed sample
     * rate into the internal buffer and returns the DC offset (mean).
     * @param channel analog input: 0=P0, 1=P1, 2=P2
     * @param sampleRateHz sample rate in Hz (500..16000)
     * @param numSamples number of samples to capture (16..512)
     */
    export function audioSample(channel: number, sampleRateHz: number, numSamples: number): number {
        _activeChannel = channel
        if (sampleRateHz < 500) sampleRateHz = 500
        if (sampleRateHz > 16000) sampleRateHz = 16000
        if (numSamples < 16) numSamples = 16
        if (numSamples > 512) numSamples = 512

        _rate = sampleRateHz
        _buf = []
        const intervalUs = Math.idiv(1000000, sampleRateHz)
        let sum = 0

        for (let i = 0; i < numSamples; i++) {
            const v = _readPin()
            _buf.push(v)
            sum += v
            control.waitMicros(intervalUs)
        }

        _dc = Math.idiv(sum, numSamples)
        return _dc
    }

    // ── "Capture" from the internal v2 mic (amplitude only) ─────────────
    // soundLevel() returns 0..255 integrated over ~10 ms.
    // Kept here for compatibility with the amplitude blocks. Frequency
    // detection with the internal mic goes its own way
    // (detectInternalMicFrequency), which calls the real C++ shim.
    /**
     * Internal helper, not a block. Fills the buffer with `input.soundLevel()`
     * readings from the internal v2 microphone (amplitude only) and returns
     * the DC offset (mean).
     * @param numSamples number of samples to capture (16..256)
     */
    export function audioSampleInternal(numSamples: number): number {
        _rate = 100
        _buf = []
        let sum = 0
        if (numSamples < 16) numSamples = 16
        if (numSamples > 256) numSamples = 256

        for (let i = 0; i < numSamples; i++) {
            const v = input.soundLevel()
            _buf.push(v)
            sum += v
            control.waitMicros(500)
        }
        _dc = Math.idiv(sum, numSamples)
        return _dc
    }

    // ── Buffer access ────────────────────────────────────────────────────
    /**
     * Internal helper, not a block. Returns the raw sample at the given index
     * of the last captured buffer (0 if out of range).
     * @param index sample index (0 .. buffer length − 1)
     */
    export function audioReadSample(index: number): number {
        if (index < 0 || index >= _buf.length) return 0
        return _buf[index]
    }

    /**
     * Internal helper, not a block. Returns the number of samples in the last
     * captured buffer.
     */
    export function audioBufferLength(): number {
        return _buf.length
    }

    /**
     * Internal helper, not a block. Returns the sample rate (Hz) of the last
     * capture.
     */
    export function audioSampleRate(): number {
        return _rate
    }

    /**
     * Internal helper, not a block. Returns the DC offset (mean) of the last
     * capture.
     */
    export function audioDcOffset(): number {
        return _dc
    }

    /**
     * Internal helper, not a block. Estimates the frequency of the last
     * capture by counting zero crossings. Returns centi-Hz.
     */
    export function audioFrequencyZeroCrossing(): number {
        const n = _buf.length
        if (n < 8 || _rate <= 0) return 0
        let crossings = 0
        let prev = _buf[0] - _dc
        for (let i = 1; i < n; i++) {
            const cur = _buf[i] - _dc
            if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) crossings++
            prev = cur
        }
        return Math.round(crossings * _rate * 100 / (2 * n))
    }

    // ── Autocorrelation at a specific lag (helper) ───────────────────────
    function _autocorr(lag: number): number {
        const n = _buf.length - lag
        if (n <= 0) return 0
        let sum = 0
        for (let i = 0; i < n; i++) {
            const a = _buf[i] - _dc
            const b = _buf[i + lag] - _dc
            sum += a * b
        }
        return sum / n
    }

    /**
     * Internal helper, not a block. Estimates the fundamental frequency of the
     * last capture by autocorrelation with parabolic interpolation. Returns
     * centi-Hz, or 0 if no reliable peak is found.
     * @param minHz lowest frequency to search for (Hz)
     * @param maxHz highest frequency to search for (Hz)
     */
    export function audioFrequencyAutocorrelation(minHz: number, maxHz: number): number {
        const n = _buf.length
        if (n < 32 || _rate <= 0) return 0
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        const nyq = Math.idiv(_rate, 2)
        if (maxHz > nyq) maxHz = nyq

        let minLag = Math.idiv(_rate, maxHz)
        let maxLag = Math.idiv(_rate, minHz)
        if (minLag < 2) minLag = 2
        if (maxLag >= n - 1) maxLag = n - 2
        if (maxLag <= minLag) return 0

        let bestScore = BIG_NEG
        let bestLag = minLag
        for (let lag = minLag; lag <= maxLag; lag++) {
            const score = _autocorr(lag)
            if (score > bestScore) {
                bestScore = score
                bestLag = lag
            }
        }
        if (bestScore <= 0) return 0

        // Sub-sample parabolic interpolation
        let refinedLag = bestLag
        if (bestLag > minLag && bestLag < maxLag) {
            const yM = _autocorr(bestLag - 1)
            const y0 = bestScore
            const yP = _autocorr(bestLag + 1)
            const denom = 2 * (2 * y0 - yM - yP)
            if (denom != 0) {
                const delta = (yP - yM) / denom
                if (delta > -1 && delta < 1) {
                    refinedLag = bestLag + delta
                }
            }
        }
        if (refinedLag < 1) return 0
        const freq = _rate / refinedLag
        return Math.round(freq * 100)
    }

    /**
     * Internal helper, not a block. Goertzel energy of the last capture at a
     * target frequency (single FFT bin). Returns the magnitude scaled by
     * 1000/N.
     * @param targetHzCenti target frequency in centi-Hz
     */
    export function audioGoertzel(targetHzCenti: number): number {
        const n = _buf.length
        if (n < 16 || _rate <= 0 || targetHzCenti <= 0) return 0
        const targetHz = targetHzCenti / 100
        const omega = PI2 * targetHz / _rate
        const coeff = 2 * Math.cos(omega)
        let q0 = 0
        let q1 = 0
        let q2 = 0
        for (let i = 0; i < n; i++) {
            const x = _buf[i] - _dc
            q0 = coeff * q1 - q2 + x
            q2 = q1
            q1 = q0
        }
        let mag2 = q1 * q1 + q2 * q2 - coeff * q1 * q2
        if (mag2 < 0) mag2 = 0
        const mag = Math.sqrt(mag2)
        return Math.round(mag * 1000 / n)
    }

    /**
     * Internal helper, not a block. RMS amplitude of the last capture
     * (ADC units, DC removed).
     */
    export function audioRms(): number {
        const n = _buf.length
        if (n == 0) return 0
        let sumSq = 0
        for (let i = 0; i < n; i++) {
            const d = _buf[i] - _dc
            sumSq += d * d
        }
        return Math.round(Math.sqrt(sumSq / n))
    }

    /**
     * Internal helper, not a block. Peak-to-peak range (max − min) of the
     * last capture.
     */
    export function audioPeakToPeak(): number {
        const n = _buf.length
        if (n == 0) return 0
        let mn = _buf[0]
        let mx = _buf[0]
        for (let i = 1; i < n; i++) {
            const v = _buf[i]
            if (v < mn) mn = v
            if (v > mx) mx = v
        }
        return mx - mn
    }
}
