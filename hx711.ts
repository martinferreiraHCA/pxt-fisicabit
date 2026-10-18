// =============================================================================
//  hx711.ts — HX711 load cell module (mass and force)
// =============================================================================
//  Project: FisicaBit.com
//  Chip: AVIA Semiconductor HX711 (24-bit ADC for load cells)
//  Communication: proprietary 2-wire protocol (DOUT + PD_SCK)
//  Power supply: 2.6V – 5.5V, typically 3.3V or 5V
//
//  WIRING (generic HX711 module with load cell):
//    ┌──────────────────────────────────────────────┐
//    │  Load cell             HX711 module          │
//    │  ┌──────────┐          ┌──────────────┐      │
//    │  │ Red   (E+)│────────│E+             │      │
//    │  │ Black (E-)│────────│E-             │      │
//    │  │ White (A-)│────────│A-             │      │
//    │  │ Green (A+)│────────│A+             │      │
//    │  └──────────┘          │              │      │
//    │                        │  VCC  │──── 3V      │
//    │                        │  GND  │──── GND     │
//    │                        │  DOUT │──── P0      │  (data)
//    │                        │  SCK  │──── P1      │  (clock)
//    │                        └──────────────┘      │
//    └──────────────────────────────────────────────┘
//
//    ⚠ Load cell wire colors may vary by manufacturer.
//      Check the datasheet of your model.
//
//  HX711 PROTOCOL:
//    1. Wait for DOUT → LOW (data ready, ~100ms at 10 Hz)
//    2. Send 24 pulses on PD_SCK, read DOUT on each rising edge
//       → yields a 24-bit two's complement value
//    3. Send 1–3 extra pulses to configure the gain of the
//       NEXT reading:
//       - 25 pulses total → gain 128, channel A (default)
//       - 26 pulses total → gain 32,  channel B
//       - 27 pulses total → gain 64,  channel A
//
//    ⚠ If PD_SCK stays HIGH for >60μs, the HX711 enters
//      power-down mode. The C++ shim disables interrupts
//      during the read to avoid this.
//
//  SAMPLE RATE:
//    - RATE pin → GND: 10 Hz (default on most modules)
//    - RATE pin → VCC: 80 Hz
//
//  FILTERING (based on the olkal/HX711_ADC library):
//    Circular buffer of 18 samples with trimmed mean:
//    - 18 readings are stored in a circular buffer
//    - The highest and lowest readings are discarded (outlier rejection)
//    - The remaining 16 are averaged using a bit shift (÷16 = >>4)
//    - Fill time at 10 Hz: 18 × 100ms = 1.8 seconds
//    - This automatically rejects readings corrupted by interrupts
//
//  CALIBRATION:
//    To get values in grams/Newtons a calibration is needed:
//    1. Tare the scale (no load → set zero)
//    2. Place a known mass (e.g. 100g)
//    3. Compute factor = (smoothed_reading - tare) / known_mass
//    4. mass (g) = (smoothed_reading - tare) / factor
//    5. force (N) = mass (kg) × g (9.81 m/s²)
//
//  USE IN A FOREVER LOOP (non-blocking):
//    The measurement blocks (mass, force) are non-blocking:
//    - They check whether new data is available (DOUT LOW)
//    - If there is data: read it (~80μs) and add it to the circular buffer
//    - Return the current smoothed value of the buffer (trimmed mean)
//    - If there is no data: return the last smoothed value without blocking
//
//  REFERENCES:
//    - olkal/HX711_ADC (Arduino): circular buffer + trimmed mean
//    - bogde/HX711 (Arduino): noInterrupts() during bit-bang
//    - HX711 datasheet: T3 max 50μs, power-down if SCK HIGH >60μs
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// C++ shim — 24-bit read with interrupts disabled
// On hardware it uses fisicabitNative::hx711ReadRawNative (shims.cpp).
// In the simulator it uses the TS body as fallback.
// Do NOT declare in nativeShims.ts (a double declaration confuses pxt).
// ─────────────────────────────────────────────────────────────────────────────
/** Internal namespace: binding to the native HX711 reader in shims.cpp. */
namespace fisicabitNative {
    /**
     * Internal helper, not a block. Reads the HX711 24-bit ADC with interrupt
     * protection. Non-blocking: returns 0 if DOUT is HIGH (data not ready).
     * Returns [1..0xFFFFFF] (unsigned value after XOR 0x800000).
     *
     * @param doutPinId DOUT pin ID (DigitalPin enum value)
     * @param sckPinId SCK pin ID (DigitalPin enum value)
     * @param extraGain extra pulses: 1=gain128, 2=gain32, 3=gain64
     */
    //% shim=fisicabitNative::hx711ReadRawNative
    export function hx711ReadRawNative(doutPinId: number, sckPinId: number, extraGain: number): number {
        // ── Simulator fallback ──
        // Simulates a sensor with readings around the midpoint (0x800000)
        // with a bit of noise for realistic testing.
        return 0x800000 + Math.randomRange(-200, 200)
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// HX711 module — main namespace
// ─────────────────────────────────────────────────────────────────────────────
/** HX711 load cell amplifier: mass and force measurement for physics experiments. */
//% weight=87
//% color=#4682B4
//% icon="\uf24e"
//% block="HX711"
//% groups='["Configuration", "Calibration", "Measurement", "Diagnostics"]'
namespace fisicabitHX711 {

    // =========================================================================
    // Filter constants (based on olkal/HX711_ADC config.h)
    // =========================================================================

    const SAMPLES = 16          // Useful samples for the average (power of 2)
    const IGNORE_HIGH = 1       // Discard the highest reading (outlier)
    const IGNORE_LOW = 1        // Discard the lowest reading (outlier)
    const BUFFER_TOTAL = 18     // SAMPLES + IGNORE_HIGH + IGNORE_LOW
    const DIV_BIT = 4           // log2(SAMPLES) = log2(16) = 4
    const GRAVITY = 9.81        // m/s²
    const SIGNAL_TIMEOUT = 1500 // ms without data → sensor disconnected

    // ── Pins (stored as DigitalPin for the C++ shim) ──
    let _hxDout: DigitalPin = DigitalPin.P0
    let _hxSck: DigitalPin = DigitalPin.P1

    // ── State ──
    let _hxReady = false
    let _hxCalibrated = false
    let _hxExtraGain = 1        // Extra pulses: 1=128, 2=32, 3=64

    // ── Circular buffer (trimmed moving average) ──
    let _hxBuffer: number[] = []
    let _hxIndex = 0
    let _hxBufferFull = false

    // ── Calibration ──
    let _hxTare: number = 0             // Tare offset (unsigned units)
    let _hxCalFactor: number = 1.0      // Factor: unsigned_ADC_units / gram
    let _hxCalFactorRecip: number = 1.0 // 1.0 / calFactor (precomputed for speed)

    // ── Timing ──
    let _hxLastDataMs = 0       // Timestamp of the last valid data
    let _hxNoSignal = false     // Timeout flag (sensor disconnected)

    // =========================================================================
    // Internal functions
    // =========================================================================

    /**
     * Resets the HX711 with a power-down/power-up cycle.
     * PD_SCK HIGH for >60μs → power-down, then LOW → power-up.
     * Waits 400ms for the internal ADC to settle (datasheet).
     */
    function _hxReset(): void {
        pins.digitalWritePin(_hxSck, 1)
        control.waitMicros(120)  // >60μs → guaranteed power-down
        pins.digitalWritePin(_hxSck, 0)
        basic.pause(400)         // internal ADC settling
    }

    /**
     * Non-blocking HX711 read via the C++ shim.
     * - If DOUT is LOW (data ready): reads 24 bits with IRQs disabled,
     *   applies XOR 0x800000, returns unsigned value [1..0xFFFFFF].
     * - If DOUT is HIGH (no data): returns 0 immediately.
     *
     * On real hardware ~80μs per read. In the simulator returns a simulated value.
     */
    function _hxReadShim(): number {
        return fisicabitNative.hx711ReadRawNative(
            _hxDout as number,
            _hxSck as number,
            _hxExtraGain
        )
    }

    /**
     * Non-blocking update: tries to read a new sample.
     * If data is available, it is added to the circular buffer.
     * Returns true if a new sample was read.
     *
     * Designed to be called inside a forever loop.
     * If there is no new data, returns false without blocking.
     */
    function _hxUpdate(): boolean {
        if (!_hxReady) return false

        let data = _hxReadShim()

        if (data > 0) {
            // Valid data: add to the circular buffer
            _hxBuffer[_hxIndex] = data
            _hxIndex++
            if (_hxIndex >= BUFFER_TOTAL) {
                _hxIndex = 0
                _hxBufferFull = true
            }
            _hxLastDataMs = input.runningTime()
            _hxNoSignal = false
            return true
        }

        // No new data — check timeout
        if (input.runningTime() - _hxLastDataMs > SIGNAL_TIMEOUT) {
            _hxNoSignal = true
        }
        return false
    }

    /**
     * Trimmed mean of the circular buffer.
     * Based on smoothedData() from olkal/HX711_ADC:
     * 1. Sum all values in the buffer (18 samples)
     * 2. Subtract the highest value (upper outlier rejection)
     * 3. Subtract the lowest value (lower outlier rejection)
     * 4. Divide by 16 using a bit shift (>>4)
     *
     * This automatically rejects readings corrupted by interrupts
     * (which typically yield 0xFFFFFF = all bits set).
     */
    function _hxSmoothedData(): number {
        let n = _hxBufferFull ? BUFFER_TOTAL : _hxIndex
        if (n == 0) return 0

        let sum = 0
        let minVal = 0xFFFFFF
        let maxVal = 0

        for (let i = 0; i < n; i++) {
            let v = _hxBuffer[i]
            sum += v
            if (v < minVal) minVal = v
            if (v > maxVal) maxVal = v
        }

        // Trim outliers only if we have enough samples
        if (n > 2) {
            sum -= minVal
            sum -= maxVal
            n -= 2
        }

        // Divide: if the buffer is full use a bit shift (fast),
        // otherwise a normal division
        if (_hxBufferFull) {
            return sum >> DIV_BIT  // ÷16 = >>4
        } else {
            return Math.idiv(sum, n)
        }
    }

    /**
     * Fills the circular buffer completely (blocking operation).
     * At 10 Hz it takes ~1.8 seconds (18 samples × 100ms).
     * Used for tare and calibration, where maximum stability is needed.
     * Safety timeout: 3 seconds.
     */
    function _hxFillBuffer(): void {
        _hxIndex = 0
        _hxBufferFull = false
        let timeout = input.runningTime() + 3000

        while (!_hxBufferFull) {
            if (input.runningTime() > timeout) break
            _hxUpdate()
            basic.pause(5)  // no busy-wait: yield to the scheduler
        }
    }

    // =========================================================================
    // PUBLIC BLOCKS — Configuration
    // =========================================================================

    /**
     * Initializes the HX711 module on the given pins.
     * Performs a power cycle (reset), discards the first unstable readings
     * and fills the circular buffer (~2 seconds).
     * Shows ✓ if the sensor responds correctly, ✗ otherwise.
     *
     * Physical connection HX711 → micro:bit:
     *   VCC  → 3V (or 5V depending on the module)
     *   GND  → GND
     *   DOUT → digital pin (data, e.g. P0)
     *   SCK  → digital pin (clock, e.g. P1)
     *
     * @param dout pin connected to DOUT (HX711 data)
     * @param sck pin connected to PD_SCK (HX711 clock)
     */
    //% blockId=fisicabit_hx711_inicializar
    //% block="initialize HX711 DOUT %dout SCK %sck"
    //% group="Configuration"
    //% weight=100
    //% dout.defl=DigitalPin.P0
    //% sck.defl=DigitalPin.P1
    export function hx711Init(dout: DigitalPin, sck: DigitalPin): void {
        _hxDout = dout
        _hxSck = sck

        // Initialize the circular buffer with zeros
        _hxBuffer = []
        for (let i = 0; i < BUFFER_TOTAL; i++) {
            _hxBuffer.push(0)
        }
        _hxIndex = 0
        _hxBufferFull = false

        // Reset: HX711 power cycle
        _hxReset()

        // Mark as ready so we can read
        _hxReady = true
        _hxLastDataMs = input.runningTime()

        // Fill the buffer with settled data (~1.8s at 10 Hz)
        _hxFillBuffer()

        // Check whether we received valid data
        if (!_hxBufferFull) {
            _hxReady = false
            basic.showIcon(IconNames.No)
        } else {
            basic.showIcon(IconNames.Yes)
        }

        // Reset calibration
        _hxTare = 0
        _hxCalFactor = 1.0
        _hxCalFactorRecip = 1.0
        _hxCalibrated = false

        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Sets the gain of the HX711 amplifier.
     * - 128 (channel A): highest sensitivity, ideal for small cells (≤10 kg)
     * - 64 (channel A):  medium sensitivity
     * - 32 (channel B):  lowest sensitivity, for large cells
     *
     * The gain applies from the NEXT reading on.
     * It is recommended to set it BEFORE taring and calibrating.
     * Refills the buffer with the new gain (~2 seconds).
     *
     * @param gain amplifier gain
     */
    //% blockId=fisicabit_hx711_ganancia
    //% block="set HX711 gain to %gain"
    //% group="Configuration"
    //% weight=98
    //% gain.defl=FbHX711Gain.G128
    export function hx711SetGain(gain: FbHX711Gain): void {
        // Convert from total pulses (25,26,27) to extra pulses (1,2,3)
        _hxExtraGain = gain - 24

        if (_hxReady) {
            // The new gain applies on the NEXT conversion.
            // Refill the buffer so that every sample uses the new gain.
            _hxFillBuffer()
        }
    }

    // =========================================================================
    // PUBLIC BLOCKS — Calibration
    // =========================================================================

    /**
     * Tares the scale (sets the current load as zero).
     * Call this block with NO load on the load cell.
     * Refills the whole buffer (~2s) and computes the average offset.
     *
     * ⚠ Taring is required before measuring mass or force.
     *   Without tare, values include the cell's own offset.
     */
    //% blockId=fisicabit_hx711_tarar
    //% block="HX711 tare (set zero)"
    //% group="Calibration"
    //% weight=95
    export function hx711Tare(): void {
        if (!_hxReady) return
        _hxFillBuffer()
        _hxTare = _hxSmoothedData()
    }

    /**
     * Calibrates the HX711 with a known mass.
     * Place the reference mass on the load cell and then run this block.
     * Refills the buffer (~2s) and computes the calibration factor.
     *
     * ⚠ The scale must be tared BEFORE calibrating.
     *   Steps: 1) tare without load → 2) place mass → 3) calibrate
     *
     * @param knownMass mass of the calibration object in grams
     */
    //% blockId=fisicabit_hx711_calibrar
    //% block="HX711 calibrate with %knownMass g"
    //% group="Calibration"
    //% weight=94
    //% knownMass.defl=100
    //% knownMass.min=1
    export function hx711Calibrate(knownMass: number): void {
        if (!_hxReady) return
        if (knownMass <= 0) return

        _hxFillBuffer()
        let reading = _hxSmoothedData()
        let diff = reading - _hxTare

        if (diff != 0) {
            _hxCalFactor = diff / knownMass
            _hxCalFactorRecip = 1.0 / _hxCalFactor
            _hxCalibrated = true
        }
    }

    /**
     * Sets the calibration factor directly.
     * Useful if you already know the factor of your load cell
     * (obtained in a previous calibration with "HX711 calibration factor").
     *
     * @param factor calibration factor (ADC units per gram)
     */
    //% blockId=fisicabit_hx711_set_factor
    //% block="set HX711 calibration factor %factor"
    //% group="Calibration"
    //% weight=93
    export function hx711SetFactor(factor: number): void {
        if (factor == 0) return
        _hxCalFactor = factor
        _hxCalFactorRecip = 1.0 / factor
        _hxCalibrated = true
    }

    // =========================================================================
    // PUBLIC BLOCKS — Measurement (non-blocking, for use in forever)
    // =========================================================================

    /**
     * Reads the mass in the selected unit (non-blocking).
     *
     * Ideal for use in a "forever" block:
     * - If there is new HX711 data → reads it and updates the buffer
     * - Returns the current trimmed mean (16 samples)
     * - If there is no new data → returns the last value without blocking
     *
     * For accurate results: tare and calibrate before measuring.
     *
     * @param unit mass unit (grams or kilograms)
     */
    //% blockId=fisicabit_hx711_masa
    //% block="HX711 mass in %unit"
    //% group="Measurement"
    //% weight=90
    //% unit.defl=FbMassUnit.Grams
    export function hx711Mass(unit: FbMassUnit): number {
        if (!_hxReady) return 0

        // Non-blocking update: read data if available
        _hxUpdate()

        let smoothed = _hxSmoothedData()
        let grams = (smoothed - _hxTare) * _hxCalFactorRecip

        switch (unit) {
            case FbMassUnit.Grams:
                return Math.round(grams * 10) / 10
            case FbMassUnit.Kilograms:
                return Math.round(grams / 100) / 10
            default:
                return Math.round(grams * 10) / 10
        }
    }

    /**
     * Reads the force in Newtons (non-blocking).
     * Computes F = m × g, where g is configurable (default 9.81 m/s²).
     *
     * Ideal for use in a "forever" block — same logic as hx711Mass.
     *
     * Example: a 100g object produces ~0.981 N.
     *
     * @param gravity gravitational acceleration in m/s² (default 9.81)
     */
    //% blockId=fisicabit_hx711_fuerza
    //% block="HX711 force (N) with g %gravity m/s²"
    //% group="Measurement"
    //% weight=89
    //% gravity.defl=9.81
    export function hx711Force(gravity: number): number {
        if (!_hxReady) return 0
        if (gravity <= 0) gravity = GRAVITY

        // Non-blocking update
        _hxUpdate()

        let smoothed = _hxSmoothedData()
        let grams = (smoothed - _hxTare) * _hxCalFactorRecip
        let kg = grams / 1000
        let newtons = kg * gravity

        return Math.round(newtons * 1000) / 1000
    }

    /**
     * Reads the raw ADC value (non-blocking).
     * Returns the trimmed mean of the buffer without calibration.
     * Useful for debugging or custom analysis.
     */
    //% blockId=fisicabit_hx711_crudo
    //% block="HX711 raw value"
    //% group="Measurement"
    //% weight=85
    export function hx711Raw(): number {
        if (!_hxReady) return 0
        _hxUpdate()
        return _hxSmoothedData()
    }

    /**
     * Reads the net raw value (trimmed mean minus tare).
     * Useful to observe the value without calibration but with tare applied.
     */
    //% blockId=fisicabit_hx711_crudo_neto
    //% block="HX711 net raw value (tared)"
    //% group="Measurement"
    //% weight=84
    export function hx711RawNet(): number {
        if (!_hxReady) return 0
        _hxUpdate()
        return _hxSmoothedData() - _hxTare
    }

    // =========================================================================
    // PUBLIC BLOCKS — Diagnostics
    // =========================================================================

    /**
     * Tells whether the HX711 module was detected and initialized correctly.
     */
    //% blockId=fisicabit_hx711_conectado
    //% block="HX711 connected"
    //% group="Diagnostics"
    //% weight=80
    export function hx711Connected(): boolean {
        return _hxReady && !_hxNoSignal
    }

    /**
     * Tells whether the HX711 has been calibrated.
     */
    //% blockId=fisicabit_hx711_calibrado
    //% block="HX711 calibrated"
    //% group="Diagnostics"
    //% weight=79
    export function hx711Calibrated(): boolean {
        return _hxCalibrated
    }

    /**
     * Returns the current calibration factor.
     * Useful to store it and reuse it without recalibrating.
     */
    //% blockId=fisicabit_hx711_get_factor
    //% block="HX711 calibration factor"
    //% group="Diagnostics"
    //% weight=78
    export function hx711GetFactor(): number {
        return _hxCalFactor
    }

    /**
     * Returns the current tare value (offset in unsigned units).
     */
    //% blockId=fisicabit_hx711_get_tara
    //% block="HX711 tare offset"
    //% group="Diagnostics"
    //% weight=77
    export function hx711GetTare(): number {
        return _hxTare
    }
}
