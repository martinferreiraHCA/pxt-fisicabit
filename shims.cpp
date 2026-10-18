// =============================================================================
// shims.cpp — Native C++ code for the FisicaBit extension (micro:bit V2, CODAL)
// =============================================================================
//
// Uses the official CODAL APIs instead of direct nRF52 register access so that
// MakeCode can compile it in the cloud. The extension targets the micro:bit V2
// only (pxt.json disables the "mbdal" variant), so there is no mbed/DAL path.
//
// APIs used:
//   pxt::getPin(id)                -> pin reference
//   pin->getAnalogValue()          -> ADC reading (10-bit, scaled to 12-bit)
//   pin->getDigitalValue()         -> digital reading
//   system_timer_current_time_us() -> microsecond timestamp
//   target_wait_us()               -> short busy-wait delays (CODAL HAL)
//   target_disable_irq()/enable    -> nesting-safe critical sections (CODAL HAL)
//
// The only direct register access left is to the GPIO port of the pin being
// driven (NRF_P0/NRF_P1 PIN_CNF, OUTSET, OUTCLR, IN) inside the DS18B20
// one-wire and software-I2C bit-bang helpers, where CODAL has no primitive
// fast enough; see the comments in those sections. No clock, timer, ADC or
// NVIC registers are touched: CODAL owns those.
// =============================================================================

#include "pxt.h"
#include <math.h>
#include "MicroBitSystemTimer.h"
#include "codal_target_hal.h"
#include "nrf.h"

// Headers to hook into the audio pipeline of the V2 PDM microphone
#include "MicroBitAudio.h"
#include "StreamSplitter.h"

namespace fisicabitNative {

    // ── Helper: get a pin by number (0-20) ──
    static MicroBitPin* getPinByNumber(int n) {
        if (n < 0 || n > 20) return NULL;
        return pxt::getPin(MICROBIT_ID_IO_P0 + n);
    }

    // =========================================================================
    // Fast timing helpers shared by the bit-bang protocols below
    // =========================================================================

    // Deterministic delay in assembler (Cortex-M4 at 64 MHz): the "subs + bne"
    // loop takes 3 cycles per iteration, so n ~= cycles / 3. It does not depend
    // on timers or function calls, so the jitter is in the nanosecond range.
    // Used for sub-microsecond gaps that target_wait_us() cannot resolve.
    static inline void fbDelayCycles(uint32_t n) {
        __asm volatile (
            "1: subs %0, %0, #1 \n"
            "   bne 1b          \n"
            : "+r"(n) : : "cc");
    }

    // Direct GPIO port access for the bit-bang protocols (DS18B20 one-wire and
    // software I2C). These protocols need ~1 us pulses and must flip the line
    // between output and input within a few hundred nanoseconds.
    // MicroBitPin::setDigitalValue()/getDigitalValue() reconfigure the pin on
    // every direction change and cost several microseconds each, which breaks
    // the protocol timing, and CODAL offers no faster GPIO primitive. Only the
    // port registers of the pin itself are touched (direction bits of PIN_CNF,
    // OUTSET/OUTCLR and the read-only IN register); the pin numbers come from
    // MicroBitPin::name, so CODAL still owns the pin mapping.
    #ifdef NRF_P1
        #define FB_GPIO_PORT(pin) ((pin) < 32 ? NRF_P0 : NRF_P1)
    #else
        #define FB_GPIO_PORT(pin) (NRF_P0)
    #endif
    #define FB_GPIO_BIT(pin) ((pin) & 31)

    // =========================================================================
    // readAdcNative — ADC reading through CODAL
    // =========================================================================
    // Uses getAnalogValue(), which returns 0-1023 (10-bit).
    // The value is scaled to 0-4095 (12-bit) for compatibility.
    // =========================================================================

    //%
    int readAdcNative(int channel) {
        if (channel < 0 || channel > 7) return -1;

        MicroBitPin *pin = getPinByNumber(channel);
        if (!pin) return -1;

        // getAnalogValue() returns 0-1023 (10-bit)
        int value = pin->getAnalogValue();

        // Scale to the 12-bit range (0-4095) for compatibility
        return value * 4;
    }

    // =========================================================================
    // measurePulseNative — pulse measurement with the system timer
    // =========================================================================
    // Uses system_timer_current_time_us() for timing.
    // Resolution: ~1-5 us (enough for HC-SR04, DHT11, etc.)
    // =========================================================================

    //%
    int measurePulseNative(int pin, bool high, int timeoutUs) {
        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        // Force digital input mode
        gpioPin->getDigitalValue();

        int wantedLevel = high ? 1 : 0;
        uint64_t start = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Phase 1: if the line is already at the wanted level, wait for it to change
        while (gpioPin->getDigitalValue() == wantedLevel) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }

        // Phase 2: wait for the pulse to begin
        while (gpioPin->getDigitalValue() != wantedLevel) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }

        // Phase 3: measure the pulse width
        uint64_t t0 = system_timer_current_time_us();
        while (gpioPin->getDigitalValue() == wantedLevel) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }
        uint64_t t1 = system_timer_current_time_us();

        return (int)(t1 - t0);
    }

    // =========================================================================
    // readAdcAveraged — oversampling to reduce noise
    // =========================================================================

    //%
    int readAdcAveraged(int channel, int samples) {
        if (channel < 0 || channel > 7) return -1;
        if (samples < 1) samples = 1;
        if (samples > 64) samples = 64;

        int32_t sum = 0;
        for (int i = 0; i < samples; i++) {
            sum += readAdcNative(channel);
        }
        return (int)(sum / samples);
    }

    // =========================================================================
    // gateNative — photogate timing through CODAL
    // =========================================================================
    // Mode 0 (digital): detects HIGH->LOW transitions with getDigitalValue()
    // Mode 1 (analog): reads the ADC and compares against a threshold
    // Timing: system_timer_current_time_us() (~1-5 us resolution)
    // =========================================================================

    static int fbMeasureGateTime(int pinA, int pinB, int mode, int thresholdA, int thresholdB, int timeoutUs) {
        uint64_t tStart = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        if (mode == 0) {
            // ── DIGITAL MODE (FC-33 and similar) ──
            MicroBitPin *gpA = getPinByNumber(pinA);
            MicroBitPin *gpB = getPinByNumber(pinB);
            if (!gpA || !gpB) return 0;

            // Force input mode
            gpA->getDigitalValue();
            gpB->getDigitalValue();

            // Phase 1: wait for gate A to be FREE (HIGH)
            while (gpA->getDigitalValue() == 0) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Phase 2: wait for gate A to ACTIVATE (LOW = object arrives)
            while (gpA->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Capture T0
            uint64_t t0 = system_timer_current_time_us();

            // Phase 3: wait for gate B to ACTIVATE (LOW)
            while (gpB->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Capture T1
            uint64_t t1 = system_timer_current_time_us();

            return (int)(t1 - t0);

        } else {
            // ── ANALOG MODE (DIY IR gate with phototransistor) ──
            // Thresholds arrive in the 0-1023 range; scale to 12-bit
            int thresholdA12 = thresholdA * 4;
            int thresholdB12 = thresholdB * 4;
            int channelA = pinA;
            int channelB = pinB;

            // Phase 1: wait for gate A to be FREE (reading > threshold)
            while (readAdcNative(channelA) < thresholdA12) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Phase 2: wait for gate A to ACTIVATE (reading < threshold)
            while (readAdcNative(channelA) >= thresholdA12) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Capture T0
            uint64_t t0 = system_timer_current_time_us();

            // Phase 3: wait for gate B to ACTIVATE
            while (readAdcNative(channelB) >= thresholdB12) {
                if (system_timer_current_time_us() - tStart > maxTime)
                    return 0;
            }

            // Capture T1
            uint64_t t1 = system_timer_current_time_us();

            return (int)(t1 - t0);
        }
    }

    // Native photogate. Pins and thresholds are packed ((A << 16) | B)
    // because the MakeCode native compiler allows at most 4 parameters.
    //%
    int gateNative(int pins, int mode, int thresholds, int timeoutUs) {
        return fbMeasureGateTime((pins >> 16) & 0xFFFF, pins & 0xFFFF, mode,
                                 (thresholds >> 16) & 0xFFFF, thresholds & 0xFFFF, timeoutUs);
    }

    // =========================================================================
    // tcs3200ReadPeriodUs — measures one full period on the TCS3200 pin
    // =========================================================================
    // Measures the time between two consecutive rising edges.
    // Returns the period in microseconds, 0 on timeout.
    // =========================================================================

    //%
    int tcs3200ReadPeriodUs(int pin, int timeoutUs) {
        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        gpioPin->getDigitalValue();

        uint64_t start = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Wait for the line to go low (known state)
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }

        // Wait for the first rising edge
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }
        uint64_t t0 = system_timer_current_time_us();

        // Wait for the line to go low
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }

        // Wait for the second rising edge
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }
        uint64_t t1 = system_timer_current_time_us();

        return (int)(t1 - t0);
    }

    // =========================================================================
    // tcs3200ReadBurstUs — measures N consecutive periods, returns the average
    // =========================================================================

    //%
    int tcs3200ReadBurstUs(int pin, int samples, int timeoutUs) {
        if (samples < 1) samples = 1;
        if (samples > 50) samples = 50;

        MicroBitPin *gpioPin = getPinByNumber(pin);
        if (!gpioPin) return 0;

        gpioPin->getDigitalValue();

        uint64_t start = system_timer_current_time_us();
        uint64_t maxTime = (uint64_t)timeoutUs;

        // Synchronize: wait for a rising edge
        while (gpioPin->getDigitalValue() != 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }
        while (gpioPin->getDigitalValue() == 0) {
            if (system_timer_current_time_us() - start > maxTime)
                return 0;
        }

        uint64_t tStart = system_timer_current_time_us();

        // Measure N consecutive periods
        for (int i = 0; i < samples; i++) {
            // Wait for the line to go low
            while (gpioPin->getDigitalValue() != 0) {
                if (system_timer_current_time_us() - start > maxTime)
                    return 0;
            }
            // Wait for the line to go high (next rising edge)
            while (gpioPin->getDigitalValue() == 0) {
                if (system_timer_current_time_us() - start > maxTime)
                    return 0;
            }
        }

        uint64_t tEnd = system_timer_current_time_us();

        // Return the average
        return (int)((tEnd - tStart) / samples);
    }

    // =========================================================================
    // hx711ReadRawNative — 24-bit HX711 reading with IRQ protection
    // =========================================================================
    //  Reads the 24-bit ADC of the HX711 by bit-banging with interrupts
    //  disabled, so that PD_SCK never stays HIGH for more than 60 us (which
    //  would put the chip into power-down and corrupt the reading).
    //
    //  Parameters:
    //    doutPinId  — id of the DOUT pin (DigitalPin enum value)
    //    sckPinId   — id of the PD_SCK pin (DigitalPin enum value)
    //    extraGain  — extra gain pulses: 1 = 128 ch.A, 2 = 32 ch.B, 3 = 64 ch.A
    //
    //  Returns:
    //    Unsigned value [1..0xFFFFFF] after XOR 0x800000
    //    0 = data not ready (DOUT HIGH) or error
    //
    //  Time with IRQs disabled: ~80 us (safe for the BLE softdevice)
    // =========================================================================

    //%
    int hx711ReadRawNative(int doutPinId, int sckPinId, int extraGain) {
        MicroBitPin *dout = pxt::getPin(doutPinId);
        MicroBitPin *sck  = pxt::getPin(sckPinId);
        if (!dout || !sck) return 0;
        if (extraGain < 1) extraGain = 1;
        if (extraGain > 3) extraGain = 3;

        // Make sure DOUT is in input mode
        dout->getDigitalValue();

        // Non-blocking: if DOUT is HIGH there is no data ready
        if (dout->getDigitalValue() != 0) return 0;

        // ── CRITICAL SECTION: mask interrupts for the whole clock train ──
        // The HX711 datasheet specifies that if PD_SCK stays HIGH for more
        // than 60 us the chip enters power-down mode and the conversion is
        // lost. Any interrupt (BLE softdevice, system timer, fiber scheduler)
        // firing between setDigitalValue(1) and setDigitalValue(0) could
        // stretch a clock pulse past that limit, so the 25-27 pulses are
        // clocked out with IRQs masked. The whole train takes ~80 us, well
        // within what the BLE softdevice tolerates. CODAL's
        // target_disable_irq()/target_enable_irq() keep a nesting count, so
        // they restore the caller's state correctly.
        target_disable_irq();

        uint32_t data = 0;
        int totalPulses = 24 + extraGain;

        for (int i = 0; i < totalPulses; i++) {
            sck->setDigitalValue(1);
            // T3 min = 0.2 us — the getDigitalValue() call already takes ~1 us
            if (i < 24) {
                data = (data << 1) | (uint32_t)(dout->getDigitalValue());
            }
            sck->setDigitalValue(0);
            // T4 min = 0.2 us — satisfied by the loop overhead
        }

        target_enable_irq();   // restore the previous interrupt state

        // XOR 0x800000: converts two's complement -> unsigned range [0, 0xFFFFFF]
        //   Original 0x800000 (most negative)  -> 0x000000 (minimum)
        //   Original 0x000000 (zero)           -> 0x800000 (middle)
        //   Original 0x7FFFFF (most positive)  -> 0xFFFFFF (maximum)
        data ^= 0x800000;

        return (int)data;
    }

    // =========================================================================
    // SOUND — frequency detection with the internal PDM microphone (V2)
    // =========================================================================
    //
    // CODAL audio chain:
    //   [PDM mic] -> StreamNormalizer -> StreamSplitter -+-> LevelDetectorSPL
    //                                                    +-> own channel -> buffer
    //
    // We create a new channel on the `uBit.audio` splitter, attach a persistent
    // DataSink that copies the int16 samples (~11 kHz, ~80 Hz high-pass
    // filter) into a global buffer, and run an autocorrelation with parabolic
    // sub-sample interpolation to extract the fundamental frequency. Useful
    // range 80-4000 Hz — covers E2..C8 and all common musical notes.
    // =========================================================================

    #define FISICABIT_IMIC_BUF 1024
    static int16_t fbImicBuf[FISICABIT_IMIC_BUF];

    class FbInternalMicSink : public DataSink {
    public:
        DataSource *src;
        volatile int target;
        volatile int pos;
        volatile bool armed;

        FbInternalMicSink() {
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
                fbImicBuf[localPos++] = s[i];
            }
            pos = localPos;
            if (pos >= localTarget) armed = false;
            return DEVICE_OK;
        }
    };

    static FbInternalMicSink *fbImicSink = NULL;

    // Autocorrelation of the global buffer at a given lag
    static double fbImicAutocorr(int lag, int n, int32_t dc) {
        int nn = n - lag;
        if (nn <= 0) return 0.0;
        int64_t sum = 0;
        for (int i = 0; i < nn; i++) {
            int32_t a = (int32_t)fbImicBuf[i] - dc;
            int32_t b = (int32_t)fbImicBuf[i + lag] - dc;
            sum += (int64_t)a * b;
        }
        return (double)sum / (double)nn;
    }

    // =========================================================================
    // audioInternalDetectFrequency — one-shot capture + autocorrelation
    // =========================================================================
    //
    // Arguments:
    //   numSamples    -> window size (32..1024)
    //   minHzCenti    -> minimum frequency searched, in centi-Hz (Hz x 100)
    //   maxHzCenti    -> maximum frequency searched, in centi-Hz (Hz x 100)
    //
    // Returns:
    //   fundamental frequency in centi-Hz (Hz x 100), or 0 on silence or
    //   error.
    // =========================================================================

    //%
    int audioInternalDetectFrequency(int numSamples, int minHzCenti, int maxHzCenti) {
        if (numSamples < 32) numSamples = 32;
        if (numSamples > FISICABIT_IMIC_BUF) numSamples = FISICABIT_IMIC_BUF;

        // One-time setup: create a splitter channel and attach the persistent sink
        if (fbImicSink == NULL) {
            StreamSplitter *sp = uBit.audio.splitter;
            if (sp == NULL) return 0;
            SplitterChannel *ch = sp->createChannel();
            if (ch == NULL) return 0;
            fbImicSink = new FbInternalMicSink();
            if (fbImicSink == NULL) return 0;
            fbImicSink->attach(ch);
        }

        fbImicSink->arm(numSamples);

        // Wait for the window to fill (2 s timeout)
        uint64_t start = system_timer_current_time_us();
        while (fbImicSink->armed) {
            if (system_timer_current_time_us() - start > 2000000) {
                fbImicSink->armed = false;
                break;
            }
            fiber_sleep(1);
        }

        int n = fbImicSink->pos;
        if (n < 32) return 0;

        // DC offset (mean)
        int32_t sum = 0;
        for (int i = 0; i < n; i++) sum += (int32_t)fbImicBuf[i];
        int32_t dc = sum / n;

        // RMS gating: discard silence
        int64_t sumSq = 0;
        for (int i = 0; i < n; i++) {
            int32_t d = (int32_t)fbImicBuf[i] - dc;
            sumSq += (int64_t)d * d;
        }
        double rms = sqrt((double)sumSq / (double)n);
        if (rms < 30.0) return 0;

        // Autocorrelation over the range [minLag, maxLag]
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
            double score = fbImicAutocorr(lag, n, dc);
            if (score > bestScore) {
                bestScore = score;
                bestLag = lag;
            }
        }
        if (bestScore <= 0.0) return 0;

        // Parabolic sub-sample interpolation
        double refinedLag = (double)bestLag;
        if (bestLag > minLag && bestLag < maxLag) {
            double yM = fbImicAutocorr(bestLag - 1, n, dc);
            double y0 = bestScore;
            double yP = fbImicAutocorr(bestLag + 1, n, dc);
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
    }


    // =========================================================================
    // LSM303AGR ACCELEROMETER (micro:bit V2) — precision configuration
    // =========================================================================
    // CODAL configures the chip in NORMAL mode (10 bits, 3.9 mg/LSB) at 50 Hz.
    // The chip supports a HIGH RESOLUTION mode (HR, 12 bits, 0.98 mg/LSB) with
    // a narrower noise bandwidth (ODR/9 instead of ODR/2). CODAL decodes the
    // raw 16 bits as raw/32*range, so setting the HR bit improves the
    // resolution 4x WITHOUT changing the scale (1024 counts ~= 1 g).
    //
    // Registers (LSM303AGR datasheet, DocID027765 Rev 9):
    //   WHO_AM_I_A (0x0F) = 0x33
    //   CTRL_REG4_A (0x23): BDU | BLE | FS1 FS0 | HR | ST1 ST0 | SPI_EN
    // CODAL writes CTRL_REG4 = 0x80 | FS on every configure() (setRange /
    // setPeriod / activation), which is why HR must be re-asserted afterwards.
    // The register writes go through the CODAL I2C driver (uBit._i2c).
    // =========================================================================
    #define FB_LSM303_A_ADDR   0x32
    #define FB_LSM303_WHO_AM_I 0x0F
    #define FB_LSM303_CTRL4    0x23

    static bool fbIsLSM303() {
        uint8_t who = 0;
        if (uBit._i2c.readRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_WHO_AM_I, &who, 1) != 0) return false;
        return who == 0x33;
    }

    // Returns 1 if the chip is now in HR mode, 0 if in normal mode, <0 if it is not an LSM303.
    static int fbApplyHighRes(bool hr) {
        if (!fbIsLSM303()) return -1;
        uint8_t r4 = 0;
        if (uBit._i2c.readRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_CTRL4, &r4, 1) != 0) return -2;
        uint8_t desired = (uint8_t)((r4 & 0x30) | 0x80 | (hr ? 0x08 : 0x00));
        if ((uint8_t)(r4 & 0xB8) != (uint8_t)(desired & 0xB8)) {
            uBit._i2c.writeRegister((uint16_t)FB_LSM303_A_ADDR, (uint8_t)FB_LSM303_CTRL4, desired);
        }
        return hr ? 1 : 0;
    }

    // Configures the accelerometer range (g), sampling period (ms) and
    // high-resolution mode. Returns the actual period (ms).
    //%
    int accelConfigure(int periodMs, int rangeG, int highRes) {
        uBit.accelerometer.getX();              // activates the sensor (internal configure)
        uBit.accelerometer.setRange(rangeG);
        uBit.accelerometer.setPeriod(periodMs);
        fbApplyHighRes(highRes != 0);
        return uBit.accelerometer.getPeriod();
    }

    // Re-asserts the high-resolution mode (CODAL drops it when reconfiguring).
    // Returns 1 (HR), 0 (normal) or <0 (sensor is not an LSM303 / I2C error).
    //%
    int accelEnsureHighRes(int highRes) {
        return fbApplyHighRes(highRes != 0);
    }

    // =========================================================================
    // DS18B20 — Dallas/Maxim temperature probe on a one-wire bus
    // =========================================================================
    // Adapted from "microbit-dstemp" by Bill Siever (2018-2021), MIT license,
    // itself based on the SparkFun weather:bit. The protocol timings
    // (calibrated with an oscilloscope) are kept.
    // Changes: configurable resolution (9-12 bits), real wait for the end of
    // conversion (the sensor answers 0 while converting and 1 when done), no
    // error callback (the error code is queried from TS) and the result is
    // returned as a raw integer (1/16 degC) without using float.
    //
    // Timing relies on CODAL only: target_wait_us() for the protocol delays
    // and system_timer_current_time_us() for the sampling windows. No timer
    // or clock peripheral is configured here; CODAL already runs the HF clock
    // and its system timer with 32-bit timers on the micro:bit V2.
    // =========================================================================

    typedef int fbDsGpio;   // nRF GPIO number (MicroBitPin::name)
    static inline void fbDsInput(fbDsGpio pin)          { FB_GPIO_PORT(pin)->PIN_CNF[FB_GPIO_BIT(pin)] &= 0xfffffffc; }
    static inline void fbDsOutput(fbDsGpio pin)         { FB_GPIO_PORT(pin)->PIN_CNF[FB_GPIO_BIT(pin)] |= 3; }
    static inline void fbDsWrite(fbDsGpio pin, int val) { if (val) FB_GPIO_PORT(pin)->OUTSET = 1 << FB_GPIO_BIT(pin); else FB_GPIO_PORT(pin)->OUTCLR = 1 << FB_GPIO_BIT(pin); }
    static inline bool fbDsRead(fbDsGpio pin)           { return (FB_GPIO_PORT(pin)->IN & (1 << FB_GPIO_BIT(pin))) ? 1 : 0; }

    // Microsecond busy-wait for the one-wire slots. target_wait_us() is the
    // CODAL HAL spin wait (accurate to about a microsecond). A zero-length
    // wait keeps the minimal gap of the original code (one spin iteration).
    static inline void fbDsWaitUs(uint32_t us) {
        if (us == 0) { fbDelayCycles(1); return; }
        target_wait_us(us);
    }

    // One-wire protocol timings (us), calibrated by Siever
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
    static const int FB_DS_ERROR = -100000;   // error sentinel (raw)

    static int fbDsLastError = 0;   // 0 ok, 1 not connected, 2 did not start, 3 CRC/read, 4 timed out

    static void fbDsWriteBit(fbDsGpio ioPin, bool one) {
        fbDsWrite(ioPin, 1);
        fbDsOutput(ioPin);
        fbDsWaitUs(FB_DS_TIME_RECOV);
        fbDsWrite(ioPin, 0);
        fbDsWaitUs(one ? FB_DS_TIME_ONE_LOW : FB_DS_TIME_ZERO_LOW);
        fbDsInput(ioPin);
        fbDsWrite(ioPin, 1);
        fbDsWaitUs(one ? FB_DS_TIME_SLOT : 1);
    }

    static void fbDsWriteByte(fbDsGpio ioPin, uint8_t b) {
        for (int i = 0; i < 8; i++, b >>= 1) fbDsWriteBit(ioPin, (b & 0x01));
    }

    static bool fbDsReadBit(fbDsGpio ioPin) {
        fbDsOutput(ioPin);
        fbDsWrite(ioPin, 1);
        fbDsWaitUs(FB_DS_TIME_RECOV);
        fbDsWrite(ioPin, 0);
        fbDsWaitUs(1);
        fbDsWrite(ioPin, 1);
        fbDsInput(ioPin);
        // Sample the line continuously for the whole slot: the sensor holds it
        // low for a 0 and leaves it high for a 1. The window is timed with the
        // system timer (us) instead of a calibrated iteration count.
        bool b = true;
        uint64_t t0 = system_timer_current_time_us();
        do {
            b = b && fbDsRead(ioPin);
        } while (system_timer_current_time_us() - t0 < (uint64_t)FB_DS_TIME_SLOT);
        fbDsWrite(ioPin, 1);
        return b;
    }

    static bool fbDsReset(fbDsGpio ioPin) {
        fbDsOutput(ioPin);
        fbDsWrite(ioPin, 1);
        fbDsWaitUs(FB_DS_TIME_POWER_UP);
        fbDsWrite(ioPin, 0);
        fbDsWaitUs(FB_DS_TIME_RESET_LOW);
        fbDsWrite(ioPin, 1);
        fbDsInput(ioPin);
        fbDsWaitUs(FB_DS_TIME_POST_RESET);
        // Presence pulse: the sensor pulls the line low at some point within
        // the presence window and must have released it by the end.
        bool presence = false;
        uint64_t t0 = system_timer_current_time_us();
        do {
            presence = presence || (fbDsRead(ioPin) == 0);
        } while (system_timer_current_time_us() - t0 < (uint64_t)FB_DS_TIME_PRESENCE);
        bool release = fbDsRead(ioPin) == 1;
        return presence && release;
    }

    // Configuration byte for the resolution: 9->0x1F, 10->0x3F, 11->0x5F, 12->0x7F
    static uint8_t fbDsConfigByte(int bits) {
        if (bits < 9) bits = 9;
        if (bits > 12) bits = 12;
        return (uint8_t)(0x1F | ((bits - 9) << 5));
    }

    static bool fbDsConfigure(fbDsGpio ioPin, int bits) {
        if (!fbDsReset(ioPin)) return false;
        fbDsWriteByte(ioPin, 0xCC);            // Skip ROM
        fbDsWriteByte(ioPin, 0x4E);            // Write scratchpad
        fbDsWriteByte(ioPin, FB_DS_HIGH_ALARM);
        fbDsWriteByte(ioPin, FB_DS_LOW_ALARM);
        fbDsWriteByte(ioPin, fbDsConfigByte(bits));
        return true;
    }

    static bool fbDsStartConversion(fbDsGpio ioPin) {
        if (!fbDsReset(ioPin)) return false;
        fbDsWriteByte(ioPin, 0xCC);            // Skip ROM
        fbDsWriteByte(ioPin, 0x44);            // Convert T
        return true;
    }

    static bool fbDsReadScratchpad(fbDsGpio ioPin, int bits, int16_t &raw) {
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
        // Bits unused at the selected resolution are undefined: clear them
        int mask = ~((1 << (12 - bits)) - 1);
        raw = (int16_t)(raw & mask);
        return crc == 0 && data[2] == FB_DS_HIGH_ALARM && data[3] == FB_DS_LOW_ALARM
            && (data[4] & 0x60) == (fbDsConfigByte(bits) & 0x60);
    }

    // nRF GPIO number of a DigitalPin id, or -1 if the id is not a valid pin.
    static fbDsGpio fbDsGpioOf(int pin) {
        MicroBitPin *mbp = pxt::getPin(pin);
        if (!mbp) return -1;
        return mbp->name;
    }

    // Reads the DS18B20 temperature on `pin` (DigitalPin id) with `bits` of
    // resolution. Returns the raw value (1/16 degC) or FB_DS_ERROR.
    //%
    int ds18b20Read(int pin, int bits) {
        fbDsGpio gpio = fbDsGpioOf(pin);
        if (gpio < 0) { fbDsLastError = 1; return FB_DS_ERROR; }
        if (bits < 9) bits = 9;
        if (bits > 12) bits = 12;

        // 1) Configure and start the conversion
        bool ok = false;
        for (int tries = 0; tries < FB_DS_MAX_TRIES && !ok; tries++) {
            if (!fbDsConfigure(gpio, bits)) { fbDsLastError = 1; fbDsInput(gpio); return FB_DS_ERROR; }
            ok = fbDsStartConversion(gpio);
        }
        if (!ok) { fbDsLastError = 2; fbDsInput(gpio); return FB_DS_ERROR; }

        // 2) Wait for the end of conversion: the sensor answers 0 while
        //    converting and 1 when done. Maximum time depends on the
        //    resolution (94 / 188 / 375 / 750 ms) plus margin. With parasitic
        //    power the polling does not work: wait the full time and try.
        int maxMs = (94 << (bits - 9)) + 60;
        int waited = 0;
        bool ready = false;
        while (waited < maxMs) {
            uBit.sleep(4);
            waited += 4;
            if (fbDsReadBit(gpio)) { ready = true; break; }
        }
        if (!ready) uBit.sleep(10);

        // 3) Read the scratchpad (with CRC)
        for (int tries = 0; tries < FB_DS_MAX_TRIES; tries++) {
            if (fbDsReset(gpio)) {
                fbDsWriteByte(gpio, 0xCC);     // Skip ROM
                fbDsWriteByte(gpio, 0xBE);     // Read scratchpad
                int16_t raw = 0;
                if (fbDsReadScratchpad(gpio, bits, raw)) {
                    fbDsLastError = 0;
                    fbDsInput(gpio);
                    return raw;
                }
            }
        }
        fbDsLastError = ready ? 3 : 4;
        fbDsInput(gpio);
        return FB_DS_ERROR;
    }

    // Code of the last DS18B20 error (0 = no error).
    //%
    int ds18b20Error() {
        return fbDsLastError;
    }

    // 1 if a DS18B20 answers on the pin, 0 otherwise.
    //%
    int ds18b20Present(int pin) {
        fbDsGpio gpio = fbDsGpioOf(pin);
        if (gpio < 0) return 0;
        bool p = fbDsReset(gpio);
        fbDsInput(gpio);
        return p ? 1 : 0;
    }

    // =========================================================================
    // SOFTWARE I2C — I2C bus on any pair of pins (SDA, SCL)
    // =========================================================================
    // Allows connecting I2C sensors outside P19/P20, for example a second ToF
    // sensor that has the same address (0x29) as the first one.
    // Bit-bang at ~400 kHz, open-drain outputs (internal pull-up plus the
    // module's own), with clock-stretching support.
    // Quarter-period gaps (~0.6 us) are below the resolution of
    // target_wait_us(), so they use the fbDelayCycles() spin loop above.
    // =========================================================================
    #define FB_I2C_Q() fbDelayCycles(13)     // ~0.6 us (quarter period)
    #define FB_I2C_H() fbDelayCycles(27)     // ~1.25 us (half period)

    // Open-drain line control through the GPIO port registers (see the note
    // on direct GPIO access at the top of the file): release = input with
    // pull-up, low = output driving 0.
    static inline void fbI2cRelease(int pin) { FB_GPIO_PORT(pin)->PIN_CNF[FB_GPIO_BIT(pin)] = 0x0000000C; }   // input + pull-up
    static inline void fbI2cLow(int pin)     { FB_GPIO_PORT(pin)->OUTCLR = 1 << FB_GPIO_BIT(pin); FB_GPIO_PORT(pin)->PIN_CNF[FB_GPIO_BIT(pin)] = 0x00000001; }
    static inline bool fbI2cReadPin(int pin) { return (FB_GPIO_PORT(pin)->IN & (1 << FB_GPIO_BIT(pin))) != 0; }

    static bool fbI2cSclHigh(int scl) {
        fbI2cRelease(scl);
        int t = 3000;
        while (!fbI2cReadPin(scl) && t-- > 0) target_wait_us(1);   // clock stretching (max ~3 ms)
        return t > 0;
    }
    static void fbI2cStart(int sda, int scl) {
        fbI2cRelease(sda); fbI2cSclHigh(scl); FB_I2C_H();
        fbI2cLow(sda); FB_I2C_H();
        fbI2cLow(scl); FB_I2C_Q();
    }
    static void fbI2cStop(int sda, int scl) {
        fbI2cLow(sda); FB_I2C_Q();
        fbI2cSclHigh(scl); FB_I2C_H();
        fbI2cRelease(sda); FB_I2C_H();
    }
    static bool fbI2cWriteByte(int sda, int scl, uint8_t b) {
        for (int i = 7; i >= 0; i--) {
            if (b & (1 << i)) fbI2cRelease(sda); else fbI2cLow(sda);
            FB_I2C_Q();
            if (!fbI2cSclHigh(scl)) return false;
            FB_I2C_H();
            fbI2cLow(scl);
            FB_I2C_Q();
        }
        fbI2cRelease(sda);
        FB_I2C_Q();
        if (!fbI2cSclHigh(scl)) return false;
        FB_I2C_Q();
        bool ack = !fbI2cReadPin(sda);
        FB_I2C_Q();
        fbI2cLow(scl);
        FB_I2C_Q();
        return ack;
    }
    static uint8_t fbI2cReadByte(int sda, int scl, bool ack) {
        uint8_t b = 0;
        fbI2cRelease(sda);
        for (int i = 7; i >= 0; i--) {
            FB_I2C_Q();
            fbI2cSclHigh(scl);
            FB_I2C_Q();
            if (fbI2cReadPin(sda)) b |= (1 << i);
            FB_I2C_Q();
            fbI2cLow(scl);
            FB_I2C_Q();
        }
        if (ack) fbI2cLow(sda); else fbI2cRelease(sda);
        FB_I2C_Q();
        fbI2cSclHigh(scl);
        FB_I2C_H();
        fbI2cLow(scl);
        fbI2cRelease(sda);
        FB_I2C_Q();
        return b;
    }
    static bool fbI2cPins(int sda, int scl, int &sdaN, int &sclN) {
        MicroBitPin *a = pxt::getPin(sda);
        MicroBitPin *b = pxt::getPin(scl);
        if (!a || !b || a == b) return false;
        sdaN = a->name; sclN = b->name;
        return true;
    }

    // Writes `b` to device `addr` (7 bits) over software I2C on pins
    // `sda`/`scl` (DigitalPin ids). 0 = OK, 1 = no address ACK,
    // 2 = no data ACK, 3 = invalid pins.
    //%
    int swi2cWrite(int sda, int scl, int addr, Buffer b) {
        int sdaN, sclN;
        if (!fbI2cPins(sda, scl, sdaN, sclN)) return 3;
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
    }

    // Reads `n` bytes (max 64) from device `addr` over software I2C.
    // Returns an empty buffer if the device does not answer.
    //%
    Buffer swi2cRead(int sda, int scl, int addr, int n) {
        int sdaN, sclN;
        if (n < 0) n = 0;
        if (n > 64) n = 64;
        if (!fbI2cPins(sda, scl, sdaN, sclN)) return mkBuffer(NULL, 0);
        uint8_t tmp[64];
        fbI2cStart(sdaN, sclN);
        if (!fbI2cWriteByte(sdaN, sclN, (uint8_t)((addr << 1) | 1))) {
            fbI2cStop(sdaN, sclN);
            return mkBuffer(NULL, 0);
        }
        for (int i = 0; i < n; i++) tmp[i] = fbI2cReadByte(sdaN, sclN, i < n - 1);
        fbI2cStop(sdaN, sclN);
        return mkBuffer(tmp, n);
    }

    // =========================================================================
    // PRECISION ToF — C++ sampler with hardware timestamps
    // =========================================================================
    // Goal: every sample from the laser sensor carries the real instant at
    // which the sensor finished measuring, without the block program having
    // to wait. Two modes:
    //   - With an INT pin: the module signals "sample ready" on its INT/GPIO1
    //     pin; the edge raises a CODAL pin event whose timestamp (us) is
    //     stored with the sample. Time precision ~ tens of us.
    //   - Without INT: a fiber polls the "sample ready" register every ~1 ms
    //     and timestamps the sample when it sees it (jitter ~ 1-6 ms).
    // The I2C reads are done in C++ (hardware bus at 400 kHz or the software
    // bus above), outside the TypeScript interpreter.
    // =========================================================================
    #define FB_TOF_MAX 3
    #define FB_TOF_ADDR 0x29
    struct FbTof {
        int type;                    // 0 VL6180X, 1 VL53L0X, 2 VL53L1X, -1 inactive
        int sdaN, sclN;              // GPIO numbers
        bool hw;                     // hardware bus (P20/P19)
        int intPinId;                // id of the INT pin or -1
        int intEvt;                  // edge that signals "sample ready"
        volatile uint32_t seq;       // sample number (changes with every sample)
        volatile int32_t  dist;      // mm; -1 = invalid
        volatile uint32_t tUs;       // sample instant (us of the system timer)
        volatile int32_t  status;    // raw chip status
        volatile uint32_t valid;
        volatile uint32_t invalid;
    };
    static FbTof fbTof[FB_TOF_MAX];
    static bool fbTofFiber = false;
    static bool fbTofInit = false;

    static bool fbTofWrite(FbTof &s, uint8_t *b, int len) {
        if (s.hw) return uBit.i2c.write(FB_TOF_ADDR << 1, b, len) == DEVICE_OK;
        fbI2cStart(s.sdaN, s.sclN);
        bool ok = fbI2cWriteByte(s.sdaN, s.sclN, (uint8_t)(FB_TOF_ADDR << 1));
        for (int i = 0; ok && i < len; i++) ok = fbI2cWriteByte(s.sdaN, s.sclN, b[i]);
        fbI2cStop(s.sdaN, s.sclN);
        return ok;
    }
    static bool fbTofRead(FbTof &s, uint8_t *b, int len) {
        if (s.hw) return uBit.i2c.read(FB_TOF_ADDR << 1, b, len) == DEVICE_OK;
        fbI2cStart(s.sdaN, s.sclN);
        if (!fbI2cWriteByte(s.sdaN, s.sclN, (uint8_t)((FB_TOF_ADDR << 1) | 1))) {
            fbI2cStop(s.sdaN, s.sclN);
            return false;
        }
        for (int i = 0; i < len; i++) b[i] = fbI2cReadByte(s.sdaN, s.sclN, i < len - 1);
        fbI2cStop(s.sdaN, s.sclN);
        return true;
    }
    static bool fbTofR8(FbTof &s, uint8_t reg, uint8_t *b, int len) {
        return fbTofWrite(s, &reg, 1) && fbTofRead(s, b, len);
    }
    static bool fbTofW8(FbTof &s, uint8_t reg, uint8_t v) {
        uint8_t b[2] = { reg, v };
        return fbTofWrite(s, b, 2);
    }
    static bool fbTofR16(FbTof &s, uint16_t reg, uint8_t *b, int len) {
        uint8_t r[2] = { (uint8_t)(reg >> 8), (uint8_t)reg };
        return fbTofWrite(s, r, 2) && fbTofRead(s, b, len);
    }
    static bool fbTofW16(FbTof &s, uint16_t reg, uint8_t v) {
        uint8_t b[3] = { (uint8_t)(reg >> 8), (uint8_t)reg, v };
        return fbTofWrite(s, b, 3);
    }

    // Is a new sample ready? (non-blocking)
    static bool fbTofReady(FbTof &s) {
        uint8_t b = 0;
        switch (s.type) {
            case 0: return fbTofR16(s, 0x004F, &b, 1) && (b & 0x07) == 0x04;
            case 1: return fbTofR8(s, 0x13, &b, 1) && (b & 0x07) != 0;
            case 2: return fbTofR16(s, 0x0031, &b, 1) && (b & 0x01) == 1;
        }
        return false;
    }

    // Reads the sample, clears the chip interrupt and publishes it with its timestamp
    static void fbTofTake(FbTof &s, uint32_t tUs) {
        uint8_t b[2] = { 0, 0 };
        int d = -1, st = 0;
        bool ok = false;
        switch (s.type) {
            case 0:   // VL6180X
                ok = fbTofR16(s, 0x0062, b, 1); d = b[0];
                fbTofR16(s, 0x004D, &b[1], 1); st = b[1] >> 4;
                fbTofW16(s, 0x0015, 0x07);
                if (!ok || (st != 0 && st != 11) || d >= 255) d = -1;
                break;
            case 1:   // VL53L0X
                ok = fbTofR8(s, 0x1E, b, 2); d = (b[0] << 8) | b[1];
                fbTofW8(s, 0x0B, 0x01);
                if (!ok || d == 0 || d >= 8000) d = -1;
                break;
            case 2:   // VL53L1X
                ok = fbTofR16(s, 0x0096, b, 2); d = (b[0] << 8) | b[1];
                fbTofR16(s, 0x0089, &b[0], 1); st = b[0] & 0x1F;
                fbTofW16(s, 0x0086, 0x01);
                if (!ok || st != 9 || d == 0) d = -1;
                break;
        }
        s.status = st;
        s.dist = d;
        s.tUs = tUs;
        if (d >= 0) s.valid++; else s.invalid++;
        s.seq++;
    }

    // Edge on the INT pin: the event timestamp was captured by CODAL in the ISR
    static void fbTofOnInt(Event e) {
        for (int i = 0; i < FB_TOF_MAX; i++) {
            FbTof &s = fbTof[i];
            if (s.type >= 0 && s.intPinId == (int)e.source) {
                fbTofTake(s, (uint32_t)e.timestamp);
            }
        }
    }

    // Polling for the sensors without an INT pin
    static void fbTofLoop(void *) {
        while (true) {
            for (int i = 0; i < FB_TOF_MAX; i++) {
                FbTof &s = fbTof[i];
                if (s.type < 0 || s.intPinId >= 0) continue;
                if (fbTofReady(s)) fbTofTake(s, (uint32_t)system_timer_current_time_us());
            }
            fiber_sleep(1);
        }
    }

    static void fbTofEnsureInit() {
        if (fbTofInit) return;
        for (int i = 0; i < FB_TOF_MAX; i++) { fbTof[i].type = -1; fbTof[i].intPinId = -1; }
        fbTofInit = true;
    }

    // Pauses sampling of sensor `idx` (to reconfigure it from TS).
    //%
    int tofStop(int idx) {
        fbTofEnsureInit();
        if (idx < 0 || idx >= FB_TOF_MAX) return 0;
        FbTof &s = fbTof[idx];
        s.type = -1;
        if (s.intPinId >= 0) {
            uBit.messageBus.ignore(s.intPinId, s.intEvt, fbTofOnInt);
            s.intPinId = -1;
        }
        return 1;
    }

    // Registers sensor `idx` (0..2), already initialized by TS, in the sampler:
    // type 0/1/2, SDA/SCL pins packed ((sda << 16) | scl, DigitalPin ids) and
    // INT pin (id or -1). Returns 1 if it is now sampling.
    // (The MakeCode native compiler allows at most 4 parameters.)
    //%
    int tofStart(int idx, int type, int pins, int intPin) {
        int sda = (pins >> 16) & 0xFFFF;
        int scl = pins & 0xFFFF;
        fbTofEnsureInit();
        if (idx < 0 || idx >= FB_TOF_MAX || type < 0 || type > 2) return 0;
        tofStop(idx);
        FbTof &s = fbTof[idx];
        MicroBitPin *pa = pxt::getPin(sda);
        MicroBitPin *pb = pxt::getPin(scl);
        if (!pa || !pb) return 0;
        s.sdaN = pa->name; s.sclN = pb->name;
        s.hw = (sda == MICROBIT_ID_IO_P20 && scl == MICROBIT_ID_IO_P19);
        if (s.hw) uBit.i2c.setFrequency(400000);
        s.seq = 0; s.dist = -1; s.tUs = 0; s.status = 0; s.valid = 0; s.invalid = 0;
        if (intPin >= 0) {
            MicroBitPin *pInt = pxt::getPin(intPin);
            if (pInt && pInt != pa && pInt != pb) {
                s.intPinId = pInt->id;
                // VL53L1X: INT active high (rising edge); VL53L0X and
                // VL6180X: active low (falling edge)
                s.intEvt = (type == 2) ? DEVICE_PIN_EVT_RISE : DEVICE_PIN_EVT_FALL;
                pInt->setPull(codal::PullMode::Up);
                pInt->eventOn(DEVICE_PIN_EVENT_ON_EDGE);
                uBit.messageBus.listen(s.intPinId, s.intEvt, fbTofOnInt);
            }
        }
        s.type = type;
        if (!fbTofFiber) {
            create_fiber(fbTofLoop, NULL);
            fbTofFiber = true;
        }
        return 1;
    }

    // Number of the last sample of sensor `idx` (changes with every sample).
    //%
    int tofSeq(int idx) {
        if (idx < 0 || idx >= FB_TOF_MAX || !fbTofInit) return 0;
        return (int)fbTof[idx].seq;
    }

    // Distance (mm) of the last sample, -1 if it was invalid.
    //%
    int tofDist(int idx) {
        if (idx < 0 || idx >= FB_TOF_MAX || !fbTofInit) return -1;
        return fbTof[idx].dist;
    }

    // Instant of the last sample in tenths of a millisecond (system timer).
    //%
    int tofTimeTenths(int idx) {
        if (idx < 0 || idx >= FB_TOF_MAX || !fbTofInit) return 0;
        return (int)(fbTof[idx].tUs / 100);
    }

    // Statistics: which = 0 valid samples, 1 invalid, 2 raw status.
    //%
    int tofStats(int idx, int which) {
        if (idx < 0 || idx >= FB_TOF_MAX || !fbTofInit) return 0;
        FbTof &s = fbTof[idx];
        if (which == 0) return (int)s.valid;
        if (which == 1) return (int)s.invalid;
        return s.status;
    }

    // =========================================================================
    // ULTRASONIC HC-SR04 / HY-SRF05 — C++ sampler with hardware timing
    // =========================================================================
    // The sensor measures the time of flight of a 40 kHz burst: TRIG receives
    // a 10 us pulse and ECHO stays high for the round-trip time. Here:
    //   - A dedicated fiber fires TRIG at a fixed period and measures the echo
    //     width with MicroBitPin::getPulseUs(), the same interrupt-driven
    //     capture (us timestamps) used by pins.pulseIn and the official
    //     MakeCode pxt-sonar extension. While waiting for the echo only this
    //     fiber blocks; the block program keeps running.
    //   - Sample instant = trigger + 0.5 ms + width/2 (the sensor emits the
    //     burst ~0.5 ms after the trigger; the sound reaches the object
    //     halfway through the echo). Speed of sound follows the air temperature.
    //   - Single-wire mode (HY-SRF05 with OUT to GND, 3-pin modules): the
    //     same pin triggers and listens.
    // =========================================================================
    #define FB_US_MAX 3
    struct FbUs {
        bool active;
        MicroBitPin *trig;
        MicroBitPin *echo;
        int echoId;
        bool singleWire;
        int maxMm;
        int periodMs;
        uint32_t timeoutUs;
        uint32_t speedMmPerS;        // speed of sound in mm/s
        uint32_t tLastTrigUs;
        volatile uint32_t seq;
        volatile int32_t  distMm;    // -1 = no echo / out of range
        volatile int32_t  echoUs;
        volatile uint32_t tUs;
        volatile uint32_t valid;
        volatile uint32_t invalid;
    };
    static FbUs fbUs[FB_US_MAX];
    static bool fbUsInit = false;
    static bool fbUsFiber = false;

    static void fbUsPublish(FbUs &s, int dist, int echo, uint32_t tUs) {
        s.distMm = dist;
        s.echoUs = echo;
        s.tUs = tUs;
        if (dist >= 0) s.valid++; else s.invalid++;
        s.seq++;
    }

    static void fbUsMeasure(FbUs &s, uint32_t now) {
        // Trigger: 10 us pulse on TRIG (as in pxt-sonar)
        if (s.singleWire) s.echo->eventOn(DEVICE_PIN_EVENT_NONE);
        s.trig->setDigitalValue(0);
        fbDelayCycles(64);                 // ~3 us low
        s.trig->setDigitalValue(1);
        fbDelayCycles(214);                // ~10 us high
        s.trig->setDigitalValue(0);
        if (s.singleWire) s.echo->getDigitalValue();   // back to input
        s.tLastTrigUs = now;

        // Echo width with CODAL's interrupt-driven capture (same as
        // pins.pulseIn): blocks only this fiber until the end of the echo or
        // the maximum time for the selected range.
        s.echo->setPolarity(1);
        int w = s.echo->getPulseUs((int)s.timeoutUs);
        if (w == DEVICE_CANCELLED || w <= 0) {
            fbUsPublish(s, -1, 0, (uint32_t)system_timer_current_time_us());
            return;
        }
        uint32_t echo = (uint32_t)w;
        // mm = echo(us) * v(mm/s) / 1e6 / 2
        int dist = (int)(((uint64_t)echo * s.speedMmPerS + 1000000ULL) / 2000000ULL);
        if (echo < 100 || dist > s.maxMm) fbUsPublish(s, -1, (int)echo, now + 500 + echo / 2);
        else fbUsPublish(s, dist, (int)echo, now + 500 + echo / 2);
    }

    static void fbUsLoop(void *) {
        while (true) {
            for (int i = 0; i < FB_US_MAX; i++) {
                FbUs &s = fbUs[i];
                if (!s.active) continue;
                uint32_t now = (uint32_t)system_timer_current_time_us();
                if ((uint32_t)(now - s.tLastTrigUs) < (uint32_t)s.periodMs * 1000u) continue;
                // If a clone module left ECHO high, wait for it to drop (max 300 ms)
                if (!s.singleWire && s.echo->getDigitalValue() == 1 && (uint32_t)(now - s.tLastTrigUs) < 300000u) continue;
                fbUsMeasure(s, now);
            }
            fiber_sleep(1);
        }
    }

    static void fbUsEnsureInit() {
        if (fbUsInit) return;
        for (int i = 0; i < FB_US_MAX; i++) { fbUs[i].active = false; fbUs[i].echoId = -1; }
        fbUsInit = true;
    }

    static void fbUsApplyConfig(FbUs &s, int maxMm, int periodMs, int speedMmPerS) {
        if (maxMm < 50) maxMm = 50;
        if (maxMm > 6000) maxMm = 6000;
        s.maxMm = maxMm;
        s.speedMmPerS = (uint32_t)(speedMmPerS > 0 ? speedMmPerS : 343400);
        // maximum time of flight + margin
        uint32_t flightUs = (uint32_t)(((uint64_t)maxMm * 2ull * 1000000ull) / s.speedMmPerS);
        s.timeoutUs = flightUs + 3000;
        if (periodMs <= 0) periodMs = (int)(flightUs / 1000) + 8;    // auto: flight + echo settling
        if (periodMs < 15) periodMs = 15;
        if (periodMs > 500) periodMs = 500;
        s.periodMs = periodMs;
    }

    // Stops sensor `idx`.
    //%
    int usStop(int idx) {
        fbUsEnsureInit();
        if (idx < 0 || idx >= FB_US_MAX) return 0;
        FbUs &s = fbUs[idx];
        s.active = false;
        s.echoId = -1;
        return 1;
    }

    // Starts sensor `idx` (0..2): TRIG/ECHO pins packed
    // ((trig << 16) | echo, DigitalPin ids; same pin = single wire),
    // maximum range in mm and period in ms (0 = automatic). The speed of
    // sound starts at 343400 mm/s (20 degC) and is changed with usConfigure.
    // Returns 1 if it is now measuring. (At most 4 parameters per native function.)
    //%
    int usStart(int idx, int pins, int maxMm, int periodMs) {
        int trigPin = (pins >> 16) & 0xFFFF;
        int echoPin = pins & 0xFFFF;
        int speedMmPerS = 343400;
        fbUsEnsureInit();
        if (idx < 0 || idx >= FB_US_MAX) return 0;
        usStop(idx);
        FbUs &s = fbUs[idx];
        MicroBitPin *pt = pxt::getPin(trigPin);
        MicroBitPin *pe = pxt::getPin(echoPin);
        if (!pt || !pe) return 0;
        s.trig = pt;
        s.echo = pe;
        s.singleWire = (pt == pe);
        s.echoId = pe->id;
        s.seq = 0; s.distMm = -1; s.echoUs = 0; s.tUs = 0; s.valid = 0; s.invalid = 0;
        s.tLastTrigUs = 0;
        fbUsApplyConfig(s, maxMm, periodMs, speedMmPerS);
        pt->setPull(codal::PullMode::None);
        pt->setDigitalValue(0);
        if (!s.singleWire) pe->getDigitalValue();      // digital input, no pull (as in pxt-sonar)
        s.active = true;
        if (!fbUsFiber) {
            create_fiber(fbUsLoop, NULL);
            fbUsFiber = true;
        }
        return 1;
    }

    // Changes range (mm), period (ms, 0 = auto) and speed of sound (mm/s) without restarting.
    //%
    int usConfigure(int idx, int maxMm, int periodMs, int speedMmPerS) {
        fbUsEnsureInit();
        if (idx < 0 || idx >= FB_US_MAX || !fbUs[idx].active) return 0;
        fbUsApplyConfig(fbUs[idx], maxMm, periodMs, speedMmPerS);
        return fbUs[idx].periodMs;
    }

    // Number of the last sample (changes with every trigger).
    //%
    int usSeq(int idx) {
        if (idx < 0 || idx >= FB_US_MAX || !fbUsInit) return 0;
        return (int)fbUs[idx].seq;
    }

    // Distance (mm) of the last sample; -1 if there was no valid echo.
    //%
    int usDist(int idx) {
        if (idx < 0 || idx >= FB_US_MAX || !fbUsInit) return -1;
        return fbUs[idx].distMm;
    }

    // Width of the last echo in us.
    //%
    int usEcho(int idx) {
        if (idx < 0 || idx >= FB_US_MAX || !fbUsInit) return 0;
        return fbUs[idx].echoUs;
    }

    // Instant of the last sample in tenths of a ms (system timer).
    //%
    int usTimeTenths(int idx) {
        if (idx < 0 || idx >= FB_US_MAX || !fbUsInit) return 0;
        return (int)(fbUs[idx].tUs / 100);
    }

    // Statistics: which = 0 valid, 1 invalid, 2 actual period (ms),
    // 3 current level of the ECHO pin (1 = high).
    //%
    int usStats(int idx, int which) {
        if (idx < 0 || idx >= FB_US_MAX || !fbUsInit) return 0;
        FbUs &s = fbUs[idx];
        if (which == 0) return (int)s.valid;
        if (which == 1) return (int)s.invalid;
        if (which == 3) return (s.active && !s.singleWire) ? s.echo->getDigitalValue() : 0;
        return s.periodMs;
    }

}
