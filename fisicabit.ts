// =============================================================================
//  fisicabit.ts — Main MakeCode extension file for micro:bit
// =============================================================================
//  Project: FisicaBit.com
//  Description: Extension template for reading internal and external sensors,
//               with examples of C++ integration.
//
//  ARCHITECTURE OF A MAKECODE EXTENSION:
//  ─────────────────────────────────────
//  ┌─────────────────────────────────────────────────────────┐
//  │  MakeCode Editor (Blocks / TypeScript)                  │
//  │    └─► fisicabit.ts  ← THIS FILE                        │
//  │          Defines the visual blocks and the TS logic     │
//  ├─────────────────────────────────────────────────────────┤
//  │  Shim layer (TS ↔ C++ bridge)                           │
//  │    └─► nativeShims.ts    ← TypeScript declarations          │
//  │    └─► shims.cpp     ← Native C++ implementation        │
//  │          Direct access to the nRF52833 hardware         │
//  └─────────────────────────────────────────────────────────┘
//
//  HOW MAKECODE BLOCKS WORK:
//  ─────────────────────────
//  The //% annotations control how blocks are displayed:
//    //% block="text"          → Text shown on the block
//    //% blockId=id            → Unique block identifier
//    //% weight=N              → Order (higher = closer to the top)
//    //% color=#RRGGBB         → Block color
//    //% group="name"          → Groups blocks into sub-categories
//    //% advanced=true         → Shown in the "advanced" section
//    //% pin.defl=AnalogPin.P0 → Default value of the parameter
//
//  NAMING CONVENTION:
//  ──────────────────
//  - Namespace: camelCase; its //% block is the name shown in the toolbox
//  - Functions: camelCase, descriptive, in English
//  - Constants: UPPER_SNAKE_CASE
//  - Enums: PascalCase with the Fb prefix (defined in enums.d.ts)
// =============================================================================


// =============================================================================
// MAIN NAMESPACE — "FisicaBit sensors" appears in the MakeCode toolbox
// =============================================================================
/** Internal micro:bit sensors, analog/digital inputs, NTC thermistor and optical gates for physics experiments. */
//% weight=100
//% color=#E64322
//% icon=""
//% block="FisicaBit sensors"
//% groups="['Internal Sensors', 'External Sensors', 'Optical Barrier', 'Conversions', 'Native C++', 'Utilities']"
namespace fisicabit {

    // =========================================================================
    // GROUP 1: INTERNAL SENSORS (built into the micro:bit board)
    // =========================================================================
    // The micro:bit has these built-in sensors:
    //   - Temperature: thermistor inside the nRF52 chip (±4°C accuracy)
    //   - Accelerometer: LSM303AGR (v2), measures acceleration on 3 axes
    //   - Magnetometer: LSM303AGR (v2), digital compass
    //   - Light sensor: uses the LED matrix as a photodetector
    //   - Microphone: micro:bit v2 only, MEMS sensor
    // =========================================================================

    /**
     * Reads an internal micro:bit sensor and returns its numeric value.
     *
     * EXAMPLE IN BLOCKS:
     *   [FisicaBit: read internal sensor (Temperature)] → shows 23
     *
     * EXAMPLE IN TYPESCRIPT:
     *   let temp = fisicabit.readInternalSensor(FbInternalSensor.Temperature)
     *   basic.showNumber(temp)
     *
     * @param sensor The internal sensor to read (see enum FbInternalSensor)
     * @returns Numeric sensor value (the unit depends on the sensor)
     */
    //% block="read internal sensor %sensor"
    //% blockId=fisicabit_leer_sensor_interno
    //% group="Internal Sensors"
    //% weight=100
    //% sensor.defl=FbInternalSensor.Temperature
    export function readInternalSensor(sensor: FbInternalSensor): number {
        switch (sensor) {
            // ── Temperature ──────────────────────────────────────────
            // Reads the thermistor built into the nRF52833 chip.
            // Accuracy: ±4°C (not a laboratory thermometer)
            // Range: -40°C to +105°C
            // Note: it measures the CHIP temperature, not the ambient one.
            //       It can be 2-4°C above the real temperature.
            case FbInternalSensor.Temperature:
                return input.temperature()

            // ── Accelerometer (3 axes) ───────────────────────────────
            // Measures acceleration in milli-g (1g = 1000 milli-g)
            // Range: ±2g by default (configurable to ±4g, ±8g)
            // Axes: X = left/right
            //       Y = forward/backward
            //       Z = up/down (at rest ≈ -1024 due to gravity)
            case FbInternalSensor.AccelerometerX:
                return input.acceleration(Dimension.X)
            case FbInternalSensor.AccelerometerY:
                return input.acceleration(Dimension.Y)
            case FbInternalSensor.AccelerometerZ:
                return input.acceleration(Dimension.Z)

            // ── Light level ──────────────────────────────────────────
            // Uses the LEDs of the 5x5 matrix as photodetectors
            // Range: 0 (total darkness) to 255 (bright light)
            // Trick: LEDs can detect photons when driven in "reverse"
            //        mode. MakeCode does this automatically.
            case FbInternalSensor.LightLevel:
                return input.lightLevel()

            // ── Compass (heading) ────────────────────────────────────
            // Returns the heading in degrees (0-359)
            // 0° = North, 90° = East, 180° = South, 270° = West
            // IMPORTANT: requires calibration the first time
            //            (the "TILT TO FILL SCREEN" game appears)
            case FbInternalSensor.Compass:
                return input.compassHeading()

            // ── Sound level (micro:bit v2 only) ──────────────────────
            // MEMS microphone built into the micro:bit v2
            // Range: 0 (silence) to 255 (loud sound)
            // Note: on micro:bit v1 it always returns 0
            case FbInternalSensor.SoundLevel:
                return input.soundLevel()

            // ── G force (total magnitude) ────────────────────────────
            // Computes: √(x² + y² + z²) using the 3 axes
            // At rest ≈ 1024 (≈1g of gravity)
            // Useful to detect falls, impacts, vibration
            case FbInternalSensor.GForce:
                return input.acceleration(Dimension.Strength)

            default:
                return 0
        }
    }


