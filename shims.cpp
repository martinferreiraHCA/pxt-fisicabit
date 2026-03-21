// =============================================================================
// shims.cpp — Código nativo C++ para acceso directo al hardware
// =============================================================================
//
// PROPÓSITO:
// Este archivo contiene funciones C++ que se ejecutan directamente en el
// procesador ARM Cortex-M4 del micro:bit v2 (chip nRF52833).
//
// ¿POR QUÉ USAR C++ EN VEZ DE TYPESCRIPT?
// ─────────────────────────────────────────
// 1. VELOCIDAD: C++ compilado es 10-100x más rápido que TypeScript
// 2. PRECISIÓN TEMPORAL: Acceso directo a timers de hardware (16MHz)
// 3. REGISTROS HARDWARE: Manipulación directa de periféricos del nRF52
// 4. INTERRUPCIONES: Manejo de interrupciones de hardware
// 5. RESOLUCIÓN ADC: Acceso al ADC completo de 12 bits (vs 10 bits en TS)
//
// ARQUITECTURA DEL nRF52833 (micro:bit v2):
// ──────────────────────────────────────────
// - CPU: ARM Cortex-M4F @ 64MHz con FPU
// - RAM: 128KB
// - Flash: 512KB
// - ADC: SAADC de 12 bits, 8 canales
// - GPIO: 48 pines (no todos expuestos en el conector)
// - Timers: TIMER0-4 (32 bits, 16MHz)
// - Radio: Bluetooth 5.0 + 802.15.4
//
// CÓMO AGREGAR UNA NUEVA FUNCIÓN NATIVA:
// ───────────────────────────────────────
// 1. Escribir la función aquí dentro del namespace fisicabit_native
// 2. Declararla en shims.d.ts con //% shim=fisicabit_native::nombre
// 3. Crear wrapper en fisicabit.ts con //% shim=... (fallback simulador)
// 4. MakeCode enlaza todo automáticamente al compilar
//
// INCLUDES DEL SISTEMA CODAL:
// ───────────────────────────
// #include "pxt.h" → Macros de PXT (el runtime de MakeCode)
//   - MicroBit *uBit  → Puntero al objeto principal del micro:bit
//   - DMESG()         → Debug por serie (solo en modo debug)
//   - fromInt()/toInt() → Conversión entre tipos PXT y C++
//
// =============================================================================

#include "pxt.h"

// Para acceso directo a registros del nRF52833
// Estos headers definen las direcciones de memoria de los periféricos
#if MICROBIT_CODAL
#include "NRF52ADC.h"
#include "Timer.h"
#endif

// =============================================================================
// NAMESPACE: fisicabit_native
// =============================================================================
// IMPORTANTE: El nombre del namespace DEBE coincidir exactamente con:
//   1. El namespace en shims.d.ts
//   2. El valor de //% shim= en fisicabit.ts
// =============================================================================
namespace fisicabit_native {

    // =========================================================================
    // leerADCNativo — Lectura directa del ADC (SAADC) del nRF52833
    // =========================================================================
    //
    // El SAADC (Successive Approximation ADC) del nRF52833:
    //   - Resolución: 8/10/12/14 bits (configurable)
    //   - Velocidad: hasta 200ksps
    //   - Canales: 8 canales single-ended o 4 diferenciales
    //   - Referencia: interna (0.6V) o VDD/4
    //   - Ganancia: 1/6, 1/5, 1/4, 1/3, 1/2, 1, 2, 4
    //
    // MAPA DE CANALES ADC → PINES:
    //   Canal 0 → AIN0 → P0.02 → micro:bit P0
    //   Canal 1 → AIN1 → P0.03 → micro:bit P1
    //   Canal 2 → AIN2 → P0.04 → micro:bit P2
    //   Canal 3 → AIN3 → P0.05 → (interno)
    //   Canal 4 → AIN4 → P0.28 → (interno)
    //   Canal 5 → AIN5 → P0.29 → (interno)
    //   Canal 6 → AIN6 → P0.30 → (interno)
    //   Canal 7 → AIN7 → P0.31 → (interno)
    //
    // REGISTROS DEL SAADC (direcciones base: 0x40007000):
    //   NRF_SAADC->TASKS_START       → Iniciar conversión
    //   NRF_SAADC->TASKS_SAMPLE      → Tomar una muestra
    //   NRF_SAADC->EVENTS_END        → Conversión completada
    //   NRF_SAADC->RESULT.PTR        → Puntero al buffer de resultados
    //   NRF_SAADC->CH[n].PSELP       → Selección de canal positivo
    //   NRF_SAADC->CH[n].CONFIG      → Configuración del canal
    //   NRF_SAADC->RESOLUTION        → Resolución (8/10/12/14 bits)
    //
    // =========================================================================

