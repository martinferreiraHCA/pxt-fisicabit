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
#include "MicroBitSystemTimer.h"
#include "nrf.h"

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


    // =========================================================================
    // ACELERÓMETRO LSM303AGR (micro:bit v2) — configuración de precisión
    // =========================================================================
    // CODAL configura el chip en modo NORMAL (10 bits, 3,9 mg/LSB) a 50 Hz.
    // El chip soporta modo ALTA RESOLUCIÓN (HR, 12 bits, 0,98 mg/LSB) con
    // menor ancho de banda de ruido (ODR/9 en vez de ODR/2). CODAL decodifica
    // los 16 bits crudos como raw/32*rango, así que cambiar el bit HR mejora
    // la resolución 4x SIN cambiar la escala (1024 cuentas ≈ 1 g).
    //
    // Registros (hoja de datos LSM303AGR, DocID027765 Rev 9):
    //   WHO_AM_I_A (0x0F) = 0x33
    //   CTRL_REG4_A (0x23): BDU | BLE | FS1 FS0 | HR | ST1 ST0 | SPI_EN
    // CODAL escribe CTRL_REG4 = 0x80 | FS en cada configure() (setRange /
    // setPeriod / activación), por eso HR debe reafirmarse después.
    // =========================================================================
    #define FB_LSM303_A_ADDR   0x32
    #define FB_LSM303_WHO_AM_I 0x0F
    #define FB_LSM303_CTRL4    0x23

    static bool fbEsLSM303() {
#if MICROBIT_CODAL
        uint8_t who = 0;
        if (uBit._i2c.readRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_WHO_AM_I, &who, 1) != 0) return false;
        return who == 0x33;
#else
        return false;
#endif
    }

    // Devuelve 1 si quedó en HR, 0 si quedó en normal, <0 si no es un LSM303.
    static int fbAplicarHR(bool hr) {
#if MICROBIT_CODAL
        if (!fbEsLSM303()) return -1;
        uint8_t r4 = 0;
        if (uBit._i2c.readRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_CTRL4, &r4, 1) != 0) return -2;
        uint8_t deseado = (uint8_t)((r4 & 0x30) | 0x80 | (hr ? 0x08 : 0x00));
        if ((uint8_t)(r4 & 0xB8) != (uint8_t)(deseado & 0xB8)) {
            uBit._i2c.writeRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_CTRL4, deseado);
        }
        return hr ? 1 : 0;
#else
        return -1;
#endif
    }

    // Configura rango (g), período de muestreo (ms) y modo de alta
    // resolución del acelerómetro. Devuelve el período real (ms).
    //%
    int acelConfigurar(int periodoMs, int rangoG, int altaRes) {
#if MICROBIT_CODAL
        uBit.accelerometer.getX();              // activa el sensor (configure interno)
        uBit.accelerometer.setRange(rangoG);
        uBit.accelerometer.setPeriod(periodoMs);
        fbAplicarHR(altaRes != 0);
        return uBit.accelerometer.getPeriod();
#else
        return periodoMs;
#endif
    }

    // Reafirma el modo de alta resolución (CODAL lo pierde al reconfigurar).
    // Devuelve 1 (HR), 0 (normal) o <0 (sensor no LSM303 / error I2C).
    //%
    int acelAsegurarHR(int altaRes) {
        return fbAplicarHR(altaRes != 0);
    }

    // =========================================================================
    // DS18B20 — Sonda de temperatura Dallas/Maxim por bus OneWire
    // =========================================================================
    // Adaptado de "microbit-dstemp" de Bill Siever (2018-2021), licencia MIT,
    // basado a su vez en SparkFun weather:bit. Se conservan sus tiempos
    // calibrados con osciloscopio para micro:bit v1 (DAL) y v2 (CODAL).
    // Cambios: resolución configurable (9-12 bits), espera real del fin de
    // conversión (el sensor responde 0 mientras convierte y 1 al terminar),
    // sin callback de error (el código de error se consulta desde TS) y el
    // resultado se devuelve como entero crudo (1/16 °C) sin usar float.
    // =========================================================================