    // NOTE: All acceleration-related code (constants, state, filters and
    // blocks) lives in the fisicabitKinematics namespace (kinematics.ts) —
    // this keeps the orange "FisicaBit sensors" category focused on raw
    // sensor reads and moves the derived kinematic magnitudes (a⃗, v⃗)
    // to their own blue category.

    // =========================================================================
    // GROUP 2: EXTERNAL SENSORS (connected to the GPIO pins)
    // =========================================================================
    //
    // MICRO:BIT PIN MAP (bottom edge):
    // ┌──────────────────────────────────────────────────┐
    // │  Pin   │ Type       │ Notes                      │
    // ├──────────────────────────────────────────────────┤
    // │  P0    │ Analog     │ Touch (v2), DAC            │
    // │  P1    │ Analog     │ Touch                      │
    // │  P2    │ Analog     │ Touch                      │
    // │  P3-P4 │ Digital    │ LED columns (shared)       │
    // │  P5-P11│ Digital    │ LED rows/cols (shared)     │
    // │  P8    │ Digital    │ Free, no conflict          │
    // │  P12   │ Digital    │ Free, no conflict          │
    // │  P13   │ Digital    │ SPI (SCK)                  │
    // │  P14   │ Digital    │ SPI (MISO)                 │
    // │  P15   │ Digital    │ SPI (MOSI)                 │
    // │  P16   │ Digital    │ Free, no conflict          │
    // │  P19   │ I2C        │ SCL (shared)               │
    // │  P20   │ I2C        │ SDA (shared)               │
    // └──────────────────────────────────────────────────┘
    //
    // RECOMMENDED PINS FOR EXTERNAL SENSORS:
    //   - Analog: P0, P1, P2 (the only ones with ADC)
    //   - Free digital: P8, P12, P16
    //   - I2C: P19+P20 (bus shared with the internal sensors)
    // =========================================================================

    /**
     * Reads an analog sensor connected to a pin.
     *
     * WIRING:
     *   Sensor → analog pin (P0, P1 or P2)
     *   VCC    → micro:bit 3V
     *   GND    → micro:bit GND
     *
     * EXAMPLE — Potentiometer on P0:
     *   ┌─────────────────┐
     *   │  Potentiometer   │
     *   │  ┌───┐          │
     *   │  │   │──── P0   │  (analog signal)
     *   │  │   │──── 3V   │  (power)
     *   │  │   │──── GND  │  (ground)
     *   │  └───┘          │
     *   └─────────────────┘
     *
     * @param pin Analog pin the sensor is connected to
     * @returns Value between 0 and 1023 (10-bit ADC resolution)
     */
    //% block="read analog sensor on %pin"
    //% blockId=fisicabit_leer_analogico
    //% group="External Sensors"
    //% weight=90
    //% pin.defl=FbAnalogPin.P0
    export function readAnalogSensor(pin: FbAnalogPin): number {
        // The nRF52833 ADC is 12-bit internally, but MakeCode
        // scales it to 10 bits (0-1023) for compatibility
        switch (pin) {
            case FbAnalogPin.P0: return pins.analogReadPin(AnalogPin.P0)
            case FbAnalogPin.P1: return pins.analogReadPin(AnalogPin.P1)
            case FbAnalogPin.P2: return pins.analogReadPin(AnalogPin.P2)
            default: return 0
        }
    }


