// =============================================================================
//  audio_shims.ts — Captura y DSP de audio en TypeScript puro
// =============================================================================
//
//  Toda la tubería de audio del módulo FisicaBitSonido está aquí y no
//  depende de ningún shim nativo. Así el simulador de MakeCode carga
//  sin problemas (los intentos previos de usar shims C++ hacían que
//  pxt fallara al resolver `pxsim.fisicabit_native` y el simulador
//  no terminaba de cargar).
//
//  - Sampling: `pins.analogReadPin()` + `control.waitMicros()`.
//  - DSP: zero-crossing, autocorrelación con interpolación parabólica,
//    Goertzel, RMS y pico-a-pico, todo en TS.
//  - Micro interno v2 (InternoV2): sólo amplitud vía `input.soundLevel()`.
//    Para detectar FRECUENCIA en la v2 hay que conectar un módulo
//    electret (MAX4466/MAX9814/KY-037) a P0/P1/P2.
// =============================================================================

namespace FisicaBitAudioNative {

    // Constantes
    const PI2 = 6.283185307179586   // 2·π, evitamos Math.PI por portabilidad
    const BIG_NEG = -2147483000     // valor inicial "mínimo" sin notación exp

    // =========================================================================
    // Detección de simulador en tiempo de ejecución
    // =========================================================================
    //
    // El shim nativo `fisicabit_native::audioInternoDetectarFrecuencia` vive
    // en `shims.cpp` y SÓLO existe en la compilación de hardware. El
    // simulador de MakeCode no sabe resolverlo (pxt sólo provee bindings
    // pxsim para los namespaces del target, no para los de extensiones
    // externas con shims propios) y lanza
    //     "Cannot read properties of undefined (reading 'audioInternoDetectarFrecuencia')"
    // en cuanto un `forever` intenta llamarlo.
    //
    // Solución definitiva: detectar en runtime si estamos en el simulador
    // y, si es así, NO llamar al shim en absoluto. Devolvemos un valor
    // sintético (440 Hz = A4) para que el `forever` siga ejecutándose
    // y el alumno pueda validar su lógica antes de flashear la placa.
    //
    // Método de detección: `control.deviceSerialNumber()` devuelve un ID
    // único de 32 bits en hardware real (típicamente > 10⁷) y un valor
    // pequeño y fijo en el simulador de MakeCode. Umbral 1.000.000 separa
    // ambos casos con amplio margen.
    // =========================================================================
    let _isSimCache = -1   // -1 = sin determinar, 0 = hardware, 1 = simulador

    function _isSim(): boolean {
        if (_isSimCache < 0) {
            _isSimCache = (control.deviceSerialNumber() < 1000000) ? 1 : 0
        }
        return _isSimCache == 1
    }

    // Estado del buffer de muestreo
    let _buf: number[] = []
    let _dc = 512
    let _rate = 8000
    let _canalActivo = 0   // 0=P0, 1=P1, 2=P2

    function _leerPin(): number {
        if (_canalActivo == 1) return pins.analogReadPin(AnalogPin.P1)
        if (_canalActivo == 2) return pins.analogReadPin(AnalogPin.P2)
        return pins.analogReadPin(AnalogPin.P0)
    }

    // ── Muestreo de un pin analógico a sample rate fijo ──────────────
    export function audioMuestrear(canal: number, sampleRateHz: number, numMuestras: number): number {
        _canalActivo = canal
        if (sampleRateHz < 500) sampleRateHz = 500
        if (sampleRateHz > 16000) sampleRateHz = 16000
        if (numMuestras < 16) numMuestras = 16
        if (numMuestras > 512) numMuestras = 512

        _rate = sampleRateHz
        _buf = []
        const intervaloUs = Math.idiv(1000000, sampleRateHz)
        let suma = 0

        for (let i = 0; i < numMuestras; i++) {
            const v = _leerPin()
            _buf.push(v)
            suma += v
            control.waitMicros(intervaloUs)
        }

        _dc = Math.idiv(suma, numMuestras)
        return _dc
    }

    // ── "Captura" del mic interno v2 (sólo amplitud) ─────────────────
    // soundLevel() devuelve 0..255 integrado en ~10 ms.
    // Sigue aquí por compatibilidad con los bloques de amplitud. La
    // detección de frecuencia con mic interno va por su propio camino
    // (detectarFrecuenciaMicInterno), que llama al shim C++ real.
    export function audioMuestrearInterno(numMuestras: number): number {
        _rate = 100
        _buf = []
        let suma = 0
        if (numMuestras < 16) numMuestras = 16
        if (numMuestras > 256) numMuestras = 256

        for (let i = 0; i < numMuestras; i++) {
            const v = input.soundLevel()
            _buf.push(v)
            suma += v
            control.waitMicros(500)
        }
        _dc = Math.idiv(suma, numMuestras)
        return _dc
    }

