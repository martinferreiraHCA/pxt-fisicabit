// =============================================================================
//  sonido_sensores.ts — Análisis de sonido y frecuencia (FisicaBit)
// =============================================================================
//  Proyecto : FisicaBit.com
//  Categoría: "FisicaBit Sound"
//
//  Objetivo:
//    Ofrecer bloques de análisis acústico lo suficientemente precisos como
//    para montar prácticas de física — en especial efecto Doppler —
//    usando:
//      • La micro:bit v2 (micrófono MEMS interno, sólo AMPLITUD/nivel)
//      • La micro:bit v1 o v2 + un micrófono electret externo en P0/P1/P2
//        (AMPLITUD + FRECUENCIA real por muestreo de ADC)
//
//  ¿POR QUÉ UN PIN ANALÓGICO PARA FRECUENCIA?
//  ──────────────────────────────────────────
//    El micrófono interno de la micro:bit v2 sólo expone su señal a través
//    del bloque `input.soundLevel()`, que ya integra y promedia la amplitud.
//    Para detectar la FRECUENCIA de un tono necesitamos las muestras crudas.
//    Esto es posible muestreando un módulo electret (MAX4466, MAX9814, KY-037,
//    etc.) conectado a un pin analógico — tanto en v1 como en v2.
//
//  CABLEADO — módulo electret típico (MAX4466, MAX9814, KY-037, LM386…):
//    VCC  → 3V del micro:bit
//    GND  → GND del micro:bit
//    OUT  → P0, P1 ó P2 (analógico)
//    Ajustar la ganancia del módulo a media potencia antes de empezar.
//
//  TASA DE MUESTREO (NYQUIST):
//    Para medir una frecuencia f, hay que muestrear a ≥ 2·f.
//    En la práctica recomendamos 4× f (márgen contra aliasing).
//      • 8 kHz  → tonos hasta ~3 kHz (silbatos, diapasón 440 Hz, voz)
//      • 16 kHz → tonos hasta ~6 kHz (silbato de árbitro, ultrasonidos bajos)
//
//  ALGORITMOS IMPLEMENTADOS (en C++, ver shims.cpp):
//    1) Cruces por cero (ZCR)
//         - Coste: O(N). Muy rápido.
//         - Precisión: ±(rate/N/2) Hz. Mala si hay ruido o armónicos.
//         - Ideal para: tonos puros y prácticas de demostración.
//
//    2) Autocorrelación + interpolación parabólica
//         - Coste: O((maxLag-minLag)·N). Más lento pero robusto.
//         - Precisión: sub-muestra (≪ rate/N).
//         - Ideal para: detección fina y Doppler (silbatos, diapasones…).
//
//    3) Goertzel (1 bin de FFT)
//         - Coste: O(N). Se da una frecuencia objetivo.
//         - Devuelve la ENERGÍA en ese bin — perfecto para tracking fino:
//           barremos varios bines alrededor de la frecuencia emitida y nos
//           quedamos con el máximo (equivalente a un lock-in amplifier).
//         - Ideal para: corrimiento Doppler con emisor de frecuencia conocida.
//
//  DOPPLER — RECORDATORIO TEÓRICO:
//    Para una fuente de sonido con frecuencia f₀, velocidad del sonido c,
//    velocidad de la fuente vₛ y del observador vₒ (+ acercándose):
//
//       f_observada = f₀ · (c + vₒ) / (c − vₛ)
//
//    Despejando la velocidad de la fuente (observador en reposo):
//
//       vₛ = c · (1 − f₀ / f_observada)
//
//    Y la del observador (fuente en reposo):
//
//       vₒ = c · (f_observada / f₀ − 1)
//
//    A 20 °C, c ≈ 343 m/s.
// =============================================================================


//% weight=82
//% color=#1F8A70
//% icon="\uf130"
//% block="FisicaBit Sonido"
//% groups='["Configuración", "Captura", "Nivel de sonido", "Detección de frecuencia", "Efecto Doppler", "Avanzado"]'
namespace FisicaBitSonido {