    /**
     * Reads a digital sensor (HIGH/LOW) connected to a pin.
     *
     * Useful for sensors such as:
     *   - PIR (motion): HIGH = motion detected
     *   - Switches/buttons: HIGH/LOW depending on state
     *   - Infrared sensor: HIGH = obstacle detected
     *
     * WIRING — PIR sensor on P8:
     *   ┌─────────────────┐
     *   │  PIR sensor      │
     *   │  ┌───────┐      │
     *   │  │  OUT  │──── P8   (digital signal)
     *   │  │  VCC  │──── 3V   (power)
     *   │  │  GND  │──── GND  (ground)
     *   │  └───────┘      │
     *   └─────────────────┘
     *
     * @param pin Digital pin number (e.g. 8 for P8, 12 for P12)
     * @returns 0 (LOW) or 1 (HIGH)
     */
    //% block="read digital sensor on P%pin"
    //% blockId=fisicabit_leer_digital
    //% group="External Sensors"
    //% weight=85
    //% pin.defl=8
    export function readDigitalSensor(pin: number): number {
        return pins.digitalReadPin(pin as any)
    }


    // =========================================================================
    // GROUP 2b: NTC 10K 3950 TEMPERATURE SENSOR
    // =========================================================================
    //
    // HOW IT WORKS:
    //   The NTC (Negative Temperature Coefficient) is a resistor whose
    //   value DECREASES as temperature rises. At 25°C it is 10kΩ.
    //
    //   It is wired in a voltage divider with a fixed 10kΩ resistor.
    //   The micro:bit reads the voltage at the midpoint and computes the
    //   temperature with the Beta equation (simplified Steinhart-Hart):
    //
    //     1/T = 1/T₀ + (1/β) × ln(R_ntc / R₀)
    //
    //   where T₀ = 298.15 K (25°C), R₀ = 10000 Ω, β = 3950
    //
    // WIRING:
    //   ┌─────────────────────────────────────────────┐
    //   │                                             │
    //   │  3V ─── [10kΩ fixed] ──┬─── Analog pin      │
    //   │                        │    (P0, P1 or P2)  │
    //   │                   [NTC 10kΩ]                │
    //   │                        │                    │
    //   │                       GND                   │
    //   │                                             │
    //   └─────────────────────────────────────────────┘
    //
    //   ⚠ The NTC has 2 leads (no polarity); it does not matter which
    //     one goes to GND and which to the divider midpoint.
    //
    // ACCURACY:
    //   The 10-bit ADC (0-1023) gives ~0.15°C of resolution in the
    //   0-50°C range. Enough for physics experiments.
    // =========================================================================

    /**
     * Reads the temperature of an NTC 10K 3950 sensor connected to an
     * analog pin with a fixed 10kΩ resistor as a voltage divider.
     *
     * Returns the temperature with 1 decimal place.
     *
     * @param pin Analog pin the NTC is connected to
     * @param unit Desired temperature unit
     * @returns Measured temperature (1 decimal place)
     */
    //% block="NTC 10K temperature on %pin in %unit"
    //% blockId=fisicabit_ntc_10k
    //% group="External Sensors"
    //% weight=88
    //% pin.defl=FbAnalogPin.P0
    //% unit.defl=FbTemperatureUnit.Celsius
    export function readNtcTemperature(pin: FbAnalogPin, unit: FbTemperatureUnit): number {
        let reading: number
        switch (pin) {
            case FbAnalogPin.P0: reading = pins.analogReadPin(AnalogPin.P0); break
            case FbAnalogPin.P1: reading = pins.analogReadPin(AnalogPin.P1); break
            case FbAnalogPin.P2: reading = pins.analogReadPin(AnalogPin.P2); break
            default: reading = 0
        }

        // Guard against extreme readings (saturated voltage divider)
        if (reading <= 0) reading = 1
        if (reading >= 1023) reading = 1022

        // Voltage divider: R_ntc = R_fixed × reading / (1023 - reading)
        let rNtc = 10000.0 * reading / (1023 - reading)

        // Beta equation: 1/T = 1/T₀ + (1/β) × ln(R_ntc / R₀)
        // T₀ = 298.15 K (25°C), β = 3950, R₀ = 10000 Ω
        let invT = 1.0 / 298.15 + (1.0 / 3950) * Math.log(rNtc / 10000)
        let tempC = 1.0 / invT - 273.15

        // Convert to the requested unit (1 decimal place)
        switch (unit) {
            case FbTemperatureUnit.Celsius:
                return Math.round(tempC * 10) / 10
            case FbTemperatureUnit.Fahrenheit:
                return Math.round((tempC * 9 / 5 + 32) * 10) / 10
            case FbTemperatureUnit.Kelvin:
                return Math.round((tempC + 273.15) * 10) / 10
            default:
                return Math.round(tempC * 10) / 10
        }
    }