    // ── Detección de frecuencia con el mic INTERNO v2 ────────────────
    // En HARDWARE: pasa por el shim nativo `audioInternoDetectarFrecuencia`
    // (shims.cpp), que engancha el StreamSplitter de CODAL y corre
    // autocorrelación en C++ sobre muestras PDM reales.
    //
    // En SIMULADOR: el shim no existe en `pxsim` y llamarlo explota. Por
    // eso detectamos el entorno con `_isSim()` y devolvemos directamente
    // 440 Hz (A4) — el `forever` sigue rodando y el alumno puede
    // desarrollar su programa en la web antes de flashear la placa.
    //
    // Devuelve la frecuencia en Hz (con 2 decimales) o 0 si silencio.
    export function detectarFrecuenciaMicInterno(minHz: number, maxHz: number, numMuestras: number): number {
        // Simulador: devolver A4 sintético sin tocar el shim
        if (_isSim()) {
            return 440
        }
        // Hardware: llamar al shim nativo
        if (numMuestras < 64) numMuestras = 64
        if (numMuestras > 1024) numMuestras = 1024
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        // Arrancar el pipeline de audio (idempotente tras la primera vez)
        input.soundLevel()
        const centiHz = fisicabit_native.audioInternoDetectarFrecuencia(
            numMuestras,
            Math.round(minHz * 100),
            Math.round(maxHz * 100)
        )
        return Math.round(centiHz) / 100
    }

    // ── Acceso al buffer ─────────────────────────────────────────────
    export function audioLeerMuestra(indice: number): number {
        if (indice < 0 || indice >= _buf.length) return 0
        return _buf[indice]
    }

    export function audioLongitudBuffer(): number {
        return _buf.length
    }

    export function audioTasaMuestreo(): number {
        return _rate
    }

    export function audioOffsetDC(): number {
        return _dc
    }

    // ── Cruces por cero ──────────────────────────────────────────────
    export function audioFrecuenciaZC(): number {
        const n = _buf.length
        if (n < 8 || _rate <= 0) return 0
        let cruces = 0
        let prev = _buf[0] - _dc
        for (let i = 1; i < n; i++) {
            const cur = _buf[i] - _dc
            if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) cruces++
            prev = cur
        }
        return Math.round(cruces * _rate * 100 / (2 * n))
    }

    // ── Autocorrelación en un lag concreto (helper) ──────────────────
    function _autocorr(lag: number): number {
        const n = _buf.length - lag
        if (n <= 0) return 0
        let suma = 0
        for (let i = 0; i < n; i++) {
            const a = _buf[i] - _dc
            const b = _buf[i + lag] - _dc
            suma += a * b
        }
        return suma / n
    }

    // ── Autocorrelación con interpolación parabólica ─────────────────
    export function audioFrecuenciaAutocorr(minHz: number, maxHz: number): number {
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

        let mejorScore = BIG_NEG
        let mejorLag = minLag
        for (let lag = minLag; lag <= maxLag; lag++) {
            const score = _autocorr(lag)
            if (score > mejorScore) {
                mejorScore = score
                mejorLag = lag
            }
        }
        if (mejorScore <= 0) return 0

        // Interpolación parabólica sub-muestra
        let lagRefinado = mejorLag
        if (mejorLag > minLag && mejorLag < maxLag) {
            const yM = _autocorr(mejorLag - 1)
            const y0 = mejorScore
            const yP = _autocorr(mejorLag + 1)
            const denom = 2 * (2 * y0 - yM - yP)
            if (denom != 0) {
                const delta = (yP - yM) / denom
                if (delta > -1 && delta < 1) {
                    lagRefinado = mejorLag + delta
                }
            }
        }
        if (lagRefinado < 1) return 0
        const freq = _rate / lagRefinado
        return Math.round(freq * 100)
    }

    // ── Goertzel ─────────────────────────────────────────────────────
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

    // ── Amplitud RMS ─────────────────────────────────────────────────
    export function audioRMS(): number {
        const n = _buf.length
        if (n == 0) return 0
        let sumSq = 0
        for (let i = 0; i < n; i++) {
            const d = _buf[i] - _dc
            sumSq += d * d
        }
        return Math.round(Math.sqrt(sumSq / n))
    }

    // ── Rango pico-a-pico ────────────────────────────────────────────
    export function audioPicoPico(): number {
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