    // =========================================================================
    // Estado interno
    // =========================================================================

    // Pin analógico por defecto (P0) y su número para los shims
    let _fuente: FuenteMicrofono = FuenteMicrofono.ExternoP0
    let _canal = 0

    // Ventana de muestreo (sample rate y tamaño de buffer)
    let _sampleRate = 8000
    let _numMuestras = 256

    // Rango por defecto para la búsqueda de autocorrelación (Hz)
    let _minHz = 80
    let _maxHz = 3000

    // Flag para saber si ya hemos capturado algo
    let _capturado = false

    // =========================================================================
    // Helpers internos
    // =========================================================================

    function _fuenteACanal(fuente: FuenteMicrofono): number {
        switch (fuente) {
            case FuenteMicrofono.ExternoP0: return 0
            case FuenteMicrofono.ExternoP1: return 1
            case FuenteMicrofono.ExternoP2: return 2
            default: return 0
        }
    }

    function _capturar(): boolean {
        if (_fuente == FuenteMicrofono.InternoV2) {
            // Mic interno PDM v2: primero forzamos arranque del pipeline de
            // audio llamando a soundLevel(), y después capturamos muestras
            // crudas desde el StreamSplitter de CODAL vía shim nativo.
            input.soundLevel()
            const r = FisicaBitAudioNative.audioMuestrearInterno(_numMuestras)
            _capturado = (r >= 0)
            return _capturado
        }
        const r = FisicaBitAudioNative.audioMuestrear(_canal, _sampleRate, _numMuestras)
        _capturado = (r >= 0)
        return _capturado
    }

    // =========================================================================
    // Bloques — Setup
    // =========================================================================

    /**
     * Elige el origen del sonido: micrófono interno v2 (sólo amplitud) o
     * un módulo electret conectado a P0/P1/P2 (amplitud + frecuencia).
     */
    //% blockId=fisicabit_snd_fuente
    //% block="fijar fuente de sonido %fuente"
    //% group="Configuración" weight=100
    //% fuente.defl=FuenteMicrofono.ExternoP0
    export function fijarFuente(fuente: FuenteMicrofono): void {
        _fuente = fuente
        _canal = _fuenteACanal(fuente)
    }

    /**
     * Configura la ventana de análisis: tasa de muestreo y nº de muestras.
     *
     * Reglas prácticas:
     *   • sample rate ≥ 4 × frecuencia máxima que quieras detectar
     *   • N muestras más grande → mejor resolución, peor respuesta temporal
     *   • Duración de la ventana = N / sampleRate  (ej. 256/8000 = 32 ms)
     *
     * @param tasa frecuencia de muestreo en Hz
     * @param muestras número de muestras del buffer (64..1024)
     */
    //% blockId=fisicabit_snd_ventana
    //% block="fijar tasa de muestreo %tasa con %muestras"
    //% group="Configuración" weight=95
    //% tasa.defl=TasaMuestreoAudio.F8kHz
    //% muestras.defl=TamanoBufferAudio.N256
    export function fijarVentana(tasa: TasaMuestreoAudio, muestras: TamanoBufferAudio): void {
        _sampleRate = tasa
        _numMuestras = muestras
    }

    /**
     * Fija el rango de frecuencias buscado por el algoritmo de autocorrelación.
     * Reducir el rango acelera MUCHO la detección (coste O((maxLag-minLag)·N)).
     *
     * @param minHz frecuencia mínima esperada (Hz)
     * @param maxHz frecuencia máxima esperada (Hz)
     */
    //% blockId=fisicabit_snd_rango
    //% block="limitar búsqueda de frecuencia a %minHz .. %maxHz Hz"
    //% group="Configuración" weight=90
    //% minHz.defl=80 maxHz.defl=3000
    //% minHz.min=20 minHz.max=8000
    //% maxHz.min=40 maxHz.max=10000
    export function fijarRangoFrecuencia(minHz: number, maxHz: number): void {
        if (minHz < 20) minHz = 20
        if (maxHz <= minHz) maxHz = minHz + 1
        _minHz = minHz
        _maxHz = maxHz
    }