    // =========================================================================
    // GROUP 4: OPTICAL GATE — Time measurement between two sensors
    // =========================================================================
    //
    // WHAT IS AN OPTICAL GATE?
    // ────────────────────────
    // A light emitter-receiver pair (usually infrared) that detects when
    // an object interrupts the light beam. We use TWO gates separated by
    // a known distance to measure:
    //
    //   - TRANSIT TIME: how long the object takes to go from A to B
    //   - SPEED: distance / time (if the separation is known)
    //   - ACCELERATION: comparing speeds over consecutive segments
    //
    // TYPICAL SETUP (side view):
    //
    //   Gate A                       Gate B
    //   ┌──┐                        ┌──┐
    //   │IR│   ───object──►         │IR│
    //   │TX│        ●               │TX│
    //   └──┘    ┌───┴───┐           └──┘
    //   ┌──┐    │ ramp   │          ┌──┐
    //   │IR│    └────────┘          │IR│
    //   │RX│                        │RX│
    //   └──┘                        └──┘
    //    P1                          P2
    //   (pin A)     distance       (pin B)
    //           ◄──────────────►
    //               (known)
    //
    //
    // FC-33 SENSOR (slot module):
    // ──────────────────────────
    //   ┌─────────────────────────┐
    //   │  FC-33                  │
    //   │  ┌───┐    ┌───┐        │  The IR LED and the phototransistor
    //   │  │LED│    │PHO│        │  sit in a ~10mm slot.
    //   │  │ IR│    │TOT│        │  The object passes through the slot
    //   │  │   │    │   │        │  and cuts the beam.
    //   │  └─┬─┘    └─┬─┘        │
    //   │    └──┬──┬──┘          │
    //   │       │  │  │          │  Pins:
    //   │      VCC GND OUT       │  - VCC: 3.3V-5V
    //   └─────────────────────────┘  - GND: ground
    //                                - OUT: LOW when the beam is cut
    //   ⚠ The FC-33 has an LM393 comparator with a sensitivity
    //     trimmer potentiometer on the board. The threshold is
    //     adjusted with a screwdriver, NOT by software.
    //
    //   FC-33 signal:
    //   HIGH ─────┐         ┌─────── HIGH (beam free)
    //             │         │
    //   LOW       └─────────┘         (beam cut = object present)
    //             ↑         ↑
    //          object    object
    //          enters    leaves
    //
    //
    // DIY SETUP WITH IR LED + PHOTOTRANSISTOR:
    // ────────────────────────────────────────
    //
    //   EMITTER (IR LED):
    //   3V ──── R(100Ω) ──── IR LED anode(+) ──── cathode(-) ──── GND
    //
    //   RECEIVER (phototransistor):
    //   3V ──── Phototransistor(C) ───┬──── P1 (analog signal)
    //                                 │
    //                            R(10KΩ)
    //                                 │
    //                                GND
    //
    //   No object (beam free):   P1 ≈ 800-1023 (lots of light → high voltage)
    //   With object (beam cut):  P1 ≈ 0-200   (little light → low voltage)
    //
    //   Analog signal of the DIY setup:
    //   1023 ─────┐         ┌─────── (beam free, lots of light)
    //             │         │
    //             │  ~200   │
    //             └─────────┘         (beam cut, little light)
    //              ↑         ↑
    //           object    object
    //           enters    leaves
    //
    //   ADVANTAGE: the threshold is adjusted IN SOFTWARE → ideal for
    //   experimenting and calibrating from MakeCode without touching hardware.
    //
    //
    // TIMING ACCURACY:
    // ────────────────
    // Time measurement uses the native C++ functions (shims.cpp)
    // with the nRF52833 TIMER3 configured at 1MHz (1 tick = 1μs).
    //
    //   Pure TypeScript:  ~1ms resolution (uses the scheduler)
    //   C++ with TIMER:   ~1μs resolution (direct access)
    //
    // For an object at 1 m/s passing gates 10cm apart:
    //   Real time:   100,000 μs = 100 ms
    //   TS error:    ±1ms = ±1% → acceptable
    //   C++ error:   ±1μs = ±0.001% → excellent
    //
    // For an object at 5 m/s (free fall ~1.3m):
    //   Real time:   20,000 μs = 20 ms
    //   TS error:    ±1ms = ±5% → problematic
    //   C++ error:   ±1μs = ±0.005% → excellent
    //
    // CONCLUSION: For physics experiments with fast objects,
    // ALWAYS use the native C++ functions (group "Native C++").
    // =========================================================================

    // ── Internal variables for the gate state ──
    let _gateThresholdA = 512   // Analog threshold of gate A (0-1023)
    let _gateThresholdB = 512   // Analog threshold of gate B (0-1023)
    let _gateStartTime = 0      // Timestamp when gate A was triggered
    let _gateEndTime = 0        // Timestamp when gate B was triggered
    let _gateActive = false     // Waiting for the object to pass gate B?


