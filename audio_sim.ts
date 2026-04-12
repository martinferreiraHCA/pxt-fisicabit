// =============================================================================
//  audio_sim.ts — Binding JavaScript para el simulador de MakeCode
// =============================================================================
//
//  Este archivo implementa el patrón canónico de pxt para proporcionar
//  un binding JS a un shim C++: un `namespace pxsim.fisicabit_native`
//  con funciones TypeScript que pxt compila ÚNICAMENTE al bundle del
//  simulador y OMITE en la compilación de hardware.
//
//  Mecanismo pxt:
//    - Cuando pxt ve `namespace pxsim.xxx { ... }`, lo marca como código
//      exclusivo del simulador.
//    - Al compilar el bundle del simulador, lo incluye → `pxsim.xxx`
//      queda disponible en tiempo de ejecución como objeto JavaScript.
//    - Al compilar a hardware (TS → C++ → ARM), el archivo se ignora.
//
//  Por qué va aquí (no en una subcarpeta sim/):
//    La versión anterior (v0.5.0) puso el binding en `sim/audio.ts`
//    listado bajo `simFiles` en pxt.json. En las extensiones externas
//    esta ruta no termina de cargar en algunos targets de MakeCode.
//    El patrón "archivo en la raíz, dentro del array `files`" es el que
//    usan extensiones como pxt-neopixel y funciona universalmente.
// =============================================================================

// Declaración ambient mínima del runtime pxsim para que el compilador de
// TypeScript de pxt no se queje del símbolo global `pxsim` al compilar
// este archivo. En el simulador, `pxsim` es el objeto raíz del runtime
// JavaScript; en hardware, este archivo entero se omite.
declare namespace pxsim {
}

// Binding del shim `fisicabit_native::audioInternoDetectarFrecuencia`
// declarado en `shims.d.ts`. Cuando el código de usuario llame a
// `FisicaBitAudioNative.detectarFrecuenciaMicInterno(...)` desde un
// `forever`, pxt lo traduce en el simulador a
// `pxsim.fisicabit_native.audioInternoDetectarFrecuencia(...)` — y
// gracias a este archivo, esa ruta existe y devuelve un valor
// razonable en vez de estallar con "Cannot read properties of undefined".
namespace pxsim.fisicabit_native {

    /**
     * Stub del simulador para la detección de frecuencia con el mic
     * interno. Devuelve 440 Hz (A4, en centi-Hz → 44000) siempre que el
     * rango de búsqueda lo permita, o el centro del rango en caso
     * contrario. Así el alumno ve un valor coherente al probar su
     * programa en la web antes de flashear la placa.
     */
    export function audioInternoDetectarFrecuencia(
        numMuestras: number,
        minHzCenti: number,
        maxHzCenti: number
    ): number {
        const A4_CENTI = 44000   // 440.00 Hz expresado en centi-Hz
        if (A4_CENTI >= minHzCenti && A4_CENTI <= maxHzCenti) {
            return A4_CENTI
        }
        return Math.round((minHzCenti + maxHzCenti) / 2)
    }
}
