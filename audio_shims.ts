// =============================================================================
//  audio_shims.ts — Wrappers con soporte para simulador de los shims de audio
// =============================================================================
//
//  ¿POR QUÉ ESTE ARCHIVO?
//  ──────────────────────
//  Los shims declarados en `shims.d.ts` con `declare namespace` son sólo
//  tipos: en el simulador no tienen implementación y cualquier llamada
//  provoca `Cannot read properties of undefined`. Para poder probar el
//  bloque `detect frequency` en el simulador de MakeCode antes de subirlo
//  a la placa, necesitamos wrappers con un cuerpo TS real.
//
//  CÓMO FUNCIONA:
//    - Cada función lleva `//% shim=fisicabit_native::xxx`.
//    - En HARDWARE (micro:bit v1/v2) el compilador sustituye la llamada
//      por el shim nativo C++ → se ejecuta el código de `shims.cpp`.
//    - En el SIMULADOR (ejecución JS) el cuerpo TS de abajo corre tal cual:
//      genera un tono simulado de 440 Hz (A4) para que los bloques de
//      detección devuelvan valores coherentes y el alumno pueda ver su
//      `forever` funcionar antes de flashear la placa.
//
//  El namespace lleva otro nombre (`FisicaBitAudioNative`) para no chocar
//  con el `declare namespace fisicabit_native` de `shims.d.ts` — el nombre
//  C++ sigue siendo `fisicabit_native::xxx` gracias a la anotación shim.
// =============================================================================

namespace FisicaBitAudioNative {

    // ── Estado simulado (sólo se usa en el simulador) ────────────────
    // Buffer sintético con una senoide de 440 Hz (A4) y amplitud ~200.
    // Permite que los bloques de detección devuelvan ~440 Hz en la web.
    let _simBuf: number[] = []
    let _simDc = 512
    let _simRate = 8000
    let _simT = 0
    const _SIM_TONE_HZ = 440  // A4: nota de afinación estándar

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

    // ── Captura desde pin analógico (electret externo) ───────────────

    //% shim=fisicabit_native::audioMuestrear
    export function audioMuestrear(canal: number, sampleRateHz: number, numMuestras: number): number {
        _simFill(numMuestras, sampleRateHz)
        return _simDc
    }

    // ── Captura desde micrófono interno PDM v2 ───────────────────────

    //% shim=fisicabit_native::audioMuestrearInterno
    export function audioMuestrearInterno(numMuestras: number): number {
        _simFill(numMuestras, 11000)
        return _simDc
    }

    // ── Acceso al buffer ─────────────────────────────────────────────

    //% shim=fisicabit_native::audioLeerMuestra
    export function audioLeerMuestra(indice: number): number {
        if (indice < 0 || indice >= _simBuf.length) return 0
        return _simBuf[indice]
    }

    //% shim=fisicabit_native::audioLongitudBuffer
    export function audioLongitudBuffer(): number {
        return _simBuf.length
    }

    //% shim=fisicabit_native::audioTasaMuestreo
    export function audioTasaMuestreo(): number {
        return _simRate
    }

    //% shim=fisicabit_native::audioOffsetDC
    export function audioOffsetDC(): number {
        return _simDc
    }

    // ── Detección de frecuencia ──────────────────────────────────────

    //% shim=fisicabit_native::audioFrecuenciaZC
    export function audioFrecuenciaZC(): number {
        // Simulador: recalcular cruces por cero sobre la senoide sintética
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

    //% shim=fisicabit_native::audioFrecuenciaAutocorr
    export function audioFrecuenciaAutocorr(minHz: number, maxHz: number): number {
        // Simulador: devolvemos directamente el tono sintético (en centi-Hz)
        // clamped al rango de búsqueda por si el bloque usa uno estrecho.
        let f = _SIM_TONE_HZ
        if (f < minHz) f = minHz
        if (f > maxHz) f = maxHz
        return Math.round(f * 100)
    }

    //% shim=fisicabit_native::audioGoertzel
    export function audioGoertzel(targetHzCenti: number): number {
        // Simulador: magnitud alta si la frecuencia objetivo coincide con el
        // tono sintético, baja si se aleja. Útil para probar el "lock-in".
        const target = targetHzCenti / 100
        const diff = Math.abs(target - _SIM_TONE_HZ)
        if (diff < 5)   return 900
        if (diff < 20)  return 500
        if (diff < 100) return 150
        return 30
    }

    //% shim=fisicabit_native::audioRMS
    export function audioRMS(): number {
        // 200/√2 ≈ 141, con jitter pequeño para que no sea constante
        if (_simBuf.length == 0) return 0
        return 141
    }

    //% shim=fisicabit_native::audioPicoPico
    export function audioPicoPico(): number {
        if (_simBuf.length == 0) return 0
        return 400
    }
}