#if MICROBIT_CODAL
    #ifdef NRF_P1
        #define FB_DS_PORT (pin < 32 ? NRF_P0 : NRF_P1)
        #define FB_DS_PIN  ((pin) & 31)
    #else
        #define FB_DS_PORT (NRF_P0)
        #define FB_DS_PIN  (pin)
    #endif
    #define fb_ds_wait_us(us) system_timer_wait_cycles((us)==0 ? 1 : (((10*500*(us))/470)))
    typedef int fb_ds_gpio;
    static void fbDsInput(fb_ds_gpio pin)            { FB_DS_PORT->PIN_CNF[FB_DS_PIN] &= 0xfffffffc; }
    static void fbDsOutput(fb_ds_gpio pin)           { FB_DS_PORT->PIN_CNF[FB_DS_PIN] |= 3; }
    static void fbDsWrite(fb_ds_gpio pin, int val)   { if (val) FB_DS_PORT->OUTSET = 1 << FB_DS_PIN; else FB_DS_PORT->OUTCLR = 1 << FB_DS_PIN; }
    static bool fbDsRead(fb_ds_gpio pin)             { return (FB_DS_PORT->IN & (1 << FB_DS_PIN)) ? 1 : 0; }

    static void fbDsConfigTimer() {
        // Asegura el cristal externo (más precisión) y el timer en 32 bits
        static NRF_TIMER_Type *timer = NULL;
        if (timer == NULL) {
            NVIC_DisableIRQ(TIMER1_IRQn);
            NRF_CLOCK_Type *clock = NRF_CLOCK;
            clock->TASKS_HFCLKSTART = 1;
            timer = NRF_TIMER1;
            timer->TASKS_STOP = 1;
            timer->BITMODE = 3;
            timer->TASKS_START = 1;
            NVIC_EnableIRQ(TIMER1_IRQn);
        }
    }
#else
    #define fb_ds_wait_us(us) wait_us(((us)>5)?(us)-5:0)
    typedef gpio_t* fb_ds_gpio;
    #define fbDsInput(pin)        gpio_dir((pin), PIN_INPUT)
    #define fbDsOutput(pin)       gpio_dir((pin), PIN_OUTPUT)
    #define fbDsWrite(pin, val)   gpio_write((pin), (val))
    #define fbDsRead(pin)         gpio_read((pin))
