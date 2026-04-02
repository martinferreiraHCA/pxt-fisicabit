// =============================================================================
// shims.cpp — Código nativo C++ usando APIs CODAL (compatible con cloud)
// =============================================================================
//
// Usa las APIs oficiales de CODAL en vez de acceso directo a registros NRF52.
// Esto permite que MakeCode compile en la nube sin problemas.
//
// APIs usadas:
//   pxt::getPin(id)                → Obtener referencia a pin
//   pin->getAnalogValue()          → Lectura ADC (10-bit, escalada a 12-bit)
//   pin->getDigitalValue()         → Lectura digital
//   system_timer_current_time_us() → Timestamp en microsegundos
//
// =============================================================================

#include "pxt.h"

namespace fisicabit_native {

    // ── Helper: obtener pin por número (0-20) ──
    static MicroBitPin* getPinByNumber(int n) {
        if (n < 0 || n > 20) return NULL;
        return pxt::getPin(MICROBIT_ID_IO_P0 + n);
    }

    // =========================================================================
    // leerADCNativo — Lectura ADC usando CODAL
    // =========================================================================
    // Usa getAnalogValue() que devuelve 0-1023 (10-bit).
    // Escalamos a rango 0-4095 (12-bit) para compatibilidad.
    // =========================================================================

    //%
    int leerADCNativo(int canal) {
        if (canal < 0 || canal > 7) return -1;

        #if MICROBIT_CODAL
        MicroBitPin *pin = getPinByNumber(canal);
        if (!pin) return -1;

        // getAnalogValue() retorna 0-1023 (10-bit)
        int valor = pin->getAnalogValue();

        // Escalar a rango 12-bit (0-4095) para compatibilidad
        return valor * 4;
        #else
        return 0;
        #endif
    }

    // =========================================================================
    // medirPulsoNativo — Medición de pulso con system_timer
    // =========================================================================
    // Usa system_timer_current_time_us() para timing.
    // Precisión: ~1-5μs (suficiente para HC-SR04, DHT11, etc.)
    // =========================================================================

    //%
    int medirPulsoNativo(int pin, bool nivelAlto, int timeoutUs) {
        #if MICROBIT_CODAL
        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        // Forzar modo lectura digital
        gpioPin->getDigitalValue();

        int nivelBuscado = nivelAlto ? 1 : 0;
        uint64_t inicio = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Fase 1: Si ya está en el nivel buscado, esperar a que cambie
        while (gpioPin->getDigitalValue() == nivelBuscado) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }

        // Fase 2: Esperar a que comience el pulso
        while (gpioPin->getDigitalValue() != nivelBuscado) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }

        // Fase 3: Medir duración del pulso
        uint64_t t0 = system_timer_current_time_us();
        while (gpioPin->getDigitalValue() == nivelBuscado) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }
        uint64_t t1 = system_timer_current_time_us();

        return (int)(t1 - t0);
        #else
        return 0;
        #endif
    }

    // =========================================================================
    // leerADCPromedio — Sobremuestreo para reducir ruido
    // =========================================================================

    //%
    int leerADCPromedio(int canal, int muestras) {
        if (canal < 0 || canal > 7) return -1;
        if (muestras < 1) muestras = 1;
        if (muestras > 64) muestras = 64;

        int32_t suma = 0;
        for (int i = 0; i < muestras; i++) {
            suma += leerADCNativo(canal);
        }
        return (int)(suma / muestras);
    }

    // =========================================================================
    // medirTiempoBarreraNativo — Barrera óptica usando CODAL
    // =========================================================================
    // Modo 0 (Digital): Detecta transiciones HIGH→LOW con getDigitalValue()
    // Modo 1 (Analógico): Lee ADC y compara con umbral
    // Timing: system_timer_current_time_us() (~1-5μs de resolución)
    // =========================================================================

    //%
    int medirTiempoBarreraNativo(int pinA, int pinB, int modo, int umbralA, int umbralB, int timeoutUs) {
        #if MICROBIT_CODAL
        uint64_t tInicio = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        if (modo == 0) {
            // ── MODO DIGITAL (FC-33 y similares) ──
            MicroBitPin *gpA = getPinByNumber(pinA);
            MicroBitPin *gpB = getPinByNumber(pinB);
            if (!gpA || !gpB) return 0;

            // Forzar modo lectura
            gpA->getDigitalValue();
            gpB->getDigitalValue();

            // Fase 1: Esperar a que barrera A esté LIBRE (HIGH)
            while (gpA->getDigitalValue() == 0) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Fase 2: Esperar a que barrera A se ACTIVE (LOW = objeto llega)
            while (gpA->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Capturar T0
            uint64_t t0 = system_timer_current_time_us();

            // Fase 3: Esperar a que barrera B se ACTIVE (LOW)
            while (gpB->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Capturar T1
            uint64_t t1 = system_timer_current_time_us();

            return (int)(t1 - t0);

        } else {
            // ── MODO ANALÓGICO (IR DIY con fototransistor) ──
            // Umbrales ya vienen en rango 0-1023, escalar a 12-bit
            int umbralA_12 = umbralA * 4;
            int umbralB_12 = umbralB * 4;
            int canalA = pinA;
            int canalB = pinB;

            // Fase 1: Esperar a que barrera A esté LIBRE (lectura > umbral)
            while (leerADCNativo(canalA) < umbralA_12) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Fase 2: Esperar a que barrera A se ACTIVE (lectura < umbral)
            while (leerADCNativo(canalA) >= umbralA_12) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Capturar T0
            uint64_t t0 = system_timer_current_time_us();

            // Fase 3: Esperar a que barrera B se ACTIVE
            while (leerADCNativo(canalB) >= umbralB_12) {
                if (system_timer_current_time_us() - tInicio > maxTime)
                    return 0;
            }

            // Capturar T1
            uint64_t t1 = system_timer_current_time_us();

            return (int)(t1 - t0);
        }

        #else
        return 0;
        #endif
    }

    // =========================================================================
    // tcs3200LeerPeriodoUs — Mide un período completo en pin TCS3200
    // =========================================================================
    // Mide el tiempo entre dos flancos ascendentes consecutivos.
    // Retorna el período en microsegundos, 0 si timeout.
    // =========================================================================

    //%
    int tcs3200LeerPeriodoUs(int pin, int timeoutUs) {
        #if MICROBIT_CODAL
        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        gpioPin->getDigitalValue();

        uint64_t inicio = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Esperar a que baje (estar en estado conocido)
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }

        // Esperar primer flanco ascendente
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }
        uint64_t t0 = system_timer_current_time_us();

        // Esperar que baje
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }

        // Esperar segundo flanco ascendente
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }
        uint64_t t1 = system_timer_current_time_us();

        return (int)(t1 - t0);
        #else
        return 0;
        #endif
    }

    // =========================================================================
    // tcs3200LeerRafagaUs — Mide N períodos consecutivos, retorna promedio
    // =========================================================================

    //%
    int tcs3200LeerRafagaUs(int pin, int muestras, int timeoutUs) {
        #if MICROBIT_CODAL
        if (muestras < 1) muestras = 1;
        if (muestras > 50) muestras = 50;

        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        gpioPin->getDigitalValue();

        uint64_t inicio = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Sincronizar: esperar un flanco ascendente
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - inicio > maxTime)
                return 0;
        }

        uint64_t tInicio = system_timer_current_time_us();

        // Medir N períodos consecutivos
        for (int i = 0; i < muestras; i++) {
            // Esperar que baje
            while (gpioPin->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - inicio > maxTime)
                    return 0;
            }
            // Esperar que suba (siguiente flanco ascendente)
            while (gpioPin->getDigitalValue() == 0) {
                if (system_timer_current_time_us() - inicio > maxTime)
                    return 0;
            }
        }

        uint64_t tFin = system_timer_current_time_us();

        // Retornar promedio
        return (int)((tFin - tInicio) / muestras);
        #else
        return 0;
        #endif
    }
}