    // =========================================================================
    // Bloques — Captura de una ventana de muestras
    // =========================================================================

    /**
     * Captura una ventana de audio con los parámetros actuales.
     * Llamar antes de usar los bloques "last ..." (ZC, autocorrelación, RMS,
     * Goertzel, pico-a-pico).
     *
     * Se puede llamar varias veces en un `forever` para hacer tracking en
     * tiempo real; cada llamada bloquea durante N / sampleRate segundos.
     *
     * @returns true si la captura tuvo éxito, false en simulador o v2-interno
     */
    //% blockId=fisicabit_snd_capturar
    //% block="capturar ventana de sonido"
    //% group="Captura" weight=100
    export function capturarVentana(): boolean {
        return _capturar()
    }

    /**
     * Devuelve la duración real de la ventana capturada en milisegundos.
     */
    //% blockId=fisicabit_snd_duracion
    //% block="duración de la ventana (ms)"
    //% group="Captura" weight=90
    export function duracionVentanaMs(): number {
        if (_sampleRate <= 0) return 0
        return Math.round(_numMuestras * 1000 / _sampleRate)
    }

    // =========================================================================
    // Bloques — Nivel de sonido (amplitud)
    // =========================================================================

    /**
     * Nivel de sonido 0..255 usando el micrófono MEMS interno de la
     * micro:bit v2. Equivale a `input.soundLevel()`. En v1 devuelve 0.
     */
    //% blockId=fisicabit_snd_nivel_v2
    //% block="nivel de sonido interno (v2, 0–255)"
    //% group="Nivel de sonido" weight=100
    export function nivelSonidoInternoV2(): number {
        return input.soundLevel()
    }

    /**
     * Amplitud RMS de la última ventana capturada (unidades ADC, 0..512).
     * Úsalo como gating: sólo analizar frecuencia si hay señal.
     */
    //% blockId=fisicabit_snd_rms
    //% block="amplitud RMS de la última ventana"
    //% group="Nivel de sonido" weight=90
    export function amplitudRMS(): number {
        if (!_capturado) return 0
        return FisicaBitAudioNative.audioRMS()
    }

    /**
     * Rango pico-a-pico (max − min) de la última ventana capturada.
     */
    //% blockId=fisicabit_snd_pkpk
    //% block="pico a pico de la última ventana"
    //% group="Nivel de sonido" weight=85
    export function amplitudPicoPico(): number {
        if (!_capturado) return 0
        return FisicaBitAudioNative.audioPicoPico()
    }

    /**
     * Captura una ventana, calcula el RMS y la devuelve (todo en un paso).
     */
    //% blockId=fisicabit_snd_rms_ahora
    //% block="amplitud RMS del sonido ahora"
    //% group="Nivel de sonido" weight=80
    export function amplitudRMSAhora(): number {
        if (!_capturar()) return 0
        return FisicaBitAudioNative.audioRMS()
    }

    // =========================================================================
    // Bloques — Detección de frecuencia
    // =========================================================================

