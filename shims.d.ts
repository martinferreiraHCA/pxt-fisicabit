// =============================================================================
// shims.d.ts — Declaraciones TypeScript para funciones nativas C++
// =============================================================================
//
// PROPÓSITO:
// Este archivo le dice a MakeCode qué funciones C++ existen y cómo llamarlas.
// Actúa como "puente" entre TypeScript y el código nativo de shims.cpp.
//
// CÓMO FUNCIONA:
// 1. Cada función declarada aquí tiene un //% shim=namespace::funcion
// 2. El nombre después de shim= debe coincidir EXACTAMENTE con el nombre
//    en shims.cpp (namespace y función)
// 3. MakeCode genera automáticamente el código de enlace al compilar
// 4. Los tipos se convierten automáticamente:
//    - number ↔ int (32 bits)
//    - boolean ↔ bool
//    - string ↔ String (ManagedString en CODAL)
//    - Buffer ↔ Buffer (puntero a datos)
//
// REGLA IMPORTANTE:
// El cuerpo de las funciones en fisicabit.ts (con //% shim=...) solo se
// ejecuta en el SIMULADOR. En hardware real, se ejecuta el código C++.
//
// =============================================================================

// Declaramos el namespace que contiene las funciones nativas
// El nombre DEBE coincidir con el namespace en shims.cpp
declare namespace fisicabit_native {

    /**
     * Lee directamente el ADC del nRF52833 sin capas de abstracción.
     * Más rápido que analogReadPin() porque evita la capa CODAL.
     *
     * Resolución: 12 bits (0-4095) vs 10 bits (0-1023) de MakeCode
     *
     * @param canal Canal ADC (0 = AIN0/P0.02, 1 = AIN1/P0.03, etc.)
     * @returns Valor ADC crudo de 12 bits (0-4095)
     */
    //% shim=fisicabit_native::leerADCNativo
    function leerADCNativo(canal: number): number;

    /**
     * Mide la duración de un pulso digital con precisión de μs.
     * Usa el timer de alta resolución del nRF52 (16MHz).
     *
     * @param pin Número del pin GPIO
     * @param nivelAlto true = medir pulso HIGH, false = pulso LOW
     * @param timeoutUs Timeout máximo en microsegundos
     * @returns Duración del pulso en microsegundos, 0 si timeout
     */
    //% shim=fisicabit_native::medirPulsoNativo
    function medirPulsoNativo(pin: number, nivelAlto: boolean, timeoutUs: number): number;

    /**
     * Lee múltiples muestras del ADC en modo ráfaga y devuelve el promedio.
     * Reduce el ruido eléctrico promediando lecturas consecutivas.
     *
     * Técnica: sobremuestreo (oversampling) para mejorar la resolución
     * efectiva. Con 16 muestras se gana ~2 bits adicionales de resolución.
     *
     * @param canal Canal ADC
     * @param muestras Número de muestras (1-64)
     * @returns Promedio de las lecturas ADC
     */
    //% shim=fisicabit_native::leerADCPromedio
    function leerADCPromedio(canal: number, muestras: number): number;

    /**
     * Mide el tiempo entre dos barreras ópticas con precisión de 1μs.
     * Usa TIMER3 del nRF52833 a 1MHz para máxima resolución temporal.
     *
     * Soporta dos modos:
     *   - Digital (modo=0): Lee GPIO directamente, detecta transición HIGH→LOW
     *     Ideal para FC-33 y módulos con salida digital
     *   - Analógico (modo=1): Lee SAADC y compara con umbral
     *     Ideal para montaje IR DIY con fototransistor
     *
     * FLUJO DE MEDICIÓN:
     *   1. Esperar a que barrera A esté libre (no activada)
     *   2. Esperar a que barrera A se active (objeto llega)
     *   3. Capturar timestamp con TIMER3 → T0
     *   4. Esperar a que barrera B se active (objeto llega)
     *   5. Capturar timestamp con TIMER3 → T1
     *   6. Retornar T1 - T0 en microsegundos
     *
     * @param pinA Número de pin de barrera A
     * @param pinB Número de pin de barrera B
     * @param modo 0=Digital, 1=Analógico
     * @param umbralA Umbral ADC para barrera A (solo modo analógico)
     * @param umbralB Umbral ADC para barrera B (solo modo analógico)
     * @param timeoutUs Timeout en microsegundos
     * @returns Tiempo en microsegundos, 0 si timeout
     */
    //% shim=fisicabit_native::medirTiempoBarreraNativo
    function medirTiempoBarreraNativo(
        pinA: number, pinB: number, modo: number,
        umbralA: number, umbralB: number, timeoutUs: number
    ): number;

    /**
     * Mide un período completo de la señal del TCS3200 (flanco ascendente a flanco ascendente).
     * Usa system_timer para timing con precisión de ~1-5μs.
     *
     * @param pin Número del pin de salida (OUT) del TCS3200
     * @param timeoutUs Timeout máximo en microsegundos
     * @returns Período en microsegundos, 0 si timeout
     */
    //% shim=fisicabit_native::tcs3200LeerPeriodoUs
    function tcs3200LeerPeriodoUs(pin: number, timeoutUs: number): number;

    /**
     * Mide N períodos consecutivos del TCS3200 y retorna el promedio.
     * Más preciso que una sola lectura al promediar múltiples períodos.
     *
     * @param pin Número del pin de salida (OUT) del TCS3200
     * @param muestras Número de períodos a medir (1-50)
     * @param timeoutUs Timeout máximo en microsegundos
     * @returns Período promedio en microsegundos, 0 si timeout
     */
    //% shim=fisicabit_native::tcs3200LeerRafagaUs
    function tcs3200LeerRafagaUs(pin: number, muestras: number, timeoutUs: number): number;

    // ─────────────────────────────────────────────────────────────────────
    // SONIDO — Micrófono interno v2 (único shim nativo de audio)
    // ─────────────────────────────────────────────────────────────────────
    //
    // Sólo exponemos UN shim nativo para el audio, y únicamente para la ruta
    // del micrófono interno PDM de la micro:bit v2 (el único caso en que
    // TypeScript puro no llega — necesita el StreamSplitter de CODAL).
    // El resto de la tubería de audio (electret externo en P0/P1/P2) está
    // en TypeScript puro dentro de `audio_shims.ts`.
    //
    // Sin binding JS para el simulador: confiamos en la detección de
    // entorno en `audio_shims.ts` (FisicaBitAudioNative._isSim, basada
    // en control.deviceSerialNumber) para que esta función NUNCA se
    // invoque desde el simulador. El shim sólo se ejecuta en hardware.
    //
    // Captura una ventana del mic PDM interno, calcula el offset DC,
    // corre autocorrelación con interpolación parabólica sub-muestra y
    // devuelve la frecuencia fundamental en centi-Hz (Hz × 100). Devuelve
    // 0 en silencio, error o si se ejecuta en v1 (sin mic interno).

    //% shim=fisicabit_native::audioInternoDetectarFrecuencia
    function audioInternoDetectarFrecuencia(
        numMuestras: number,
        minHzCenti: number,
        maxHzCenti: number
    ): number;
}