    /**
     * Sets the trigger threshold for an analog gate.
     *
     * Only applies in Analog mode (DIY IR LED).
     * In Digital mode (FC-33) the threshold is set with the physical
     * potentiometer on the module.
     *
     * HOW TO CALIBRATE:
     *   1. No object in the gate → note the value (e.g. 850)
     *   2. Object blocking the gate → note the value (e.g. 120)
     *   3. Threshold = midpoint = (850 + 120) / 2 = 485
     *   4. Use this block to set the threshold to 485
     *
     * TIP: Send the raw values over serial to find the ideal
     *      threshold for your setup.
     *
     * @param gate Which gate to configure ("A" = first, "B" = second)
     * @param threshold Value from 0 to 1023 separating "beam free" from "beam cut"
     */
    //% block="set barrier %gate threshold to %threshold"
    //% blockId=fisicabit_barrera_umbral
    //% group="Optical Barrier"
    //% weight=99
    //% threshold.min=0 threshold.max=1023 threshold.defl=512
    //% gate.defl="A"
    export function setGateThreshold(gate: string, threshold: number): void {
        if (gate === "A" || gate === "a") {
            _gateThresholdA = threshold
        } else {
            _gateThresholdB = threshold
        }
    }


    /**
     * Reads the raw value of an optical gate (for calibration).
     *
     * Use this block to see which values your sensor produces
     * and find the right threshold.
     *
     * CALIBRATION EXAMPLE:
     *   basic.forever(() => {
     *       let rawA = fisicabit.readGateRaw(FbAnalogPin.P1, FbGateMode.Analog)
     *       serial.writeValue("gateARaw", rawA)
     *       basic.pause(100)
     *   })
     *
     * @param pin Pin the gate is connected to
     * @param mode Digital (FC-33) or Analog (DIY IR)
     * @returns Raw value: Digital → 0 or 1, Analog → 0 to 1023
     */
    //% block="read barrier raw pin %pin mode %mode"
    //% blockId=fisicabit_barrera_crudo
    //% group="Optical Barrier"
    //% weight=98
    //% pin.defl=FbAnalogPin.P1
    //% mode.defl=FbGateMode.Analog
    export function readGateRaw(pin: FbAnalogPin, mode: FbGateMode): number {
        if (mode === FbGateMode.Digital) {
            return pins.digitalReadPin(pin as number as DigitalPin)
        } else {
            return pins.analogReadPin(pin as number as AnalogPin)
        }
    }


    /**
     * Checks whether an optical gate is triggered (object present).
     *
     * In DIGITAL mode (FC-33):
     *   - Returns true when OUT = LOW (beam cut)
     *   - The FC-33 drives its output LOW when an object cuts the beam
     *
     * In ANALOG mode (DIY IR):
     *   - Returns true when the reading < configured threshold
     *   - Less light = less voltage = object blocking
     *
     * @param pin Gate pin
     * @param mode Digital or Analog
     * @returns true if an object is cutting the beam
     */
    //% block="barrier triggered on %pin mode %mode"
    //% blockId=fisicabit_barrera_activada
    //% group="Optical Barrier"
    //% weight=97
    //% pin.defl=FbAnalogPin.P1
    //% mode.defl=FbGateMode.Digital
    export function gateActivated(pin: FbAnalogPin, mode: FbGateMode): boolean {
        if (mode === FbGateMode.Digital) {
            // FC-33: LOW output = object present
            return pins.digitalReadPin(pin as number as DigitalPin) === 0
        } else {
            // DIY IR: analog reading below the threshold = object present
            let value = pins.analogReadPin(pin as number as AnalogPin)
            let threshold = (pin === FbAnalogPin.P1) ? _gateThresholdA :
                            (pin === FbAnalogPin.P2) ? _gateThresholdB :
                            _gateThresholdA
            return value < threshold
        }
    }


