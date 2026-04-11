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
#include <math.h>

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

    // =========================================================================
    // SONIDO — Muestreo + DSP para detección de frecuencia
    // =========================================================================
    //
    // Filosofía:
    //   1) `audioMuestrear()` captura N muestras del ADC de un pin analógico
    //      a intervalos constantes (sample rate fijo), calcula el offset DC
    //      (media) y lo guarda en un buffer estático interno.
    //   2) Las funciones de análisis (ZC, autocorrelación, Goertzel, RMS)
    //      operan sobre ese buffer sin necesidad de copiarlo a TypeScript.
    //
    // Buffer máximo: 1024 muestras de 16 bits = 2 KB de RAM.
    // Sample rate típico: 2–16 kHz (ADC CODAL soporta cómodamente hasta ~20k).
    //
    // Todas las frecuencias se devuelven en CENTI-HERZ (Hz × 100) para tener
    // precisión de 0.01 Hz sin usar punto flotante en la interfaz del shim.
    // =========================================================================

    #define FISICABIT_AUDIO_MAX_SAMPLES 1024

    static int16_t _audioBuffer[FISICABIT_AUDIO_MAX_SAMPLES];
    static int     _audioBufLen      = 0;
    static int     _audioSampleRate  = 0;
    static int     _audioDcOffset    = 0;

    // ---------------------------------------------------------------------
    // audioMuestrear — Captura N muestras a sampleRateHz constante
    // ---------------------------------------------------------------------
    // canal         → número de pin (0 = P0, 1 = P1, 2 = P2)
    // sampleRateHz  → 500..20000 Hz
    // numMuestras   → 16..1024
    //
    // Devuelve:
    //   > 0 → offset DC medido (media aritmética de las muestras)
    //   -1  → error
    // ---------------------------------------------------------------------

    //%
    int audioMuestrear(int canal, int sampleRateHz, int numMuestras) {
        if (numMuestras < 16) numMuestras = 16;
        if (numMuestras > FISICABIT_AUDIO_MAX_SAMPLES)
            numMuestras = FISICABIT_AUDIO_MAX_SAMPLES;
        if (sampleRateHz < 500)   sampleRateHz = 500;
        if (sampleRateHz > 20000) sampleRateHz = 20000;

        _audioBufLen     = numMuestras;
        _audioSampleRate = sampleRateHz;
        _audioDcOffset   = 0;

        #if MICROBIT_CODAL
        MicroBitPin *pin = getPinByNumber(canal);
        if (!pin) { _audioBufLen = 0; return -1; }

        // Primera lectura para forzar modo analógico y arrancar el SAADC
        pin->getAnalogValue();

        const int64_t intervaloUs = 1000000 / sampleRateHz;
        int64_t proximoTick = (int64_t)system_timer_current_time_us();
        int32_t suma = 0;

        for (int i = 0; i < numMuestras; i++) {
            // Espera activa hasta el siguiente tick (timing determinista)
            while (((int64_t)system_timer_current_time_us() - proximoTick) < 0) { }

            int v = pin->getAnalogValue();      // 0..1023
            _audioBuffer[i] = (int16_t)v;
            suma += v;
            proximoTick += intervaloUs;
        }

        _audioDcOffset = (int)(suma / numMuestras);
        return _audioDcOffset;
        #else
        _audioBufLen = 0;
        return -1;
        #endif
    }

    // ---------------------------------------------------------------------
    // audioLeerMuestra — Accede al buffer por índice (para graficar/depurar)
    // ---------------------------------------------------------------------

    //%
    int audioLeerMuestra(int indice) {
        if (indice < 0 || indice >= _audioBufLen) return 0;
        return (int)_audioBuffer[indice];
    }

    //%
    int audioLongitudBuffer() {
        return _audioBufLen;
    }

    //%
    int audioTasaMuestreo() {
        return _audioSampleRate;
    }

    //%
    int audioOffsetDC() {
        return _audioDcOffset;
    }

    // ---------------------------------------------------------------------
    // audioFrecuenciaZC — Cruces por cero (zero-crossing rate)
    // ---------------------------------------------------------------------
    // Algoritmo:
    //   1) Resta el offset DC a cada muestra (señal centrada en 0).
    //   2) Cuenta cuántas veces el signo cambia entre muestras consecutivas.
    //   3) f = (cruces / 2) × (sample_rate / N)
    //
    // Rápido (O(N)), funciona bien con tonos puros y niveles de ruido bajos.
    // Sensible al ruido: si hay varias componentes, cuenta cruces de todas.
    // Devuelve frecuencia en centi-Hz (Hz × 100), o 0 si no hay datos.
    // ---------------------------------------------------------------------

    //%
    int audioFrecuenciaZC() {
        if (_audioBufLen < 8 || _audioSampleRate <= 0) return 0;

        int cruces = 0;
        int32_t prev = (int32_t)_audioBuffer[0] - _audioDcOffset;

        for (int i = 1; i < _audioBufLen; i++) {
            int32_t cur = (int32_t)_audioBuffer[i] - _audioDcOffset;
            // Cuenta un cruce sólo si el signo cambia de verdad
            if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) {
                cruces++;
            }
            prev = cur;
        }

        // f [Hz] = (cruces * rate) / (2 * N)
        // centi-Hz = f * 100
        int64_t centiHz = ((int64_t)cruces * (int64_t)_audioSampleRate * 100)
                          / (int64_t)(2 * _audioBufLen);
        return (int)centiHz;
    }

    // Autocorrelación sin normalizar en un lag concreto (helper interno)
    static double _autocorrEnLag(int lag) {
        int n = _audioBufLen - lag;
        if (n <= 0) return 0.0;

        int64_t suma = 0;
        for (int i = 0; i < n; i++) {
            int32_t a = (int32_t)_audioBuffer[i]       - _audioDcOffset;
            int32_t b = (int32_t)_audioBuffer[i + lag] - _audioDcOffset;
            suma += (int64_t)a * (int64_t)b;
        }
        return (double)suma / (double)n;
    }

    // ---------------------------------------------------------------------
    // audioFrecuenciaAutocorr — Autocorrelación + interpolación parabólica
    // ---------------------------------------------------------------------
    // Algoritmo:
    //   1) Para cada retardo τ en [minLag, maxLag] calcula R(τ) = Σ x[i]·x[i+τ]
    //   2) Encuentra el τ* con máximo R.
    //   3) Refina τ* con interpolación parabólica sobre (τ*-1, τ*, τ*+1)
    //      → precisión sub-muestra.
    //   4) f = sample_rate / τ*_refinado
    //
    // Mucho más robusto al ruido que zero-crossing; es la mejor opción para
    // detección de tono único (silbatos, diapasón, fuente Doppler).
    // Coste ≈ (maxLag - minLag) × N multiplicaciones.
    //
    // Devuelve frecuencia en centi-Hz. minHz/maxHz acotan el rango buscado.
    // ---------------------------------------------------------------------

    //%
    int audioFrecuenciaAutocorr(int minHz, int maxHz) {
        if (_audioBufLen < 32 || _audioSampleRate <= 0) return 0;
        if (minHz < 20) minHz = 20;
        if (maxHz <= minHz) maxHz = minHz + 1;
        if (maxHz > _audioSampleRate / 2) maxHz = _audioSampleRate / 2;

        int minLag = _audioSampleRate / maxHz;
        int maxLag = _audioSampleRate / minHz;
        if (minLag < 2) minLag = 2;
        if (maxLag >= _audioBufLen) maxLag = _audioBufLen - 2;
        if (maxLag <= minLag) return 0;

        // Normalización: la primera muestra R(minLag) se toma como referencia
        // y buscamos el máximo en sentido descendente-ascendente. Aun así
        // comparamos valores absolutos de R para encontrar el pico.
        double mejorScore = -1e300;
        int    mejorLag   = minLag;

        for (int lag = minLag; lag <= maxLag; lag++) {
            double score = _autocorrEnLag(lag);
            if (score > mejorScore) {
                mejorScore = score;
                mejorLag   = lag;
            }
        }

        if (mejorScore <= 0.0) return 0;

        // Interpolación parabólica sub-muestra usando (lag-1, lag, lag+1)
        double lagRefinado = (double)mejorLag;
        if (mejorLag > minLag && mejorLag < maxLag) {
            double yM = _autocorrEnLag(mejorLag - 1);
            double y0 = mejorScore;
            double yP = _autocorrEnLag(mejorLag + 1);
            double denom = 2.0 * (2.0 * y0 - yM - yP);
            if (denom != 0.0) {
                double delta = (yP - yM) / denom;
                if (delta > -1.0 && delta < 1.0) {
                    lagRefinado = (double)mejorLag + delta;
                }
            }
        }

        if (lagRefinado < 1.0) return 0;

        double freq = (double)_audioSampleRate / lagRefinado;
        return (int)(freq * 100.0 + 0.5);
    }

    // ---------------------------------------------------------------------
    // audioGoertzel — Potencia en una frecuencia objetivo concreta
    // ---------------------------------------------------------------------
    // Implementa el algoritmo de Goertzel, equivalente a 1 bin de FFT pero
    // O(N) y sin memoria auxiliar. Ideal para:
    //   - Detectar presencia de un tono conocido (emisor a 4 kHz, etc.)
    //   - Tracking fino de corrimientos Doppler: barrer varios bines en torno
    //     a la frecuencia emitida y quedarse con el de mayor potencia.
    //
    // targetHzCenti → frecuencia objetivo en centi-Hz (ej. 440 Hz → 44000)
    //
    // Devuelve magnitud (amplitud) del bin, escalada por 1000/N para que
    // valores del orden de ~50–2000 sean habituales con tonos normales.
    // ---------------------------------------------------------------------

    //%
    int audioGoertzel(int targetHzCenti) {
        if (_audioBufLen < 16 || _audioSampleRate <= 0) return 0;
        if (targetHzCenti <= 0) return 0;

        double targetHz = (double)targetHzCenti / 100.0;
        double omega    = 2.0 * 3.14159265358979323846 * targetHz
                          / (double)_audioSampleRate;
        double coeff    = 2.0 * cos(omega);

        double q0 = 0.0, q1 = 0.0, q2 = 0.0;
        for (int i = 0; i < _audioBufLen; i++) {
            double x = (double)_audioBuffer[i] - (double)_audioDcOffset;
            q0 = coeff * q1 - q2 + x;
            q2 = q1;
            q1 = q0;
        }

        double mag2 = q1 * q1 + q2 * q2 - coeff * q1 * q2;
        if (mag2 < 0.0) mag2 = 0.0;
        double mag = sqrt(mag2);
        // Escala para que quede en un rango legible (no depende del N)
        double escalado = mag * 1000.0 / (double)_audioBufLen;
        return (int)escalado;
    }

    // ---------------------------------------------------------------------
    // audioRMS — Amplitud eficaz (RMS) de la señal en el buffer
    // ---------------------------------------------------------------------
    // RMS = √( (1/N) Σ (x[i] − DC)² )
    // Útil como disparador: sólo analizar frecuencia si hay señal suficiente.
    // ---------------------------------------------------------------------

    //%
    int audioRMS() {
        if (_audioBufLen <= 0) return 0;

        int64_t sumSq = 0;
        for (int i = 0; i < _audioBufLen; i++) {
            int32_t d = (int32_t)_audioBuffer[i] - _audioDcOffset;
            sumSq += (int64_t)d * (int64_t)d;
        }
        double media = (double)sumSq / (double)_audioBufLen;
        return (int)(sqrt(media) + 0.5);
    }

    // ---------------------------------------------------------------------
    // audioPicoPico — Rango pico-a-pico (max − min) en el buffer
    // ---------------------------------------------------------------------

    //%
    int audioPicoPico() {
        if (_audioBufLen <= 0) return 0;
        int16_t mn =  32767;
        int16_t mx = -32768;
        for (int i = 0; i < _audioBufLen; i++) {
            int16_t v = _audioBuffer[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        return (int)(mx - mn);
    }
}
