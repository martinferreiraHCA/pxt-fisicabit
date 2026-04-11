// =============================================================================
//  audio_shims.ts — Implementación pura TypeScript de captura y DSP de audio
// =============================================================================
//
//  DISEÑO:
//  ───────
//  Intentos previos expusieron los shims nativos `fisicabit_native::audioXxx`
//  desde shims.d.ts y los llamaban desde TypeScript. Esto rompía el
//  simulador de MakeCode porque pxt intenta resolver cualquier referencia
//  a un shim contra `pxsim.<namespace>` y, al no existir en este proyecto
//  una carpeta `sim/` con bindings JS, el bundle del simulador no se
//  generaba (o estallaba con "Cannot read properties of undefined").
//
//  Este archivo elimina cualquier dependencia de los shims nativos:
//
//    - El muestreo de audio se hace con `pins.analogReadPin()` dentro de
//      un bucle TS sincronizado con `control.micros()`. Funciona tanto
//      en la placa real como en el simulador.
//
//    - Los algoritmos de DSP (ventana, offset DC, cruces por cero,
//      autocorrelación con interpolación parabólica, Goertzel, RMS,
//      pico-a-pico) están implementados en TS puro. Son lo bastante
//      rápidos en la micro:bit v2 (64 MHz Cortex-M4) para ventanas de
//      256 muestras: autocorr <300 ms por lectura, resto <10 ms.
//
//    - Para el MICRÓFONO INTERNO de la v2 no hay camino TS a las muestras
//      crudas (el PDM sólo es accesible desde C++ CODAL). Por eso el
//      modo "InternoV2" expone únicamente la AMPLITUD vía
//      `input.soundLevel()`; la detección de frecuencia/nota requiere un
//      módulo electret externo en P0/P1/P2 (funciona en v1 y v2).
//
//  NOTA: El archivo se llama `audio_shims.ts` por coherencia histórica
//  con el resto del proyecto, pero ya no contiene ningún shim nativo.
// =============================================================================

namespace FisicaBitAudioNative {

    // ── Estado del buffer de muestreo ────────────────────────────────
    let _buf: number[] = []
    let _dc = 512
    let _rate = 8000
    let _pinActual: AnalogPin = AnalogPin.P0

    function _seleccionarPin(canal: number): void {
        switch (canal) {
            case 0: _pinActual = AnalogPin.P0; break
            case 1: _pinActual = AnalogPin.P1; break
            case 2: _pinActual = AnalogPin.P2; break
            default: _pinActual = AnalogPin.P0
        }
    }

    // ── Muestreo de un pin analógico a sample rate fijo ──────────────
    // Usa `control.micros()` para temporización (1 μs de resolución) y
    // `pins.analogReadPin()` para leer el ADC. La tasa efectiva en la
    // placa real ronda 3–8 kHz según la carga de la CPU.
    // Devuelve el offset DC (media) calculado durante la captura.
    export function audioMuestrear(canal: number, sampleRateHz: number, numMuestras: number): number {
        _seleccionarPin(canal)
        if (sampleRateHz < 500) sampleRateHz = 500
        if (sampleRateHz > 16000) sampleRateHz = 16000
        if (numMuestras < 16) numMuestras = 16
        if (numMuestras > 1024) numMuestras = 1024

        _rate = sampleRateHz
        _buf = []
        const intervaloUs = Math.idiv(1000000, sampleRateHz)
        let suma = 0
        let proximoTick = control.micros()

        for (let i = 0; i < numMuestras; i++) {
            // Espera activa hasta el siguiente tick
            while (control.micros() - proximoTick < 0) { }
            const v = pins.analogReadPin(_pinActual)
            _buf.push(v)
            suma += v
            proximoTick += intervaloUs
        }

        _dc = Math.idiv(suma, numMuestras)
        return _dc
    }

    // ── "Captura" del micrófono interno v2 ───────────────────────────
    // Sin acceso a las muestras PDM, generamos una ventana a partir del
    // nivel de sonido integrado (`input.soundLevel()`). Sirve para que
    // el gating por amplitud funcione, pero la frecuencia no se podrá
    // determinar (el bloque `detect frequency` devolverá 0 cuando la
    // fuente sea InternoV2). Para detectar frecuencia en la v2 conecta
    // un módulo electret a P0/P1/P2 y usa la fuente externa.
    export function audioMuestrearInterno(numMuestras: number): number {
        _rate = 100  // ~10 ms por muestra (soundLevel integra así)
        _buf = []
        let suma = 0
        for (let i = 0; i < numMuestras; i++) {
            const v = input.soundLevel()
            _buf.push(v)
            suma += v
            // Pausa muy pequeña para no saturar; soundLevel es un integrador
            control.waitMicros(100)
        }
        _dc = Math.idiv(suma, numMuestras)
        return _dc
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

    // ── Cruces por cero (Zero-Crossing Rate) ─────────────────────────
    // f ≈ (cruces / 2) × (rate / N)
    export function audioFrecuenciaZC(): number {
        if (_buf.length < 8 || _rate <= 0) return 0
        let cruces = 0
        let prev = _buf[0] - _dc
        for (let i = 1; i < _buf.length; i++) {
            const cur = _buf[i] - _dc
            if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) cruces++
            prev = cur
        }
        return Math.round(cruces * _rate * 100 / (2 * _buf.length))
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
    // Devuelve la frecuencia fundamental en centi-Hz, o 0 si no la
    // encuentra. Ideal para detección de tono puro.
    export function audioFrecuenciaAutocorr(minHz: number, maxHz: number): number {
        if (_buf.length < 32 || _rate <= 0) return 0
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        if (maxHz > Math.idiv(_rate, 2)) maxHz = Math.idiv(_rate, 2)

        let minLag = Math.idiv(_rate, maxHz)
        let maxLag = Math.idiv(_rate, minHz)
        if (minLag < 2) minLag = 2
        if (maxLag >= _buf.length - 1) maxLag = _buf.length - 2
        if (maxLag <= minLag) return 0

        let mejorScore = -1e30
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

    // ── Goertzel: energía en una frecuencia objetivo ─────────────────
    export function audioGoertzel(targetHzCenti: number): number {
        if (_buf.length < 16 || _rate <= 0 || targetHzCenti <= 0) return 0
        const targetHz = targetHzCenti / 100
        const omega = 2 * Math.PI * targetHz / _rate
        const coeff = 2 * Math.cos(omega)
        let q0 = 0, q1 = 0, q2 = 0
        for (let i = 0; i < _buf.length; i++) {
            const x = _buf[i] - _dc
            q0 = coeff * q1 - q2 + x
            q2 = q1
            q1 = q0
        }
        let mag2 = q1 * q1 + q2 * q2 - coeff * q1 * q2
        if (mag2 < 0) mag2 = 0
        const mag = Math.sqrt(mag2)
        return Math.round(mag * 1000 / _buf.length)
    }

    // ── Amplitud RMS ─────────────────────────────────────────────────
    export function audioRMS(): number {
        if (_buf.length == 0) return 0
        let sumSq = 0
        for (let i = 0; i < _buf.length; i++) {
            const d = _buf[i] - _dc
            sumSq += d * d
        }
        return Math.round(Math.sqrt(sumSq / _buf.length))
    }

    // ── Rango pico-a-pico (max − min) ────────────────────────────────
    export function audioPicoPico(): number {
        if (_buf.length == 0) return 0
        let mn = _buf[0]
        let mx = _buf[0]
        for (let i = 1; i < _buf.length; i++) {
            const v = _buf[i]
            if (v < mn) mn = v
            if (v > mx) mx = v
        }
        return mx - mn
    }
}