    //%
    int leerADCNativo(int canal) {
        // ── Validar canal ──
        // Solo canales 0-7 son válidos en el nRF52833
        if (canal < 0 || canal > 7) {
            return -1;  // Error: canal inválido
        }

        #if MICROBIT_CODAL
        // ══════════════════════════════════════════════════════
        // ACCESO DIRECTO A REGISTROS DEL SAADC
        // ══════════════════════════════════════════════════════
        // Esto es MUCHO más rápido que usar la API de CODAL
        // porque evitamos todas las capas de abstracción.
        // ══════════════════════════════════════════════════════

        volatile int16_t resultado;  // volatile: evita optimización del compilador

        // 1. Habilitar el SAADC
        NRF_SAADC->ENABLE = SAADC_ENABLE_ENABLE_Enabled;

        // 2. Configurar resolución a 12 bits
        NRF_SAADC->RESOLUTION = SAADC_RESOLUTION_VAL_12bit;

        // 3. Configurar el canal
        //    PSELP: seleccionar entrada positiva (canal + 1, porque 0 = NC)
        //    PSELN: entrada negativa no conectada (single-ended)
        //    CONFIG: ganancia 1/6, referencia interna, 10μs adquisición
        NRF_SAADC->CH[0].PSELP = canal + 1;
        NRF_SAADC->CH[0].PSELN = SAADC_CH_PSELN_PSELN_NC;
        NRF_SAADC->CH[0].CONFIG =
            (SAADC_CH_CONFIG_GAIN_Gain1_6    << SAADC_CH_CONFIG_GAIN_Pos) |
            (SAADC_CH_CONFIG_REFSEL_Internal << SAADC_CH_CONFIG_REFSEL_Pos) |
            (SAADC_CH_CONFIG_TACQ_10us       << SAADC_CH_CONFIG_TACQ_Pos) |
            (SAADC_CH_CONFIG_MODE_SE         << SAADC_CH_CONFIG_MODE_Pos);

        // 4. Configurar buffer de resultado
        NRF_SAADC->RESULT.PTR = (uint32_t)&resultado;
        NRF_SAADC->RESULT.MAXCNT = 1;

        // 5. Iniciar conversión y esperar
        NRF_SAADC->EVENTS_END = 0;
        NRF_SAADC->TASKS_START = 1;
        NRF_SAADC->TASKS_SAMPLE = 1;

        // Esperar a que termine (polling)
        // En producción se usarían interrupciones, pero para una
        // lectura puntual, polling es más simple y suficiente.
        while (!NRF_SAADC->EVENTS_END) {
            // El bucle típicamente dura ~2μs a 64MHz
        }

        // 6. Limpiar y deshabilitar
        NRF_SAADC->EVENTS_END = 0;
        NRF_SAADC->TASKS_STOP = 1;
        NRF_SAADC->ENABLE = SAADC_ENABLE_ENABLE_Disabled;

        // El resultado puede ser negativo en modo diferencial,
        // pero en single-ended lo limitamos a 0
        return resultado < 0 ? 0 : (int)resultado;
        #else
        // Fallback para micro:bit v1 (DAL en vez de CODAL)
        return 0;
        #endif
    }


    // =========================================================================
    // medirPulsoNativo — Medición de pulso de alta precisión
    // =========================================================================
    //
    // TIMER del nRF52833:
    //   - Frecuencia base: 16MHz
    //   - Resolución mínima: 62.5ns (1/16MHz)
    //   - Prescaler: 0-9 (divide frecuencia por 2^prescaler)
    //   - Ancho: 32 bits → overflow cada ~268 segundos a 16MHz
    //
    // COMPARACIÓN DE PRECISIÓN:
    //   MakeCode (TS):  ~100μs de resolución (usa scheduler)
    //   Este código:     ~1μs de resolución (acceso directo a timer)
    //   Ensamblador:    ~62.5ns de resolución (ver asm_sensors.S)
    //
    // USO TÍPICO:
    //   - HC-SR04: pulsos de 150-25000μs
    //   - DHT11: pulsos de 20-80μs (necesita esta precisión)
    //   - Servo: pulsos de 500-2500μs
    //
    // =========================================================================