#endif

    // Tiempos (µs) del protocolo OneWire, calibrados por Siever
    static const int FB_DS_TIME_SLOT = 90;
    static const int FB_DS_TIME_RECOV = 15;
    static const int FB_DS_TIME_ZERO_LOW = FB_DS_TIME_SLOT;
    static const int FB_DS_TIME_ONE_LOW = 0;
    static const int FB_DS_TIME_RESET_LOW = 500;
    static const int FB_DS_TIME_POWER_UP = 1000;
    static const int FB_DS_TIME_POST_RESET = 10;
    static const int FB_DS_TIME_PRESENCE = 300;
    static const int FB_DS_HIGH_ALARM = 0xFF;
    static const int FB_DS_LOW_ALARM = 0x80;
    static const int FB_DS_MAX_TRIES = 3;
    static const int FB_DS_ERROR = -100000;   // centinela de error (raw)

    static int fbDsUltimoError = 0;   // 0 ok, 1 no conectado, 2 no arranca, 3 CRC/lectura, 4 tiempo agotado

    static void fbDsWriteBit(fb_ds_gpio ioPin, bool one) {
        fbDsWrite(ioPin, 1);
        fbDsOutput(ioPin);
        fb_ds_wait_us(FB_DS_TIME_RECOV);
        fbDsWrite(ioPin, 0);
        fb_ds_wait_us(one ? FB_DS_TIME_ONE_LOW : FB_DS_TIME_ZERO_LOW);
        fbDsInput(ioPin);
        fbDsWrite(ioPin, 1);
        fb_ds_wait_us(one ? FB_DS_TIME_SLOT : 1);
    }

    static void fbDsWriteByte(fb_ds_gpio ioPin, uint8_t b) {
        for (int i = 0; i < 8; i++, b >>= 1) fbDsWriteBit(ioPin, (b & 0x01));
    }

    static bool fbDsReadBit(fb_ds_gpio ioPin) {
        fbDsOutput(ioPin);
        fbDsWrite(ioPin, 1);
        fb_ds_wait_us(FB_DS_TIME_RECOV);
        fbDsWrite(ioPin, 0);
        fb_ds_wait_us(1);
        fbDsWrite(ioPin, 1);
        fbDsInput(ioPin);
        bool b = true;
#if MICROBIT_CODAL
        uint32_t maxCounts = (int)(FB_DS_TIME_SLOT / 0.0635);
#else
        fb_ds_wait_us(0);
        uint32_t maxCounts = (int)(FB_DS_TIME_SLOT / 0.57);
#endif
        do {
            b = b && fbDsRead(ioPin);
        } while (maxCounts-- > 0);
        fbDsWrite(ioPin, 1);
        return b;
    }

    static bool fbDsReset(fb_ds_gpio ioPin) {
        fbDsOutput(ioPin);
        fbDsWrite(ioPin, 1);
        fb_ds_wait_us(FB_DS_TIME_POWER_UP);
        fbDsWrite(ioPin, 0);
        fb_ds_wait_us(FB_DS_TIME_RESET_LOW);
        fbDsWrite(ioPin, 1);
        fbDsInput(ioPin);
        fb_ds_wait_us(FB_DS_TIME_POST_RESET);
#if MICROBIT_CODAL
        int maxCounts = (int)(FB_DS_TIME_PRESENCE / 0.1);
#else
        int maxCounts = (int)(FB_DS_TIME_PRESENCE / 1);
#endif
        bool presence = false;
        do {
            presence = presence || (fbDsRead(ioPin) == 0);
        } while (maxCounts-- > 0);
        bool release = fbDsRead(ioPin) == 1;
        return presence && release;
    }

    // Byte de configuración según resolución: 9→0x1F, 10→0x3F, 11→0x5F, 12→0x7F
    static uint8_t fbDsConfigByte(int bits) {
        if (bits < 9) bits = 9;
        if (bits > 12) bits = 12;
        return (uint8_t)(0x1F | ((bits - 9) << 5));
    }

    static bool fbDsConfigure(fb_ds_gpio ioPin, int bits) {
        if (!fbDsReset(ioPin)) return false;
        fbDsWriteByte(ioPin, 0xCC);            // Skip ROM
        fbDsWriteByte(ioPin, 0x4E);            // Write scratchpad
        fbDsWriteByte(ioPin, FB_DS_HIGH_ALARM);
        fbDsWriteByte(ioPin, FB_DS_LOW_ALARM);
        fbDsWriteByte(ioPin, fbDsConfigByte(bits));
        return true;
    }

    static bool fbDsStartConversion(fb_ds_gpio ioPin) {
        if (!fbDsReset(ioPin)) return false;
        fbDsWriteByte(ioPin, 0xCC);            // Skip ROM
        fbDsWriteByte(ioPin, 0x44);            // Convert T
        return true;
    }

    static bool fbDsReadScratchpad(fb_ds_gpio ioPin, int bits, int16_t &raw) {
        uint8_t data[9];
        uint8_t crc = 0;
        for (int j = 0; j < 9; j++) {
            uint8_t b = 0;
            for (int i = 0; i < 8; i++) {
                bool bit = fbDsReadBit(ioPin);
                b |= (bit << i);
                bool lsb = crc & 0x1;
                crc >>= 1;
                if (bit != lsb) crc ^= 0x8C;
            }
            data[j] = b;
        }
        raw = (int16_t)(((uint16_t)data[1] << 8) | data[0]);
        // Bits no usados según la resolución quedan indefinidos: se limpian
        int mascara = ~((1 << (12 - bits)) - 1);
        raw = (int16_t)(raw & mascara);
        return crc == 0 && data[2] == FB_DS_HIGH_ALARM && data[3] == FB_DS_LOW_ALARM
            && (data[4] & 0x60) == (fbDsConfigByte(bits) & 0x60);
    }

    static fb_ds_gpio fbDsGpio(int pin
#if !MICROBIT_CODAL
        , gpio_t *obj
#endif
    ) {
        MicroBitPin *mbp = pxt::getPin(pin);
#if MICROBIT_CODAL
        return mbp->name;
#else
        gpio_init(obj, mbp->name);
        return obj;
#endif
    }

    // Lee la temperatura del DS18B20 en `pin` (id de DigitalPin) con `bits`
    // de resolución. Devuelve el valor crudo (1/16 °C) o FB_DS_ERROR.
    //%
    int ds18b20Leer(int pin, int bits) {
#if MICROBIT_CODAL
#ifdef SOFTDEVICE_PRESENT
        if (!ble_running())
#endif
            fbDsConfigTimer();
        fb_ds_gpio gpio = fbDsGpio(pin);
#else
        gpio_t gpioObj;
        fb_ds_gpio gpio = fbDsGpio(pin, &gpioObj);
#endif
        if (bits < 9) bits = 9;
        if (bits > 12) bits = 12;

        // 1) Configurar y arrancar la conversión
        bool ok = false;
        for (int tries = 0; tries < FB_DS_MAX_TRIES && !ok; tries++) {
            if (!fbDsConfigure(gpio, bits)) { fbDsUltimoError = 1; fbDsInput(gpio); return FB_DS_ERROR; }
            ok = fbDsStartConversion(gpio);
        }
        if (!ok) { fbDsUltimoError = 2; fbDsInput(gpio); return FB_DS_ERROR; }

        // 2) Esperar el fin de conversión: el sensor responde 0 mientras
        //    convierte y 1 al terminar. Tiempo máximo según resolución
        //    (94 / 188 / 375 / 750 ms) más margen. Con alimentación parásita
        //    el sondeo no funciona: se espera el tiempo completo y se intenta.
        int maxMs = (94 << (bits - 9)) + 60;
        int esperado = 0;
        bool listo = false;
        while (esperado < maxMs) {
            uBit.sleep(4);
            esperado += 4;
            if (fbDsReadBit(gpio)) { listo = true; break; }
        }
        if (!listo) uBit.sleep(10);

        // 3) Leer el scratchpad (con CRC)
        for (int tries = 0; tries < FB_DS_MAX_TRIES; tries++) {
            if (fbDsReset(gpio)) {
                fbDsWriteByte(gpio, 0xCC);     // Skip ROM
                fbDsWriteByte(gpio, 0xBE);     // Read scratchpad
                int16_t raw = 0;
                if (fbDsReadScratchpad(gpio, bits, raw)) {
                    fbDsUltimoError = 0;
                    fbDsInput(gpio);
                    return raw;
                }
            }
        }
        fbDsUltimoError = listo ? 3 : 4;
        fbDsInput(gpio);
        return FB_DS_ERROR;
    }

    // Código del último error del DS18B20 (0 = sin error).
    //%
    int ds18b20Error() {
        return fbDsUltimoError;
    }

    // 1 si hay un DS18B20 respondiendo en el pin, 0 si no.
    //%
    int ds18b20Presente(int pin) {
#if MICROBIT_CODAL
#ifdef SOFTDEVICE_PRESENT
        if (!ble_running())
#endif
            fbDsConfigTimer();
        fb_ds_gpio gpio = fbDsGpio(pin);
#else
        gpio_t gpioObj;
        fb_ds_gpio gpio = fbDsGpio(pin, &gpioObj);
#endif
        bool p = fbDsReset(gpio);
        fbDsInput(gpio);
        return p ? 1 : 0;
    }

    // =========================================================================
    // I2C POR SOFTWARE — bus I2C en cualquier par de pines (SDA, SCL)
    // =========================================================================
    // Permite conectar sensores I2C fuera de P19/P20, por ejemplo un segundo
    // sensor ToF que tiene la misma dirección (0x29) que el primero.
    // Bit-bang a ~50-100 kHz, salidas en colector abierto (pull-up interno
    // más el del módulo), con soporte de clock stretching. Sólo micro:bit v2.
    // =========================================================================