    /**
     * Devuelve la frecuencia fundamental (Hz, con 2 decimales) de la última
     * ventana capturada, usando el algoritmo elegido.
     *
     * Goertzel necesita una frecuencia objetivo: para eso usa el bloque
     * "Goertzel energy at %targetHz".
     *
     * @param metodo algoritmo de detección
     */
    //% blockId=fisicabit_snd_freq_ultima
    //% block="frecuencia (Hz) de la última ventana con %metodo"
    //% group="Detección de frecuencia" weight=100
    //% metodo.defl=MetodoFrecuencia.Autocorrelacion
    export function frecuenciaUltimaVentana(metodo: MetodoFrecuencia): number {
        if (!_capturado) return 0
        let centiHz = 0
        switch (metodo) {
            case MetodoFrecuencia.CrucesCero:
                centiHz = FisicaBitAudioNative.audioFrecuenciaZC()
                break
            case MetodoFrecuencia.Autocorrelacion:
                centiHz = FisicaBitAudioNative.audioFrecuenciaAutocorr(_minHz, _maxHz)
                break
            case MetodoFrecuencia.Goertzel:
                // Goertzel requiere target — devolvemos 0 si se usa aquí.
                return 0
        }
        return Math.round(centiHz) / 100
    }

    /**
     * Captura + detecta la frecuencia fundamental en un solo paso.
     * Si la amplitud RMS es inferior a `umbralRms`, devuelve 0 (silencio).
     *
     * @param metodo algoritmo de detección
     * @param umbralRms amplitud mínima para que la lectura sea válida
     */
    //% blockId=fisicabit_snd_freq_ahora
    //% block="frecuencia del sonido (Hz) ahora con %metodo ignorar por debajo de RMS %umbralRms"
    //% group="Detección de frecuencia" weight=98
    //% metodo.defl=MetodoFrecuencia.Autocorrelacion
    //% umbralRms.defl=8 umbralRms.min=0 umbralRms.max=500
    export function frecuenciaAhora(metodo: MetodoFrecuencia, umbralRms: number): number {
        if (!_capturar()) return 0
        if (FisicaBitAudioNative.audioRMS() < umbralRms) return 0
        let centiHz = 0
        switch (metodo) {
            case MetodoFrecuencia.CrucesCero:
                centiHz = FisicaBitAudioNative.audioFrecuenciaZC()
                break
            case MetodoFrecuencia.Autocorrelacion:
                centiHz = FisicaBitAudioNative.audioFrecuenciaAutocorr(_minHz, _maxHz)
                break
            case MetodoFrecuencia.Goertzel:
                return 0
        }
        return Math.round(centiHz) / 100
    }

    /**
     * Energía detectada por Goertzel en una frecuencia objetivo concreta,
     * aplicada a la última ventana capturada. Útil para detectar presencia
     * de un tono conocido (ej. emisor piezoeléctrico a 4000 Hz).
     *
     * @param targetHz frecuencia objetivo en Hz
     */
    //% blockId=fisicabit_snd_goertzel
    //% block="energía Goertzel en %targetHz Hz"
    //% group="Detección de frecuencia" weight=90
    //% targetHz.defl=440 targetHz.min=20 targetHz.max=10000
    export function goertzelEnergia(targetHz: number): number {
        if (!_capturado) return 0
        return FisicaBitAudioNative.audioGoertzel(Math.round(targetHz * 100))
    }