    //%
    int medirPulsoNativo(int pin, bool nivelAlto, int timeoutUs) {
        #if MICROBIT_CODAL
        // ── Obtener referencia al pin GPIO ──
        // getPin() convierte el número de pin de MakeCode al GPIO real
        auto &gpioPin = uBit.io.pin[pin];
        gpioPin.setDigitalValue(0);  // Configurar como entrada
        gpioPin.getDigitalValue();   // Forzar modo lectura

        // ── Obtener puntero al registro del puerto GPIO ──
        // NRF_P0->IN contiene el estado de todos los pines del puerto 0
        // Cada bit corresponde a un pin (bit 0 = P0.00, bit 1 = P0.01, etc.)
        volatile uint32_t *portIn = &NRF_P0->IN;

        // Máscara para el pin específico que queremos leer
        // Ejemplo: pin 2 → máscara = 0b00000100
        uint32_t mascara = 1 << pin;

        // ── Valor esperado ──
        // Si medimos pulso HIGH, esperamos que el bit esté en 1
        uint32_t valorEsperado = nivelAlto ? mascara : 0;

        // ── Usar el TIMER3 para temporización precisa ──
        NRF_TIMER3->TASKS_STOP = 1;
        NRF_TIMER3->TASKS_CLEAR = 1;
        NRF_TIMER3->PRESCALER = 4;  // 16MHz / 2^4 = 1MHz → 1 tick = 1μs
        NRF_TIMER3->BITMODE = TIMER_BITMODE_BITMODE_32Bit;
        NRF_TIMER3->TASKS_START = 1;

        // ── Fase 1: Esperar a que el pulso comience ──
        // Si el pin ya está en el nivel esperado, esperamos a que cambie primero
        while ((*portIn & mascara) == valorEsperado) {
            NRF_TIMER3->TASKS_CAPTURE[0] = 1;
            if (NRF_TIMER3->CC[0] > (uint32_t)timeoutUs) {
                NRF_TIMER3->TASKS_STOP = 1;
                return 0;  // Timeout
            }
        }

        // ── Fase 2: Esperar al inicio del pulso ──
        while ((*portIn & mascara) != valorEsperado) {
            NRF_TIMER3->TASKS_CAPTURE[0] = 1;
            if (NRF_TIMER3->CC[0] > (uint32_t)timeoutUs) {
                NRF_TIMER3->TASKS_STOP = 1;
                return 0;
            }
        }

        // ── Fase 3: Medir duración del pulso ──
        NRF_TIMER3->TASKS_CLEAR = 1;  // Reset del timer al inicio del pulso
        while ((*portIn & mascara) == valorEsperado) {
            NRF_TIMER3->TASKS_CAPTURE[0] = 1;
            if (NRF_TIMER3->CC[0] > (uint32_t)timeoutUs) {
                NRF_TIMER3->TASKS_STOP = 1;
                return 0;
            }
        }

        // ── Capturar tiempo final ──
        NRF_TIMER3->TASKS_CAPTURE[0] = 1;
        uint32_t duracion = NRF_TIMER3->CC[0];
        NRF_TIMER3->TASKS_STOP = 1;

        return (int)duracion;
        #else
        return 0;
        #endif
    }


    // =========================================================================
    // leerADCPromedio — Sobremuestreo para reducir ruido
    // =========================================================================
    //
    // TÉCNICA: SOBREMUESTREO (OVERSAMPLING)
    // ─────────────────────────────────────
    // Al promediar N muestras, se reduce el ruido por un factor de √N:
    //   - 4 muestras   → ruido reducido 2x   (~1 bit extra)
    //   - 16 muestras  → ruido reducido 4x   (~2 bits extra)
    //   - 64 muestras  → ruido reducido 8x   (~3 bits extra)
    //
    // Con 16 muestras de 12 bits, la resolución efectiva es ~14 bits.
    //
    // TIEMPO DE EJECUCIÓN:
    //   - 1 muestra:  ~5μs
    //   - 16 muestras: ~80μs
    //   - 64 muestras: ~320μs
    //
    // NOTA: El SAADC del nRF52 tiene oversample por hardware (hasta 256x)
    //       pero lo hacemos por software para mayor control y ejemplo.
    //
    // =========================================================================

    //%
    int leerADCPromedio(int canal, int muestras) {
        // ── Validar parámetros ──
        if (canal < 0 || canal > 7) return -1;
        if (muestras < 1) muestras = 1;
        if (muestras > 64) muestras = 64;

        // ── Acumular lecturas ──
        int32_t suma = 0;
        for (int i = 0; i < muestras; i++) {
            suma += leerADCNativo(canal);
        }

        // ── Devolver promedio ──
        return (int)(suma / muestras);
    }
}


// =============================================================================
// EJEMPLO: CÓMO AGREGAR FUNCIONES C++ ADICIONALES
// =============================================================================
//
// Para agregar, por ejemplo, una lectura rápida de temperatura interna:
//
// 1. En shims.cpp (este archivo), agregar:
//
//     //%
//     int leerTemperaturaInterna() {
//         #if MICROBIT_CODAL
//         NRF_TEMP->TASKS_START = 1;
//         while (!NRF_TEMP->EVENTS_DATARDY) {}
//         NRF_TEMP->EVENTS_DATARDY = 0;
//         int32_t temp = NRF_TEMP->TEMP;  // En cuartos de grado
//         NRF_TEMP->TASKS_STOP = 1;
//         return temp / 4;  // Convertir a grados enteros
//         #else
//         return 0;
//         #endif
//     }
//
// 2. En shims.d.ts, agregar:
//
//     //% shim=fisicabit_native::leerTemperaturaInterna
//     function leerTemperaturaInterna(): number;
//
// 3. En fisicabit.ts, agregar el bloque:
//
//     //% block="[C++] temperatura interna"
//     //% shim=fisicabit_native::leerTemperaturaInterna
//     export function leerTemperaturaInterna(): number {
//         return input.temperature()  // Fallback simulador
//     }
//
// =============================================================================
