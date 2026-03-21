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
}