    /**
     * Afinador fino estilo "lock-in": barre varios bines de Goertzel alrededor
     * de `centroHz` con una separación `pasoHz`, y devuelve la frecuencia del
     * bin con mayor energía. La granularidad efectiva es `pasoHz`.
     *
     * Ideal para Doppler con emisor de frecuencia conocida: barremos ±200 Hz
     * en torno a la frecuencia emitida con paso de 2–5 Hz.
     *
     * @param centroHz frecuencia central (Hz)
     * @param spanHz anchura total del barrido (Hz)
     * @param pasoHz separación entre bines (Hz)
     */
    //% blockId=fisicabit_snd_lockin
    //% block="frecuencia lock-in alrededor de %centroHz Hz ± %spanHz paso %pasoHz"
    //% group="Detección de frecuencia" weight=85
    //% centroHz.defl=4000 spanHz.defl=200 pasoHz.defl=5
    //% centroHz.min=100 centroHz.max=10000
    //% spanHz.min=10 spanHz.max=2000
    //% pasoHz.min=1 pasoHz.max=50
    export function lockInFrecuencia(centroHz: number, spanHz: number, pasoHz: number): number {
        if (!_capturado) return 0
        if (pasoHz < 1) pasoHz = 1
        const desde = centroHz - spanHz / 2
        const hasta = centroHz + spanHz / 2
        let mejorHz = centroHz
        let mejorMag = -1
        for (let f = desde; f <= hasta; f += pasoHz) {
            const m = FisicaBitAudioNative.audioGoertzel(Math.round(f * 100))
            if (m > mejorMag) {
                mejorMag = m
                mejorHz = f
            }
        }
        // Refinado parabólico: si tenemos vecinos válidos, ajustamos el pico.
        if (mejorHz > desde && mejorHz < hasta && pasoHz >= 1) {
            const mM = FisicaBitAudioNative.audioGoertzel(Math.round((mejorHz - pasoHz) * 100))
            const mP = FisicaBitAudioNative.audioGoertzel(Math.round((mejorHz + pasoHz) * 100))
            const denom = 2 * (2 * mejorMag - mM - mP)
            if (denom != 0) {
                const delta = (mP - mM) / denom
                if (delta > -1 && delta < 1) {
                    mejorHz = mejorHz + delta * pasoHz
                }
            }
        }
        return Math.round(mejorHz * 100) / 100
    }

    // =========================================================================
    // Bloques — Mic INTERNO v2 (detección de frecuencia y notas musicales)
    // =========================================================================
    //
    // Estos bloques usan EXCLUSIVAMENTE el micrófono interno de la micro:bit
    // v2 (no hacen falta mic externos ni cableado). Internamente capturan
    // muestras crudas del pipeline PDM a través del StreamSplitter de CODAL.
    //
    // LÍMITES FÍSICOS del micrófono PDM interno:
    //   • Sample rate ~11 kHz → Nyquist ~5.5 kHz
    //   • Filtro pasa-alta del decimador → atenuación por debajo de ~80 Hz
    //   • Rango ÚTIL en la práctica: 80 Hz – 4000 Hz
    //
    // Este rango cubre todas las notas musicales comunes:
    //   E2 (82.4 Hz)  — cuerda Mi grave de guitarra/bajo
    //   A2 (110 Hz)   — La grave
    //   C4 (261.6 Hz) — Do central
    //   A4 (440 Hz)   — La de afinación (diapasón)
    //   C5 (523.3 Hz) — Do 5
    //   A5 (880 Hz)
    //   C7 (2093 Hz)  — Do agudo piano
    //   C8 (4186 Hz)  — límite práctico superior
    //
    // No cubre 20 Hz (infrasonidos) ni 20 kHz (ultrasonidos): esas
    // frecuencias son físicamente inaccesibles para el PDM de la placa.
    // =========================================================================

    /**
     * Bloque "todo en uno" para arrastrar directamente a un `forever`:
     * captura audio del MICRÓFONO INTERNO de la micro:bit v2 y devuelve
     * la frecuencia fundamental en Hz. Sin parámetros, sin cableado.
     *
     *   forever:
     *       let f = FisicaBitSonido.detectarFrecuencia()
     *       basic.showNumber(f)
     *
     * Usa internamente:
     *   • Micrófono PDM interno v2 (vía StreamSplitter de CODAL)
     *   • 512 muestras @ ~11 kHz (ventana de ~46 ms)
     *   • Autocorrelación con interpolación parabólica sub-muestra
     *   • Rango 60 – 4500 Hz (E2 grave hasta C8 agudo)
     *   • Gating por RMS (silencios devuelven 0)
     *
     * Devuelve 0 si no hay suficiente señal o si corre en v1 (sin mic).
     * En el simulador devuelve 440 Hz (A4) como tono de prueba.
     */
    //% blockId=fisicabit_snd_detectar_frecuencia
    //% block="detectar frecuencia (Hz)"
    //% group="Detección de frecuencia" weight=110
    export function detectarFrecuencia(): number {
        return frecuenciaInternaV2()
    }