    /**
     * Measures the time an object takes to go from gate A to gate B.
     * TYPESCRIPT VERSION — ~1ms resolution (uses control.millis).
     *
     * OPERATION:
     *   1. Waits for gate A to trigger (object enters)
     *   2. Captures the start timestamp
     *   3. Waits for gate B to trigger (object arrives)
     *   4. Captures the end timestamp
     *   5. Returns the difference: end - start
     *
     * LIMITATIONS:
     *   - ~1ms resolution (enough for slow objects)
     *   - For fast objects (>2 m/s) use measureGateTimeNative()
     *   - Blocks until both gates trigger (or timeout)
     *
     * FC-33 WIRING (two modules):
     *   FC-33 #1 OUT → P1 (gate A)
     *   FC-33 #2 OUT → P2 (gate B)
     *   Both VCC → 3V, GND → GND
     *
     * DIY IR WIRING (two emitter/receiver pairs):
     *   Receiver #1 → P1 (gate A, analog)
     *   Receiver #2 → P2 (gate B, analog)
     *
     * @param pinA Pin of gate A (the first one to trigger)
     * @param pinB Pin of gate B (the second one to trigger)
     * @param mode Digital (FC-33) or Analog (DIY IR)
     * @param timeoutMs Maximum timeout in milliseconds (0 = no timeout)
     * @returns Time between gates in milliseconds, -1 on timeout
     */
    //% block="measure time barrier A %pinA → B %pinB mode %mode timeout %timeoutMs ms"
    //% blockId=fisicabit_barrera_tiempo
    //% group="Optical Barrier"
    //% weight=95
    //% pinA.defl=FbAnalogPin.P1
    //% pinB.defl=FbAnalogPin.P2
    //% mode.defl=FbGateMode.Digital
    //% timeoutMs.defl=10000
    export function measureGateTime(
        pinA: FbAnalogPin,
        pinB: FbAnalogPin,
        mode: FbGateMode,
        timeoutMs: number
    ): number {
        let start = control.millis()

        // ── Phase 1: Wait for gate A to be FREE ──
        // (make sure there is no object before starting)
        while (gateActivated(pinA, mode)) {
            if (timeoutMs > 0 && (control.millis() - start) > timeoutMs) {
                return -1
            }
            // Short pause so we do not saturate the bus
            control.waitMicros(50)
        }

        // ── Phase 2: Wait for gate A to TRIGGER ──
        // (the object reaches the first gate)
        while (!gateActivated(pinA, mode)) {
            if (timeoutMs > 0 && (control.millis() - start) > timeoutMs) {
                return -1
            }
            control.waitMicros(50)
        }

        // ── Capture start time ──
        let t0 = control.millis()

        // ── Phase 3: Wait for gate B to TRIGGER ──
        // (the object reaches the second gate)
        while (!gateActivated(pinB, mode)) {
            if (timeoutMs > 0 && (control.millis() - t0) > timeoutMs) {
                return -1
            }
            control.waitMicros(50)
        }

        // ── Capture end time ──
        let t1 = control.millis()

        // ── Store for later queries ──
        _gateStartTime = t0
        _gateEndTime = t1
        _gateActive = false

        return t1 - t0
    }


    //% shim=fisicabitNative::gateNative
    function _hwGate(pins: number, mode: number, thresholds: number, timeoutUs: number): number {
        return -1   // simulator: use the TypeScript version
    }

    /**
     * Measures the time between two gates using native C++.
     * HIGH PRECISION VERSION — 1μs resolution.
     *
     * Uses the nRF52833 TIMER3 at 1MHz for precise timing.
     * In the simulator it falls back to the TypeScript version.
     *
     * WHEN TO USE THIS VERSION:
     *   - Objects in free fall (>1 m/s)
     *   - Acceleration measurement (you need high precision)
     *   - Short distances between gates (<5cm)
     *   - Any experiment where ±1ms is too much error
     *
     * @param pinA Pin number of gate A (e.g. 1 for P1)
     * @param pinB Pin number of gate B (e.g. 2 for P2)
     * @param mode Digital (0) or Analog (1)
     * @param thresholdA Analog threshold of gate A (ignored in digital mode)
     * @param thresholdB Analog threshold of gate B (ignored in digital mode)
     * @param timeoutUs Timeout in microseconds
     * @returns Time in microseconds, 0 on timeout
     */
    //% block="[C++] barrier time A P%pinA → B P%pinB mode %mode threshA %thresholdA threshB %thresholdB timeout %timeoutUs μs"
    //% blockId=fisicabit_barrera_nativo
    //% group="Optical Barrier"
    //% weight=93
    //% pinA.defl=1 pinB.defl=2
    //% mode.defl=FbGateMode.Digital
    //% thresholdA.defl=512 thresholdB.defl=512
    //% timeoutUs.defl=5000000
    export function measureGateTimeNative(
        pinA: number,
        pinB: number,
        mode: FbGateMode,
        thresholdA: number,
        thresholdB: number,
        timeoutUs: number
    ): number {
        // Hardware: C++ in shims.cpp (pins and thresholds are packed because
        // native functions accept at most 4 parameters). Returns ≥ 0.
        const r = _hwGate((pinA << 16) | pinB, mode, (thresholdA << 16) | thresholdB, timeoutUs)
        if (r >= 0) return r
        // ── Simulator fallback ──
        let t = measureGateTime(
            pinA as FbAnalogPin,
            pinB as FbAnalogPin,
            mode,
            Math.idiv(timeoutUs, 1000)
        )
        return t >= 0 ? t * 1000 : 0  // Convert ms→μs
    }


