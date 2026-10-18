// =============================================================================
//  tcs3200.ts — TCS230 color sensor as a spectrophotometer
// =============================================================================
//  Project: FisicaBit.com
//  Description: Module for the TCS230 color sensor configured as an
//               educational spectrophotometer. Measures the period of the
//               TCS230 frequency output, calibrates against a white
//               reference, and computes transmittance (%) and absorbance.
//
//  DEFAULT WIRING:
//    S0  → P13  (frequency scaling)
//    S1  → P14  (frequency scaling)
//    S2  → P15  (channel selection)
//    S3  → P9   (channel selection)
//    OUT → P1   (frequency signal)
//
//  OPERATING PRINCIPLE:
//    The TCS230 outputs a square wave whose frequency is proportional
//    to the light intensity of the selected channel (R, G, B, Clear).
//    We measure the PERIOD (μs) instead of the frequency to avoid counters.
//    Long period = little light, short period = a lot of light.
//
//  SPECTROPHOTOMETRY:
//    Transmittance T = (white_period / sample_period) × 100
//    Absorbance    A = log₁₀(sample_period / white_period)
//    (A = -log₁₀(T/100) = log₁₀(100/T))
// =============================================================================

/** TCS230 color sensor used as an educational colorimeter / spectrophotometer. */
//% weight=85
//% color=#7B2D8E
//% icon="\uf0eb"
//% block="TCS230"
//% groups='["TCS230 Setup (S0=P13 S1=P14 S2=P15 S3=P9 OUT=P1)", "Measurement", "Calibration", "Spectrophotometry", "Advanced"]'
namespace fisicabitColorimeter {

    // ── Default pins ──
    let _pinS0 = DigitalPin.P13
    let _pinS1 = DigitalPin.P14
    let _pinS2 = DigitalPin.P15
    let _pinS3 = DigitalPin.P9
    let _pinOut = 1  // pin number for the C++ shim

    // ── State ──
    let _initialized = false
    let _averageSamples = 10
    let _timeoutUs = 500000  // 500ms

    // ── White calibration (period in μs per channel) ──
    let _whiteRed = 0
    let _whiteGreen = 0
    let _whiteBlue = 0
    let _whiteClear = 0

    // ── Last reading (period in μs per channel) ──
    let _lastRed = 0
    let _lastGreen = 0
    let _lastBlue = 0
    let _lastClear = 0

    // =========================================================================
    // Internal functions
    // =========================================================================

    function _selectChannel(channel: FbTCS230Channel): void {
        switch (channel) {
            case FbTCS230Channel.Red:
                pins.digitalWritePin(_pinS2, 0)
                pins.digitalWritePin(_pinS3, 0)
                break
            case FbTCS230Channel.Green:
                pins.digitalWritePin(_pinS2, 1)
                pins.digitalWritePin(_pinS3, 1)
                break
            case FbTCS230Channel.Blue:
                pins.digitalWritePin(_pinS2, 0)
                pins.digitalWritePin(_pinS3, 1)
                break
            case FbTCS230Channel.Clear:
                pins.digitalWritePin(_pinS2, 1)
                pins.digitalWritePin(_pinS3, 0)
                break
        }
        control.waitMicros(100) // photodiode settling
    }

    function _applyScaling(scaling: FbTCS230Scaling): void {
        switch (scaling) {
            case FbTCS230Scaling.Off:
                pins.digitalWritePin(_pinS0, 0)
                pins.digitalWritePin(_pinS1, 0)
                break
            case FbTCS230Scaling.Scale2:
                pins.digitalWritePin(_pinS0, 0)
                pins.digitalWritePin(_pinS1, 1)
                break
            case FbTCS230Scaling.Scale20:
                pins.digitalWritePin(_pinS0, 1)
                pins.digitalWritePin(_pinS1, 0)
                break
            case FbTCS230Scaling.Scale100:
                pins.digitalWritePin(_pinS0, 1)
                pins.digitalWritePin(_pinS1, 1)
                break
        }
    }

    function _readPeriod(channel: FbTCS230Channel): number {
        _selectChannel(channel)
        if (_averageSamples <= 1) {
            return fisicabitNative.tcs3200ReadPeriodUs(_pinOut, _timeoutUs)
        } else {
            return fisicabitNative.tcs3200ReadBurstUs(_pinOut, _averageSamples, _timeoutUs)
        }
    }