    /**
     * Bloque "todo en uno" para detectar la nota musical más cercana al
     * sonido captado por el micrófono INTERNO de la v2, sin cableado.
     *
     *   forever:
     *       basic.showString(FisicaBitSonido.detectarNota())
     *
     * Devuelve el nombre con notación MIDI estándar (A4, C#5, ...) o
     * "—" si no hay señal suficiente. En el simulador devuelve "A4".
     */
    //% blockId=fisicabit_snd_detectar_nota
    //% block="detectar nota musical"
    //% group="Detección de frecuencia" weight=108
    export function detectarNota(): string {
        const f = detectarFrecuencia()
        if (f <= 0) return "—"
        return nombreNota(f)
    }

    /**
     * Detecta la frecuencia dominante del sonido captado por el MICRÓFONO
     * INTERNO de la micro:bit v2, sin hardware adicional.
     *
     * Captura una ventana de audio del pipeline PDM (~23 ms con 256 muestras
     * a 11 kHz), aplica autocorrelación con interpolación parabólica y
     * devuelve la frecuencia en Hz con 2 decimales.
     *
     * Rango útil ~80 Hz – 4000 Hz (limitado por el mic PDM interno).
     * Si el nivel de sonido es inferior a `umbralRms`, devuelve 0.
     *
     * @param umbralRms umbral mínimo de amplitud para considerar la lectura
     */
    //% blockId=fisicabit_snd_freq_interna
    //% block="frecuencia del micrófono interno (Hz)"
    //% group="Detección de frecuencia" weight=80
    export function frecuenciaInternaV2(): number {
        // Usa el shim nativo de audio (sim/audio.ts en el simulador,
        // shims.cpp + StreamSplitter en hardware). Rango 60..4500 Hz —
        // el rango útil del PDM interno (E2 grave .. C8 agudo).
        return FisicaBitAudioNative.detectarFrecuenciaMicInterno(60, 4500, 512)
    }

    /**
     * Devuelve el nombre de la nota musical más cercana a una frecuencia
     * dada (notación de notas occidentales con octavas, p. ej. "A4").
     *
     * Usa la referencia estándar A4 = 440 Hz y la fórmula:
     *    n (MIDI) = 69 + 12 · log₂(f / 440)
     *
     * Devuelve "—" si la frecuencia está fuera de un rango razonable
     * (<20 Hz o >10 kHz).
     *
     * @param frecuenciaHz frecuencia en Hz
     */
    //% blockId=fisicabit_snd_nombre_nota
    //% block="nombre de la nota para %frecuenciaHz Hz"
    //% group="Detección de frecuencia" weight=78
    //% frecuenciaHz.defl=440
    export function nombreNota(frecuenciaHz: number): string {
        if (frecuenciaHz < 20 || frecuenciaHz > 10000) return "—"
        const midi = 69 + 12 * Math.log(frecuenciaHz / 440) / Math.log(2)
        const midiR = Math.round(midi)
        if (midiR < 0 || midiR > 127) return "—"
        const nombres = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        const octava = Math.floor(midiR / 12) - 1
        return nombres[midiR % 12] + octava
    }

    /**
     * Desviación en cents entre una frecuencia medida y la nota musical
     * más cercana. 100 cents = 1 semitono. Positivo = sostenido (un poco
     * por encima de la nota exacta), negativo = bemol.
     *
     * Rango típico: [-50, +50]. Útil para afinar instrumentos.
     *
     * @param frecuenciaHz frecuencia medida en Hz
     */
    //% blockId=fisicabit_snd_detune
    //% block="desafinación (cents) para %frecuenciaHz Hz"
    //% group="Detección de frecuencia" weight=76
    //% frecuenciaHz.defl=440
    export function desafinacionCents(frecuenciaHz: number): number {
        if (frecuenciaHz < 20) return 0
        const midi = 69 + 12 * Math.log(frecuenciaHz / 440) / Math.log(2)
        const cents = (midi - Math.round(midi)) * 100
        return Math.round(cents)
    }