    /**
     * Computes the speed of an object from the time between gates.
     *
     * FORMULA: speed = distance / time
     *
     * EXAMPLE — Free fall:
     *   Gates 10cm (0.1m) apart
     *   Measured time: 50ms = 0.05s
     *   Speed: 0.1 / 0.05 = 2.0 m/s
     *
     * @param timeUs Time between gates in microseconds
     * @param distanceMm Distance between gates in millimeters
     * @returns Speed in m/s (multiplied by 100 for 2 decimal places)
     */
    //% block="velocity with time %timeUs μs distance %distanceMm mm (×100 m/s)"
    //% blockId=fisicabit_barrera_velocidad
    //% group="Optical Barrier"
    //% weight=91
    //% timeUs.defl=50000 distanceMm.defl=100
    export function computeSpeed(timeUs: number, distanceMm: number): number {
        // speed (m/s) = distance(mm) / time(μs) × 1000
        //             = distance(mm) * 1000 / time(μs)
        // Multiply by 100 to keep 2 decimal places as an integer
        // Example: 2.35 m/s → returns 235
        if (timeUs <= 0) return 0
        return Math.idiv(distanceMm * 100000, timeUs)
    }


    /**
     * Converts a time in microseconds to the desired unit.
     *
     * @param timeUs Time in microseconds
     * @param unit Desired output unit
     * @returns Time in the selected unit (×100 for 2 decimal places in ms and s)
     */
    //% block="convert %timeUs μs to %unit"
    //% blockId=fisicabit_barrera_convertir_tiempo
    //% group="Optical Barrier"
    //% weight=89
    //% unit.defl=FbTimeUnit.Milliseconds
    export function convertTime(timeUs: number, unit: FbTimeUnit): number {
        switch (unit) {
            case FbTimeUnit.Microseconds:
                return timeUs
            case FbTimeUnit.Milliseconds:
                // Returns ms × 100 for 2 decimal places → 12345μs = 1234 (12.34ms)
                return Math.idiv(timeUs, 10)
            case FbTimeUnit.Seconds:
                // Returns s × 100 for 2 decimal places → 1234567μs = 123 (1.23s)
                return Math.idiv(timeUs, 10000)
            default:
                return timeUs
        }
    }


    /**
     * Measures how long an object blocks a SINGLE gate.
     * Useful to measure the width/length of a moving object.
     *
     * If you know the speed of the object:
     *   length = speed × blocking_time
     *
     * @param pin Gate pin
     * @param mode Digital or Analog
     * @param timeoutMs Timeout in milliseconds
     * @returns Blocking time in milliseconds, -1 on timeout
     */
    //% block="blocking time on %pin mode %mode timeout %timeoutMs ms"
    //% blockId=fisicabit_barrera_bloqueo
    //% group="Optical Barrier"
    //% weight=87
    //% pin.defl=FbAnalogPin.P1
    //% mode.defl=FbGateMode.Digital
    //% timeoutMs.defl=10000
    export function measureBlockTime(
        pin: FbAnalogPin,
        mode: FbGateMode,
        timeoutMs: number
    ): number {
        let start = control.millis()

        // Wait for the gate to be free
        while (gateActivated(pin, mode)) {
            if (timeoutMs > 0 && (control.millis() - start) > timeoutMs) return -1
            control.waitMicros(50)
        }

        // Wait for the object to enter (block the gate)
        while (!gateActivated(pin, mode)) {
            if (timeoutMs > 0 && (control.millis() - start) > timeoutMs) return -1
            control.waitMicros(50)
        }
        let t0 = control.millis()

        // Wait for the object to leave (stop blocking)
        while (gateActivated(pin, mode)) {
            if (timeoutMs > 0 && (control.millis() - t0) > timeoutMs) return -1
            control.waitMicros(50)
        }
        let t1 = control.millis()

        return t1 - t0
    }


    // =========================================================================
    // GROUP 5: UNIT CONVERSIONS
    // =========================================================================

    /**
     * Converts a temperature between Celsius, Fahrenheit and Kelvin.
     *
     * Formulas:
     *   °F = °C × 9/5 + 32
     *   K  = °C + 273.15
     *
     * @param value Temperature to convert
     * @param unitFrom Source unit
     * @param unitTo Target unit
     * @returns Converted temperature
     */
    //% block="convert %value from %unitFrom to %unitTo"
    //% blockId=fisicabit_convertir_temp
    //% group="Conversions"
    //% weight=70
    export function convertTemperature(
        value: number,
        unitFrom: FbTemperatureUnit,
        unitTo: FbTemperatureUnit
    ): number {
        // First convert everything to Celsius as the base
        let celsius = value
        if (unitFrom === FbTemperatureUnit.Fahrenheit) {
            celsius = (value - 32) * 5 / 9
        } else if (unitFrom === FbTemperatureUnit.Kelvin) {
            celsius = value - 273
        }

        // Then convert from Celsius to the target unit
        switch (unitTo) {
            case FbTemperatureUnit.Celsius:
                return Math.round(celsius)
            case FbTemperatureUnit.Fahrenheit:
                return Math.round(celsius * 9 / 5 + 32)
            case FbTemperatureUnit.Kelvin:
                return Math.round(celsius + 273)
            default:
                return Math.round(celsius)
        }
    }