    function _getWhite(channel: FbTCS230Channel): number {
        switch (channel) {
            case FbTCS230Channel.Red: return _whiteRed
            case FbTCS230Channel.Green: return _whiteGreen
            case FbTCS230Channel.Blue: return _whiteBlue
            case FbTCS230Channel.Clear: return _whiteClear
            default: return 0
        }
    }

    // =========================================================================
    // Blocks — Setup
    // =========================================================================

    /**
     * Initializes the TCS230 sensor with the default pins.
     * Scaling: 20% (good speed/precision trade-off).
     *
     * Physical connection TCS230 → micro:bit:
     *   VCC → 3V
     *   GND → GND
     *   S0  → P13
     *   S1  → P14
     *   S2  → P15
     *   S3  → P9
     *   OUT → P1
     *   OE  → GND (always enabled)
     */
    //% blockId=fisicabit_tcs_inicializar
    //% block="initialize TCS230 color sensor"
    //% group="TCS230 Setup (S0=P13 S1=P14 S2=P15 S3=P9 OUT=P1)" weight=100
    export function tcsInit(): void {
        _applyScaling(FbTCS230Scaling.Scale20)
        _initialized = true
    }

    /**
     * Initializes the TCS230 with custom pins.
     * @param s0 S0 pin (scaling)
     * @param s1 S1 pin (scaling)
     * @param s2 S2 pin (channel)
     * @param s3 S3 pin (channel)
     * @param out OUT pin (frequency signal) — pin number (0-16)
     */
    //% blockId=fisicabit_tcs_inicializar_custom
    //% block="initialize TCS230 S0 %s0 S1 %s1 S2 %s2 S3 %s3 OUT P %out"
    //% group="TCS230 Setup (S0=P13 S1=P14 S2=P15 S3=P9 OUT=P1)" weight=99
    //% s0.defl=DigitalPin.P13 s1.defl=DigitalPin.P14
    //% s2.defl=DigitalPin.P15 s3.defl=DigitalPin.P9
    //% out.min=0 out.max=16 out.defl=1
    export function tcsInitCustom(s0: DigitalPin, s1: DigitalPin, s2: DigitalPin, s3: DigitalPin, out: number): void {
        _pinS0 = s0
        _pinS1 = s1
        _pinS2 = s2
        _pinS3 = s3
        _pinOut = out
        _applyScaling(FbTCS230Scaling.Scale20)
        _initialized = true
    }

    /**
     * Sets the output frequency scaling of the TCS230.
     * @param scaling scaling level
     */
    //% blockId=fisicabit_tcs_escalado
    //% block="set TCS230 frequency scaling %scaling"
    //% group="TCS230 Setup (S0=P13 S1=P14 S2=P15 S3=P9 OUT=P1)" weight=98
    export function tcsSetScaling(scaling: FbTCS230Scaling): void {
        _applyScaling(scaling)
    }

    /**
     * Sets the number of samples averaged per reading.
     * @param samples number of periods to average (1-50)
     */
    //% blockId=fisicabit_tcs_muestras
    //% block="set TCS230 averaging samples %samples"
    //% group="TCS230 Setup (S0=P13 S1=P14 S2=P15 S3=P9 OUT=P1)" weight=97
    //% samples.min=1 samples.max=50 samples.defl=10
    export function tcsSetSamples(samples: number): void {
        _averageSamples = Math.clamp(1, 50, samples)
    }

    // =========================================================================
    // Blocks — Measurement
    // =========================================================================

    /**
     * Reads the period (μs) of one TCS230 channel.
     * Long period = little light, short period = a lot of light.
     * @param channel color channel to read
     */
    //% blockId=fisicabit_tcs_leer_canal
    //% block="TCS230 period (μs) channel %channel"
    //% group="Measurement" weight=90
    export function tcsReadChannel(channel: FbTCS230Channel): number {
        return _readPeriod(channel)
    }

    /**
     * Reads all channels (R, G, B, Clear) and stores the results.
     * Use the getter blocks to retrieve each value.
     */
    //% blockId=fisicabit_tcs_leer_todos
    //% block="TCS230 read all channels"
    //% group="Measurement" weight=89
    export function tcsReadAll(): void {
        _lastRed = _readPeriod(FbTCS230Channel.Red)
        _lastGreen = _readPeriod(FbTCS230Channel.Green)
        _lastBlue = _readPeriod(FbTCS230Channel.Blue)
        _lastClear = _readPeriod(FbTCS230Channel.Clear)
    }