    /**
     * Detecta la nota musical más cercana al sonido captado por el
     * MICRÓFONO INTERNO de la micro:bit v2. Un solo paso: captura PDM
     * + autocorrelación + conversión a nombre de nota.
     *
     * Rango práctico: E2 (82 Hz) .. C8 (4186 Hz).
     * Devuelve "—" si no hay suficiente señal.
     */
    //% blockId=fisicabit_snd_nota_interna
    //% block="nota detectada por el micrófono interno"
    //% group="Detección de frecuencia" weight=82
    export function notaInternaV2(): string {
        const f = frecuenciaInternaV2()
        if (f <= 0) return "—"
        return nombreNota(f)
    }

    /**
     * Frecuencia en Hz de una nota musical dada por su número MIDI.
     *
     * Mapeo MIDI estándar:
     *   21 = A0 (27.5 Hz)   60 = C4 (261.6 Hz)   69 = A4 (440 Hz)
     *   72 = C5             84 = C6              96 = C7
     *
     * @param midi número de nota MIDI (0..127)
     */
    //% blockId=fisicabit_snd_midi_a_hz
    //% block="frecuencia (Hz) de la nota MIDI %midi"
    //% group="Detección de frecuencia" weight=74
    //% midi.defl=69 midi.min=0 midi.max=127
    export function frecuenciaDeNotaMIDI(midi: number): number {
        const f = 440 * Math.pow(2, (midi - 69) / 12)
        return Math.round(f * 100) / 100
    }

    // =========================================================================
    // Bloques — Efecto Doppler
    // =========================================================================

    /**
     * Velocidad deducida del corrimiento Doppler entre una frecuencia emitida
     * y una observada.
     *
     * Fórmulas:
     *    f_obs = f₀ · (c + vₒ) / (c − vₛ)
     *    vₛ = c · (1 − f₀ / f_obs)     (observador en reposo)
     *    vₒ = c · (f_obs / f₀ − 1)     (fuente en reposo)
     *
     * Convenio de signos: velocidad POSITIVA = la fuente/observador se
     * ACERCA; negativa = se ALEJA.
     *
     * @param fEmitida frecuencia real emitida por la fuente (Hz)
     * @param fObservada frecuencia detectada por el micrófono (Hz)
     * @param velocidadSonido velocidad del sonido en el medio (m/s, típico 343)
     * @param variable qué velocidad se quiere calcular
     * @param unidad unidad de salida
     */
    //% blockId=fisicabit_snd_doppler_v
    //% block="velocidad Doppler: emitida %fEmitida Hz, observada %fObservada Hz (c=%velocidadSonido m/s) → %variable en %unidad"
    //% group="Efecto Doppler" weight=100
    //% fEmitida.defl=4000 fObservada.defl=4000
    //% velocidadSonido.defl=343
    //% variable.defl=VariableDoppler.VelocidadFuente
    //% unidad.defl=UnidadVelocidad.MetrosPorSegundo
    //% inlineInputMode=external
    export function velocidadDoppler(
        fEmitida: number,
        fObservada: number,
        velocidadSonido: number,
        variable: VariableDoppler,
        unidad: UnidadVelocidad
    ): number {
        if (fEmitida <= 0 || fObservada <= 0 || velocidadSonido <= 0) return 0
        let v_ms = 0
        switch (variable) {
            case VariableDoppler.VelocidadFuente:
                // vₛ = c · (1 − f₀ / f_obs)
                v_ms = velocidadSonido * (1 - fEmitida / fObservada)
                break
            case VariableDoppler.VelocidadObservador:
                // vₒ = c · (f_obs / f₀ − 1)
                v_ms = velocidadSonido * (fObservada / fEmitida - 1)
                break
        }
        if (unidad == UnidadVelocidad.KilometrosPorHora) v_ms = v_ms * 3.6
        return Math.round(v_ms * 100) / 100
    }

