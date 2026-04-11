// =============================================================================
//  audio_shims.ts — Wrappers de audio con fallback de simulador en runtime
// =============================================================================
//
//  ¿POR QUÉ ESTE ARCHIVO?
//  ──────────────────────
//  Los shims nativos (`fisicabit_native::audioXxx`) sólo existen cuando la
//  extensión se compila a hardware real. En el simulador web de MakeCode,
//  pxt intenta resolverlos como `pxsim.fisicabit_native.audioXxx` y si no
//  encuentra nada, estalla con:
//
//      "Cannot read properties of undefined (reading 'audioMuestrearInterno')"
//
//  Para arreglarlo, NO basta con dar al wrapper un cuerpo TS: pxt ignora
//  ese cuerpo en presencia de `//% shim=`. Lo que hacemos es:
//
//    1) Declarar los shims nativos en `shims.d.ts` (ambient) para que el
//       compilador a hardware los resuelva contra el C++ de `shims.cpp`.
//    2) En este archivo exponer un `namespace FisicaBitAudioNative` SIN
//       anotaciones de shim, con funciones "normales" que internamente:
//         • Detectan al vuelo si estamos en el simulador (probe con
//           try/catch sobre una función nativa barata).
//         • Si es simulador, generan un tono sintético de 440 Hz (A4)
//           para que los bloques de detección sigan devolviendo algo
//           coherente y el alumno pueda probar su `forever` en la web.
//         • Si es hardware, delegan en el shim nativo correspondiente.
//
//  Así `detect frequency (Hz)` devuelve ~440 en el simulador y la frecuencia
//  real del mic en la placa, sin errores de `undefined`.
// =============================================================================

namespace FisicaBitAudioNative {

    // ── Detección de modo (hardware vs simulador) ─────────────────────
    // 0 = sin determinar, 1 = hardware (shim nativo OK), 2 = simulador
    //
    // Usamos `control.deviceDalVersion()`, una función de pxt-microbit
    // que SIEMPRE está resuelta en ambos entornos (tiene binding nativo
    // en la placa y binding JS en el simulador). Devuelve literalmente
    // la cadena "sim" cuando el programa se ejecuta en el simulador web
    // de MakeCode, y la versión real de CODAL ("2.x.y"…) en hardware.
    //
    // Este enfoque evita tocar los shims de fisicabit_native que pxt no
    // sabe resolver en el simulador — ésa es la causa del error
    // "Cannot read properties of undefined".
    let _modo = 0

    function _detectarModo(): void {
        if (_modo != 0) return
        const ver = control.deviceDalVersion()
        _modo = (ver == "sim") ? 2 : 1
    }

    function _isSim(): boolean {
        _detectarModo()
        return _modo == 2
    }

    // ── Estado del tono sintético del simulador ───────────────────────
    // Señal: senoide de 440 Hz (A4) con amplitud ~200 y offset 512
    // Permite que todos los algoritmos de detección devuelvan valores
    // coherentes (~440 Hz / "A4") cuando se prueba en la web.
    let _simBuf: number[] = []
    let _simDc = 512
    let _simRate = 11000
    let _simT = 0
    const _SIM_TONE_HZ = 440

    function _simFill(numMuestras: number, rate: number): void {
        _simBuf = []
        _simRate = rate
        _simDc = 512
        const twoPiF = 2 * Math.PI * _SIM_TONE_HZ
        for (let i = 0; i < numMuestras; i++) {
            const t = (_simT + i) / rate
            const v = 512 + Math.round(200 * Math.sin(twoPiF * t))
            _simBuf.push(v)
        }
        _simT += numMuestras
    }

    // ── Captura desde pin analógico (electret externo) ────────────────

    export function audioMuestrear(canal: number, sampleRateHz: number, numMuestras: number): number {
        if (_isSim()) {
            _simFill(numMuestras, sampleRateHz)
            return _simDc
        }
        return fisicabit_native.audioMuestrear(canal, sampleRateHz, numMuestras)
    }

    // ── Captura desde micrófono interno PDM v2 ────────────────────────

    export function audioMuestrearInterno(numMuestras: number): number {
        if (_isSim()) {
            _simFill(numMuestras, 11000)
            return _simDc
        }
        return fisicabit_native.audioMuestrearInterno(numMuestras)
    }

    // ── Acceso al buffer ──────────────────────────────────────────────

    export function audioLeerMuestra(indice: number): number {
        if (_isSim()) {
            if (indice < 0 || indice >= _simBuf.length) return 0
            return _simBuf[indice]
        }
        return fisicabit_native.audioLeerMuestra(indice)
    }

    export function audioLongitudBuffer(): number {
        if (_isSim()) return _simBuf.length
        return fisicabit_native.audioLongitudBuffer()
    }

    export function audioTasaMuestreo(): number {
        if (_isSim()) return _simRate
        return fisicabit_native.audioTasaMuestreo()
    }

    export function audioOffsetDC(): number {
        if (_isSim()) return _simDc
        return fisicabit_native.audioOffsetDC()
    }

    // ── Detección de frecuencia ───────────────────────────────────────

    export function audioFrecuenciaZC(): number {
        if (_isSim()) {
            if (_simBuf.length < 8 || _simRate <= 0) return 0
            let cruces = 0
            let prev = _simBuf[0] - _simDc
            for (let i = 1; i < _simBuf.length; i++) {
                const cur = _simBuf[i] - _simDc
                if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) cruces++
                prev = cur
            }
            return Math.round(cruces * _simRate * 100 / (2 * _simBuf.length))
        }
        return fisicabit_native.audioFrecuenciaZC()
    }

    export function audioFrecuenciaAutocorr(minHz: number, maxHz: number): number {
        if (_isSim()) {
            // Simulador: devolver el tono sintético acotado al rango buscado
            let f = _SIM_TONE_HZ
            if (f < minHz) f = minHz
            if (f > maxHz) f = maxHz
            return Math.round(f * 100)
        }
        return fisicabit_native.audioFrecuenciaAutocorr(minHz, maxHz)
    }

    export function audioGoertzel(targetHzCenti: number): number {
        if (_isSim()) {
            // Pico alto cerca del tono sintético, bajo lejos de él
            const target = targetHzCenti / 100
            const diff = Math.abs(target - _SIM_TONE_HZ)
            if (diff < 5) return 900
            if (diff < 20) return 500
            if (diff < 100) return 150
            return 30
        }
        return fisicabit_native.audioGoertzel(targetHzCenti)
    }

    // ── Amplitud ──────────────────────────────────────────────────────

    export function audioRMS(): number {
        if (_isSim()) {
            if (_simBuf.length == 0) return 0
            return 141  // 200/√2 ≈ 141 para una senoide de amplitud 200
        }
        return fisicabit_native.audioRMS()
    }

    export function audioPicoPico(): number {
        if (_isSim()) {
            if (_simBuf.length == 0) return 0
            return 400
        }
        return fisicabit_native.audioPicoPico()
    }
}