#if MICROBIT_CODAL
    static void fbI2cRelease(int pin) { FB_DS_PORT->PIN_CNF[FB_DS_PIN] = 0x0000000C; }   // entrada + pull-up
    static void fbI2cLow(int pin)     { FB_DS_PORT->OUTCLR = 1 << FB_DS_PIN; FB_DS_PORT->PIN_CNF[FB_DS_PIN] = 0x00000001; }
    static bool fbI2cReadPin(int pin) { return (FB_DS_PORT->IN & (1 << FB_DS_PIN)) != 0; }

    static bool fbI2cSclHigh(int scl) {
        fbI2cRelease(scl);
        int t = 3000;
        while (!fbI2cReadPin(scl) && t-- > 0) fb_ds_wait_us(1);
        return t > 0;
    }
    static void fbI2cStart(int sda, int scl) {
        fbI2cRelease(sda); fbI2cSclHigh(scl); fb_ds_wait_us(4);
        fbI2cLow(sda); fb_ds_wait_us(4);
        fbI2cLow(scl); fb_ds_wait_us(2);
    }
    static void fbI2cStop(int sda, int scl) {
        fbI2cLow(sda); fb_ds_wait_us(2);
        fbI2cSclHigh(scl); fb_ds_wait_us(4);
        fbI2cRelease(sda); fb_ds_wait_us(4);
    }
    static bool fbI2cWriteByte(int sda, int scl, uint8_t b) {
        for (int i = 7; i >= 0; i--) {
            if (b & (1 << i)) fbI2cRelease(sda); else fbI2cLow(sda);
            fb_ds_wait_us(2);
            if (!fbI2cSclHigh(scl)) return false;
            fb_ds_wait_us(4);
            fbI2cLow(scl);
            fb_ds_wait_us(2);
        }
        fbI2cRelease(sda);
        fb_ds_wait_us(2);
        if (!fbI2cSclHigh(scl)) return false;
        fb_ds_wait_us(2);
        bool ack = !fbI2cReadPin(sda);
        fb_ds_wait_us(2);
        fbI2cLow(scl);
        fb_ds_wait_us(2);
        return ack;
    }
    static uint8_t fbI2cReadByte(int sda, int scl, bool ack) {
        uint8_t b = 0;
        fbI2cRelease(sda);
        for (int i = 7; i >= 0; i--) {
            fb_ds_wait_us(2);
            fbI2cSclHigh(scl);
            fb_ds_wait_us(2);
            if (fbI2cReadPin(sda)) b |= (1 << i);
            fb_ds_wait_us(2);
            fbI2cLow(scl);
            fb_ds_wait_us(2);
        }
        if (ack) fbI2cLow(sda); else fbI2cRelease(sda);
        fb_ds_wait_us(2);
        fbI2cSclHigh(scl);
        fb_ds_wait_us(4);
        fbI2cLow(scl);
        fbI2cRelease(sda);
        fb_ds_wait_us(2);
        return b;
    }
    static bool fbI2cPines(int sda, int scl, int &sdaN, int &sclN) {
        MicroBitPin *a = pxt::getPin(sda);
        MicroBitPin *b = pxt::getPin(scl);
        if (!a || !b || a == b) return false;
        sdaN = a->name; sclN = b->name;
        return true;
    }