    /**
     * Maps an analog value (0-1023) to a custom range.
     *
     * Useful to convert raw ADC readings into physical units.
     * Formula: result = (value - fromLow) × (toHigh - toLow)
     *                   / (fromHigh - fromLow) + toLow
     *
     * EXAMPLE — Convert an NTC reading to temperature:
     *   let reading = fisicabit.readAnalogSensor(FbAnalogPin.P0)
     *   let tempC = fisicabit.mapValue(reading, 0, 1023, -10, 50)
     *
     * @param value Input value to map
     * @param fromLow Lower bound of the input range
     * @param fromHigh Upper bound of the input range
     * @param toLow Lower bound of the output range
     * @param toHigh Upper bound of the output range
     * @returns Value mapped to the new range
     */
    //% block="map %value from (%fromLow — %fromHigh) to (%toLow — %toHigh)"
    //% blockId=fisicabit_mapear
    //% group="Conversions"
    //% weight=65
    export function mapValue(
        value: number,
        fromLow: number,
        fromHigh: number,
        toLow: number,
        toHigh: number
    ): number {
        return Math.round(
            (value - fromLow) * (toHigh - toLow)
            / (fromHigh - fromLow)
            + toLow
        )
    }


    // =========================================================================
    // GROUP 6: NATIVE C++ FUNCTIONS (via shims)
    // =========================================================================
    // These functions call compiled C++ code directly.
    // They are faster than TypeScript for low-level operations.
    //
    // HOW THE TS ↔ C++ BRIDGE WORKS:
    //   1. The function is declared in nativeShims.ts with //% shim=name
    //   2. It is implemented in shims.cpp under the same name
    //   3. MakeCode generates the bridge automatically at compile time
    //
    // See shims.cpp and nativeShims.ts for the implementations.
    // =========================================================================

    /**
     * Reads the nRF52 ADC directly using native C++ code.
     * This bypasses the MakeCode abstraction layer and is faster.
     *
     * Implementation: see shims.cpp → readAdcNative()
     *
     * @param channel ADC channel (0-7, corresponds to the analog pins)
     * @returns Raw 12-bit ADC value (0-4095)
     */
    //% block="[C++] read native ADC channel %channel"
    //% blockId=fisicabit_adc_nativo
    //% group="Native C++"
    //% weight=50
    //% shim=fisicabitNative::readAdcNative
    export function readAdcNative(channel: number): number {
        // This body only runs in the simulator.
        // On real hardware the C++ code in shims.cpp runs instead
        return pins.analogReadPin(AnalogPin.P0)
    }

    /**
     * Measures a pulse with microsecond precision using native C++.
     * Ideal for sensors that need precise timing (DHT11, OneWire).
     *
     * @param pin Digital pin number
     * @param high true to measure a HIGH pulse, false for LOW
     * @param timeoutUs Timeout in microseconds
     * @returns Pulse duration in microseconds
     */
    //% block="[C++] measure pulse pin P%pin level %high timeout %timeoutUs μs"
    //% blockId=fisicabit_pulso_nativo
    //% group="Native C++"
    //% weight=45
    //% shim=fisicabitNative::measurePulseNative
    export function measurePulseNative(pin: number, high: boolean, timeoutUs: number): number {
        // Simulator fallback
        return 0
    }

    /**
     * Reads multiple ADC samples quickly (burst mode) with C++.
     * Returns the average of N readings to reduce noise.
     *
     * @param channel ADC channel
     * @param samples Number of samples to average (1-64)
     * @returns Average of the readings (0-4095)
     */
    //% block="[C++] read ADC average channel %channel samples %samples"
    //% blockId=fisicabit_adc_promedio
    //% group="Native C++"
    //% weight=40
    //% shim=fisicabitNative::readAdcAveraged
    export function readAdcAveraged(channel: number, samples: number): number {
        // Simulator fallback: average in TS
        let sum = 0
        for (let i = 0; i < samples; i++) {
            sum += pins.analogReadPin(AnalogPin.P0)
        }
        return Math.idiv(sum, samples)
    }


    // =========================================================================
    // GROUP 7: UTILITIES
    // =========================================================================

    /**
     * Shows a sensor value on the LED screen with scrolling.
     * Format: "LABEL:VALUE"
     *
     * @param label Descriptive text (e.g. "Temp")
     * @param value Numeric value to show
     */
    //% block="show on LED %label : %value"
    //% blockId=fisicabit_mostrar_led
    //% group="Utilities"
    //% weight=30
    export function showOnLeds(label: string, value: number): void {
        basic.showString(label + ":" + Math.round(value))
    }
}