    /**
     * Returns the last value read for a channel (after "read all channels").
     * @param channel channel to query
     */
    //% blockId=fisicabit_tcs_valor
    //% block="TCS230 last value %channel (μs)"
    //% group="Measurement" weight=88
    export function tcsValue(channel: FbTCS230Channel): number {
        switch (channel) {
            case FbTCS230Channel.Red: return _lastRed
            case FbTCS230Channel.Green: return _lastGreen
            case FbTCS230Channel.Blue: return _lastBlue
            case FbTCS230Channel.Clear: return _lastClear
            default: return 0
        }
    }

    /**
     * Reads a channel with a specific number of samples (without changing the global setting).
     * @param channel color channel
     * @param samples number of periods to average
     */
    //% blockId=fisicabit_tcs_leer_promedio
    //% block="TCS230 averaged period (μs) channel %channel samples %samples"
    //% group="Measurement" weight=87
    //% samples.min=1 samples.max=50 samples.defl=10
    export function tcsReadAveraged(channel: FbTCS230Channel, samples: number): number {
        _selectChannel(channel)
        let n = Math.clamp(1, 50, samples)
        return fisicabitNative.tcs3200ReadBurstUs(_pinOut, n, _timeoutUs)
    }

    // =========================================================================
    // Blocks — Calibration
    // =========================================================================

    /**
     * Calibrates the white reference (I₀). Place the cuvette with pure solvent
     * or the white reference in front of the sensor before running this block.
     * The values are used to compute transmittance and absorbance.
     */
    //% blockId=fisicabit_tcs_calibrar_blanco
    //% block="TCS230 calibrate white reference"
    //% group="Calibration" weight=80
    export function tcsCalibrateWhite(): void {
        _whiteRed = _readPeriod(FbTCS230Channel.Red)
        _whiteGreen = _readPeriod(FbTCS230Channel.Green)
        _whiteBlue = _readPeriod(FbTCS230Channel.Blue)
        _whiteClear = _readPeriod(FbTCS230Channel.Clear)
    }

    /**
     * Manually sets the white calibration value for a channel.
     * @param channel color channel
     * @param periodUs reference period in μs
     */
    //% blockId=fisicabit_tcs_fijar_blanco
    //% block="TCS230 set white reference %channel to %periodUs μs"
    //% group="Calibration" weight=79
    export function tcsSetWhite(channel: FbTCS230Channel, periodUs: number): void {
        switch (channel) {
            case FbTCS230Channel.Red: _whiteRed = periodUs; break
            case FbTCS230Channel.Green: _whiteGreen = periodUs; break
            case FbTCS230Channel.Blue: _whiteBlue = periodUs; break
            case FbTCS230Channel.Clear: _whiteClear = periodUs; break
        }
    }

    /**
     * Returns the stored white calibration value for a channel.
     * @param channel color channel
     */
    //% blockId=fisicabit_tcs_blanco_valor
    //% block="TCS230 white reference %channel (μs)"
    //% group="Calibration" weight=78
    export function tcsWhiteValue(channel: FbTCS230Channel): number {
        return _getWhite(channel)
    }

    // =========================================================================
    // Blocks — Spectrophotometry
    // =========================================================================

    /**
     * Computes the transmittance (%) of a channel.
     * T = (white_period / sample_period) × 100
     * Requires a previous calibration with "calibrate white reference".
     * @param channel color channel
     */
    //% blockId=fisicabit_tcs_transmitancia
    //% block="TCS230 transmittance (percent) channel %channel"
    //% group="Spectrophotometry" weight=70
    export function tcsTransmittance(channel: FbTCS230Channel): number {
        let white = _getWhite(channel)
        if (white <= 0) return 0
        let sample = _readPeriod(channel)
        if (sample <= 0) return 0
        // T = (white / sample) × 100
        // Short period = a lot of light = high transmittance
        return Math.roundWithPrecision((white / sample) * 100, 1)
    }