    /**
     * Frecuencia que se esperaría observar para una velocidad dada.
     * Útil para COMPROBAR prácticas: calcula la frecuencia "teórica" y
     * compárala con la que devuelve el micrófono.
     *
     *    f_obs = f₀ · (c + vₒ) / (c − vₛ)
     *
     * @param fEmitida frecuencia emitida (Hz)
     * @param velocidadFuente velocidad de la fuente (m/s, + acercándose)
     * @param velocidadObservador velocidad del observador (m/s, + acercándose)
     * @param velocidadSonido velocidad del sonido (m/s)
     */
    //% blockId=fisicabit_snd_doppler_f
    //% block="frecuencia observada esperada: emitida %fEmitida Hz, fuente %velocidadFuente m/s, observador %velocidadObservador m/s (c=%velocidadSonido m/s)"
    //% group="Efecto Doppler" weight=95
    //% fEmitida.defl=4000
    //% velocidadFuente.defl=0 velocidadObservador.defl=0
    //% velocidadSonido.defl=343
    //% inlineInputMode=external
    export function frecuenciaDopplerEsperada(
        fEmitida: number,
        velocidadFuente: number,
        velocidadObservador: number,
        velocidadSonido: number
    ): number {
        if (velocidadSonido <= 0) return 0
        const denom = velocidadSonido - velocidadFuente
        if (denom == 0) return 0
        const fObs = fEmitida * (velocidadSonido + velocidadObservador) / denom
        return Math.round(fObs * 100) / 100
    }

    /**
     * Velocidad del sonido en el aire a una temperatura dada en °C.
     * Aproximación clásica: c ≈ 331.3 + 0.606·T  (m/s).
     *
     * @param temperaturaC temperatura del aire en °C
     */
    //% blockId=fisicabit_snd_c_sonido
    //% block="velocidad del sonido en el aire a %temperaturaC °C"
    //% group="Efecto Doppler" weight=90
    //% temperaturaC.defl=20
    export function velocidadSonidoAire(temperaturaC: number): number {
        return Math.round((331.3 + 0.606 * temperaturaC) * 100) / 100
    }

    // =========================================================================
    // Bloques — Avanzados (acceso directo al buffer)
    // =========================================================================

    /**
     * Número de muestras disponibles en el último buffer capturado.
     */
    //% blockId=fisicabit_snd_buf_len
    //% block="largo del buffer"
    //% group="Avanzado" weight=100
    //% advanced=true
    export function longitudBuffer(): number {
        return FisicaBitAudioNative.audioLongitudBuffer()
    }

    /**
     * Muestra en el índice `i` del último buffer capturado (valor ADC crudo).
     *
     * @param i índice (0 .. buffer length − 1)
     */
    //% blockId=fisicabit_snd_buf_get
    //% block="muestra en índice %i"
    //% group="Avanzado" weight=95
    //% advanced=true
    //% i.min=0 i.max=1023
    export function muestraEn(i: number): number {
        return FisicaBitAudioNative.audioLeerMuestra(i)
    }

    /**
     * Offset DC (media) estimado en la última captura.
     */
    //% blockId=fisicabit_snd_dc
    //% block="offset DC de la última ventana"
    //% group="Avanzado" weight=90
    //% advanced=true
    export function offsetDC(): number {
        return FisicaBitAudioNative.audioOffsetDC()
    }

    /**
     * Sample rate efectivo (Hz) de la última captura.
     */
    //% blockId=fisicabit_snd_rate
    //% block="tasa de muestreo efectiva (Hz)"
    //% group="Avanzado" weight=85
    //% advanced=true
    export function tasaMuestreoEfectiva(): number {
        return FisicaBitAudioNative.audioTasaMuestreo()
    }
}