#endif

    // Escribe `b` al dispositivo `addr` (7 bits) por I2C de software en los
    // pines `sda`/`scl` (ids de DigitalPin). 0 = OK, 1 = sin ACK de dirección,
    // 2 = sin ACK de datos, 3 = no disponible (v1) o pines inválidos.
    //%
    int swi2cWrite(int sda, int scl, int addr, Buffer b) {
#if MICROBIT_CODAL
        int sdaN, sclN;
        if (!fbI2cPines(sda, scl, sdaN, sclN)) return 3;
        fbI2cStart(sdaN, sclN);
        int rc = 0;
        if (!fbI2cWriteByte(sdaN, sclN, (uint8_t)(addr << 1))) rc = 1;
        else {
            for (int i = 0; i < b->length; i++) {
                if (!fbI2cWriteByte(sdaN, sclN, b->data[i])) { rc = 2; break; }
            }
        }
        fbI2cStop(sdaN, sclN);
        return rc;
#else
        return 3;
#endif
    }

    // Lee `n` bytes (máx. 64) del dispositivo `addr` por I2C de software.
    // Devuelve un buffer vacío si el dispositivo no responde.
    //%
    Buffer swi2cRead(int sda, int scl, int addr, int n) {
#if MICROBIT_CODAL
        int sdaN, sclN;
        if (n < 0) n = 0;
        if (n > 64) n = 64;
        if (!fbI2cPines(sda, scl, sdaN, sclN)) return mkBuffer(NULL, 0);
        uint8_t tmp[64];
        fbI2cStart(sdaN, sclN);
        if (!fbI2cWriteByte(sdaN, sclN, (uint8_t)((addr << 1) | 1))) {
            fbI2cStop(sdaN, sclN);
            return mkBuffer(NULL, 0);
        }
        for (int i = 0; i < n; i++) tmp[i] = fbI2cReadByte(sdaN, sclN, i < n - 1);
        fbI2cStop(sdaN, sclN);
        return mkBuffer(tmp, n);
#else
        return mkBuffer(NULL, 0);
#endif
    }

}