    /**
     * Computes the absorbance of a channel.
     * A = log₁₀(sample_period / white_period)
     * Requires a previous calibration with "calibrate white reference".
     * @param channel color channel
     */
    //% blockId=fisicabit_tcs_absorbancia
    //% block="TCS230 absorbance channel %channel"
    //% group="Spectrophotometry" weight=69
    export function tcsAbsorbance(channel: FbTCS230Channel): number {
        let white = _getWhite(channel)
        if (white <= 0) return 0
        let sample = _readPeriod(channel)
        if (sample <= 0) return 0
        // A = log₁₀(sample / white) = -log₁₀(T/100)
        let ratio = sample / white
        if (ratio <= 0) return 0
        // log₁₀(x) = ln(x) / ln(10)
        return Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
    }

    /**
     * Computes transmittance from already measured values (no new reading).
     * @param samplePeriod sample period in μs
     * @param whitePeriod white reference period in μs
     */
    //% blockId=fisicabit_tcs_transmitancia_manual
    //% block="transmittance (percent) sample %samplePeriod white %whitePeriod μs"
    //% group="Spectrophotometry" weight=68
    export function tcsTransmittanceManual(samplePeriod: number, whitePeriod: number): number {
        if (whitePeriod <= 0 || samplePeriod <= 0) return 0
        return Math.roundWithPrecision((whitePeriod / samplePeriod) * 100, 1)
    }

    /**
     * Computes absorbance from already measured values (no new reading).
     * @param samplePeriod sample period in μs
     * @param whitePeriod white reference period in μs
     */
    //% blockId=fisicabit_tcs_absorbancia_manual
    //% block="absorbance sample %samplePeriod white %whitePeriod μs"
    //% group="Spectrophotometry" weight=67
    export function tcsAbsorbanceManual(samplePeriod: number, whitePeriod: number): number {
        if (whitePeriod <= 0 || samplePeriod <= 0) return 0
        let ratio = samplePeriod / whitePeriod
        return Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
    }

    // =========================================================================
    // Blocks — Advanced
    // =========================================================================

    /**
     * Reads a single TCS230 period without averaging (raw reading).
     * @param channel color channel
     */
    //% blockId=fisicabit_tcs_crudo
    //% block="TCS230 raw single period (μs) channel %channel"
    //% group="Advanced" weight=60
    export function tcsReadRaw(channel: FbTCS230Channel): number {
        _selectChannel(channel)
        return fisicabitNative.tcs3200ReadPeriodUs(_pinOut, _timeoutUs)
    }

    /**
     * Sets the timeout for TCS230 readings.
     * @param timeoutMs timeout in milliseconds
     */
    //% blockId=fisicabit_tcs_timeout
    //% block="set TCS230 timeout %timeoutMs ms"
    //% group="Advanced" weight=59
    //% timeoutMs.min=50 timeoutMs.max=2000 timeoutMs.defl=500
    export function tcsSetTimeout(timeoutMs: number): void {
        _timeoutUs = Math.clamp(50, 2000, timeoutMs) * 1000
    }

    /**
     * Sends the data of all channels over serial (for plotting).
     * Format: R:value,G:value,B:value,C:value
     */
    //% blockId=fisicabit_tcs_serial
    //% block="TCS230 send all channels via serial"
    //% group="Advanced" weight=58
    export function tcsSendSerial(): void {
        tcsReadAll()
        serial.writeLine(
            "R:" + _lastRed +
            ",G:" + _lastGreen +
            ",B:" + _lastBlue +
            ",C:" + _lastClear
        )
    }

    /**
     * Sends spectrophotometry data over serial.
     * Format: channel,period_us,transmittance_%,absorbance
     * @param channel color channel
     */
    //% blockId=fisicabit_tcs_serial_spectro
    //% block="TCS230 send spectro data via serial channel %channel"
    //% group="Advanced" weight=57
    export function tcsSendSerialSpectro(channel: FbTCS230Channel): void {
        let white = _getWhite(channel)
        let sample = _readPeriod(channel)
        let T = 0
        let A = 0
        if (white > 0 && sample > 0) {
            T = Math.roundWithPrecision((white / sample) * 100, 1)
            let ratio = sample / white
            A = Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
        }
        let name = ""
        switch (channel) {
            case FbTCS230Channel.Red: name = "R"; break
            case FbTCS230Channel.Green: name = "G"; break
            case FbTCS230Channel.Blue: name = "B"; break
            case FbTCS230Channel.Clear: name = "C"; break
        }
        serial.writeLine(name + "," + sample + "," + T + "," + A)
    }
}
