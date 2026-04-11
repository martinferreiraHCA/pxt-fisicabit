// =============================================================================
//  sim/audio.ts — Binding JavaScript del simulador para los shims de audio
// =============================================================================
//
//  Este archivo SÓLO se compila para el simulador web de MakeCode (listado
//  en `pxt.json` bajo "simFiles"). Proporciona una implementación JS de las
//  funciones nativas declaradas en `shims.d.ts` con `//% shim=...`, para
//  que pxt pueda resolver `pxsim.fisicabit_native.xxx` y la extensión
//  cargue correctamente en el simulador.
//
//  En HARDWARE real (micro:bit v1/v2) este archivo NO se compila; en su
//  lugar se usa el C++ de `shims.cpp`.
//
//  Como estrategia, el stub devuelve un tono sintético de 440 Hz (A4) para
//  que los bloques de detección devuelvan valores coherentes al probarse
//  en el simulador — así los alumnos pueden validar la lógica de su
//  `forever` antes de flashear la placa.
// =============================================================================

namespace pxsim.fisicabit_native {

    /**
     * Simulador: devuelve 440 Hz (A4) en centi-Hz (= 44000) siempre,
     * como si el mic interno estuviera captando un diapasón estándar.
     *
     * Respeta el rango de búsqueda que pase el TypeScript: si la ventana
     * deseada excluye 440 Hz, lo acota al centro del rango buscado para
     * que el bloque `internal mic frequency` siga devolviendo algo útil.
     */
    export function audioInternoDetectarFrecuencia(
        numMuestras: number,
        minHzCenti: number,
        maxHzCenti: number
    ): number {
        const A4_CENTI = 44000  // 440.00 Hz
        // Si el rango de búsqueda incluye A4, devolvemos A4 exacto
        if (A4_CENTI >= minHzCenti && A4_CENTI <= maxHzCenti) {
            return A4_CENTI
        }
        // Si no, devolvemos el centro del rango buscado
        return Math.round((minHzCenti + maxHzCenti) / 2)
    }
}
