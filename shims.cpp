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

#if MICROBIT_CODAL
// Cabeceras para engancharse al pipeline de audio del mic PDM v2
#include "MicroBitAudio.h"
#include "StreamSplitter.h"
#endif

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
    // hx711LeerCrudoNativo — Lectura de 24 bits del HX711 con protección IRQ
    // =========================================================================
    //  Lee el ADC de 24 bits del HX711 usando bit-bang con interrupciones
    //  deshabilitadas para evitar que PD_SCK quede HIGH >60μs (lo que
    //  pondría el chip en power-down y corrompería la lectura).
    //
    //  Parámetros:
    //    pinDoutId   — ID del pin DOUT (valor del enum DigitalPin)
    //    pinSckId    — ID del pin PD_SCK (valor del enum DigitalPin)
    //    ganExtra    — Pulsos extra de ganancia: 1=128ch.A, 2=32ch.B, 3=64ch.A
    //
    //  Retorna:
    //    Valor unsigned [1..0xFFFFFF] tras XOR 0x800000
    //    0 = dato no listo (DOUT HIGH) o error
    //
    //  Duración con IRQ deshabilitadas: ~80μs (seguro para softdevice BLE)
    // =========================================================================

    //%
    int hx711LeerCrudoNativo(int pinDoutId, int pinSckId, int ganExtra) {
        #if MICROBIT_CODAL
        MicroBitPin *dout = pxt::getPin(pinDoutId);
        MicroBitPin *sck  = pxt::getPin(pinSckId);
        if (!dout || !sck) return 0;
        if (ganExtra < 1) ganExtra = 1;
        if (ganExtra > 3) ganExtra = 3;

        // Asegurar que DOUT esté en modo entrada
        dout->getDigitalValue();

        // Non-blocking: si DOUT está HIGH, no hay dato listo
        if (dout->getDigitalValue() != 0) return 0;

        // ── SECCIÓN CRÍTICA: deshabilitar interrupciones ──
        // Impide que un ISR estire PD_SCK HIGH >60μs (power-down del HX711).
        // Duración total: ~80μs para 27 pulsos — seguro para el softdevice BLE.
        uint32_t primask = __get_PRIMASK();
        __disable_irq();

        uint32_t data = 0;
        int totalPulsos = 24 + ganExtra;

        for (int i = 0; i < totalPulsos; i++) {
            sck->setDigitalValue(1);
            // T3 min = 0.2μs — la llamada a getDigitalValue() ya toma ~1μs
            if (i < 24) {
                data = (data << 1) | (uint32_t)(dout->getDigitalValue());
            }
            sck->setDigitalValue(0);
            // T4 min = 0.2μs — satisfecho por el overhead del for
        }

        __set_PRIMASK(primask);  // restaurar estado previo de interrupciones

        // XOR 0x800000: convierte complemento a 2 → rango unsigned [0, 0xFFFFFF]
        //   Original 0x800000 (más negativo) → 0x000000 (mínimo)
        //   Original 0x000000 (cero)          → 0x800000 (medio)
        //   Original 0x7FFFFF (más positivo)  → 0xFFFFFF (máximo)
        data ^= 0x800000;

        return (int)data;
        #else
        return 0;
        #endif
    }

    // =========================================================================
    // SONIDO — Detección de frecuencia con el micrófono interno PDM v2
    // =========================================================================
    //
    // Cadena de audio en CODAL:
    //   [Mic PDM] → StreamNormalizer → StreamSplitter ┬→ LevelDetectorSPL
    //                                                 └→ canal propio ─→ buffer
    //
    // Creamos un canal nuevo del splitter de `uBit.audio`, enganchamos un
    // DataSink persistente que copia las muestras int16 (~11 kHz, filtro
    // pasa-alta ~80 Hz) a un buffer global, y corremos autocorrelación
    // con interpolación parabólica sub-muestra para extraer la frecuencia
    // fundamental. Rango útil 80–4000 Hz — cubre E2..C8 y todas las
    // notas musicales comunes.
    // =========================================================================

    #if MICROBIT_CODAL

    #define FISICABIT_IMIC_BUF 1024
    static int16_t _imicBuf[FISICABIT_IMIC_BUF];

    class _FisicabitImicSink : public DataSink {
    public:
        DataSource *src;
        volatile int target;
        volatile int pos;
        volatile bool armed;

        _FisicabitImicSink() {
            src = NULL;
            target = 0;
            pos = 0;
            armed = false;
        }

        void attach(DataSource *s) {
            src = s;
            if (src) src->connect(*this);
        }

        void arm(int n) {
            pos = 0;
            target = n;
            armed = true;
        }

        virtual int pullRequest() {
            if (src == NULL) return DEVICE_OK;
            ManagedBuffer data = src->pull();
            if (!armed) return DEVICE_OK;
            int n = data.length() / 2;
            const int16_t *s = (const int16_t *)&data[0];
            int localPos = pos;
            int localTarget = target;
            for (int i = 0; i < n && localPos < localTarget; i++) {
                _imicBuf[localPos++] = s[i];
            }
            pos = localPos;
            if (pos >= localTarget) armed = false;
            return DEVICE_OK;
        }
    };

    static _FisicabitImicSink *_imicSink = NULL;

    // Autocorrelación del buffer global en un lag concreto
    static double _imicAc(int lag, int n, int32_t dc) {
        int nn = n - lag;
        if (nn <= 0) return 0.0;
        int64_t sum = 0;
        for (int i = 0; i < nn; i++) {
            int32_t a = (int32_t)_imicBuf[i] - dc;
            int32_t b = (int32_t)_imicBuf[i + lag] - dc;
            sum += (int64_t)a * b;
        }
        return (double)sum / (double)nn;
    }

    #endif // MICROBIT_CODAL

    // =========================================================================
    // audioInternoDetectarFrecuencia — one-shot capture + autocorrelación
    // =========================================================================
    //
    // Arguments:
    //   numMuestras   → tamaño de ventana (32..1024)
    //   minHzCenti    → frecuencia mínima buscada en centi-Hz (Hz × 100)
    //   maxHzCenti    → frecuencia máxima buscada en centi-Hz (Hz × 100)
    //
    // Returns:
    //   frecuencia fundamental en centi-Hz (Hz × 100), o 0 si hay silencio,
    //   error o ejecución en v1 (mic interno no disponible).
    // =========================================================================

    //%
    int audioInternoDetectarFrecuencia(int numMuestras, int minHzCenti, int maxHzCenti) {
        #if MICROBIT_CODAL
        if (numMuestras < 32) numMuestras = 32;
        if (numMuestras > FISICABIT_IMIC_BUF) numMuestras = FISICABIT_IMIC_BUF;

        // Setup único: crear canal del splitter y enganchar sink persistente
        if (_imicSink == NULL) {
            StreamSplitter *sp = uBit.audio.splitter;
            if (sp == NULL) return 0;
            SplitterChannel *ch = sp->createChannel();
            if (ch == NULL) return 0;
            _imicSink = new _FisicabitImicSink();
            if (_imicSink == NULL) return 0;
            _imicSink->attach(ch);
        }

        _imicSink->arm(numMuestras);

        // Esperar a que se llene la ventana (timeout 2 s)
        uint64_t start = system_timer_current_time_us();
        while (_imicSink->armed) {
            if (system_timer_current_time_us() - start > 2000000) {
                _imicSink->armed = false;
                break;
            }
            fiber_sleep(1);
        }

        int n = _imicSink->pos;
        if (n < 32) return 0;

        // DC offset (media)
        int32_t suma = 0;
        for (int i = 0; i < n; i++) suma += (int32_t)_imicBuf[i];
        int32_t dc = suma / n;

        // Gating por RMS: descartar silencios
        int64_t sumSq = 0;
        for (int i = 0; i < n; i++) {
            int32_t d = (int32_t)_imicBuf[i] - dc;
            sumSq += (int64_t)d * d;
        }
        double rms = sqrt((double)sumSq / (double)n);
        if (rms < 30.0) return 0;

        // Autocorrelación en el rango [minLag, maxLag]
        const int sampleRate = 11000;
        double minHz = (double)minHzCenti / 100.0;
        double maxHz = (double)maxHzCenti / 100.0;
        if (minHz < 20.0) minHz = 20.0;
        if (maxHz > (double)sampleRate / 2.0) maxHz = (double)sampleRate / 2.0;
        if (maxHz <= minHz) return 0;

        int minLag = (int)((double)sampleRate / maxHz);
        int maxLag = (int)((double)sampleRate / minHz);
        if (minLag < 2) minLag = 2;
        if (maxLag >= n - 1) maxLag = n - 2;
        if (maxLag <= minLag) return 0;

        double bestScore = -1.0e300;
        int bestLag = minLag;
        for (int lag = minLag; lag <= maxLag; lag++) {
            double score = _imicAc(lag, n, dc);
            if (score > bestScore) {
                bestScore = score;
                bestLag = lag;
            }
        }
        if (bestScore <= 0.0) return 0;

        // Interpolación parabólica sub-muestra
        double refinedLag = (double)bestLag;
        if (bestLag > minLag && bestLag < maxLag) {
            double yM = _imicAc(bestLag - 1, n, dc);
            double y0 = bestScore;
            double yP = _imicAc(bestLag + 1, n, dc);
            double denom = 2.0 * (2.0 * y0 - yM - yP);
            if (denom != 0.0) {
                double delta = (yP - yM) / denom;
                if (delta > -1.0 && delta < 1.0) {
                    refinedLag = (double)bestLag + delta;
                }
            }
        }
        if (refinedLag < 1.0) return 0;

        double freq = (double)sampleRate / refinedLag;
        return (int)(freq * 100.0 + 0.5);
        #else
        return 0;
        #endif
    }

}
