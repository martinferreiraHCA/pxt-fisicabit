// =============================================================================
//  ds18b20.ts — DS18B20 temperature probe (Dallas/Maxim, OneWire)
// =============================================================================
//  Project: FisicaBit.com
//  Sensor: DS18B20 (waterproof stainless-steel probe or TO-92 package)
//  Protocol: OneWire (1 data wire), implemented in C++ (shims.cpp)
//  Power: 3 V – 5.5 V
//
//  WIRING (3-wire probe):
//    Red     (VDD)  → 3V
//    Black   (GND)  → GND
//    Yellow/white (DATA) → P0 (any digital pin)
//    ⚠ 4.7 kΩ pull-up resistor between DATA and 3V (mandatory; modules
//      with a breakout board usually include it).
//
//  ACCURACY: ±0.5 °C between −10 and 85 °C; range −55 to 125 °C.
//  RESOLUTION: 9 to 12 bits (0.5 to 0.0625 °C); the conversion takes from
//              94 ms (9 bits) to 750 ms (12 bits) and blocks the block.
//  SEVERAL PROBES: one per pin (each block names its pin).
//
//  The native code is adapted from "microbit-dstemp" by Bill Siever
//  (MIT license), with a real wait for the end of conversion and a
//  configurable resolution.
// =============================================================================

/** DS18B20 waterproof temperature probe (OneWire) for calorimetry and thermal experiments. */
//% weight=87
//% color=#E65100
//% icon=""
//% block="DS18B20"
//% groups='["Measurement", "Diagnostics"]'
namespace fisicabitDS18B20 {

    const RAW_ERROR = -100000

    let _bits = 12
    let _lastRaw = 0           // last valid raw value (1/16 °C)
    let _ok = false
    let _hasReading = false

    // ── Native shims (TS body = simulator) ──

    //% shim=fisicabitNative::ds18b20Read
    function _hwRead(pin: DigitalPin, bits: number): number {
        // Simulator: 25 °C with a small variation
        return 400 + (control.millis() / 500) % 8
    }

    //% shim=fisicabitNative::ds18b20Error
    function _hwError(): number {
        return 0
    }

    //% shim=fisicabitNative::ds18b20Present
    function _hwPresent(pin: DigitalPin): number {
        return 1
    }

    function _convert(raw: number, unit: FbTemperatureUnit): number {
        const c = raw / 16
        let v = c
        if (unit == FbTemperatureUnit.Fahrenheit) v = c * 9 / 5 + 32
        else if (unit == FbTemperatureUnit.Kelvin) v = c + 273.15
        return Math.round(v * 100) / 100
    }

    function _read(pin: DigitalPin): void {
        const raw = _hwRead(pin, _bits)
        if (raw == RAW_ERROR || raw < -1000 || raw > 2100) {
            // -55 °C = -880; 125 °C = 2000. Out of range = corrupt reading.
            _ok = false
            return
        }
        _lastRaw = raw
        _ok = true
        _hasReading = true
    }

    // =========================================================================
    // MEASUREMENT
    // =========================================================================

    /**
     * Reads the temperature of the DS18B20 probe connected to the pin.
     * Accuracy ±0.5 °C, resolution 0.06 °C (12 bits). The reading takes up
     * to 750 ms; if it fails, it returns the last valid temperature (0 if
     * there never was one).
     *
     * Wiring: red → 3V, black → GND, yellow (DATA) → P0, 4.7 kΩ resistor
     * between DATA and 3V.
     *
     * Example (calorimetry): [forever] → [send to fisicabit.com time and
     * (DS18B20 temperature on P0 in °C) every 1000 ms]
     * @param pin Digital pin where DATA is connected
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_ds18b20_temperatura
    //% block="DS18B20 temperature on %pin in %unit"
    //% group="Measurement"
    //% weight=90
    //% pin.defl=DigitalPin.P0
    //% unit.defl=FbTemperatureUnit.Celsius
    export function temperature(pin: DigitalPin, unit: FbTemperatureUnit): number {
        _read(pin)
        if (!_hasReading) return 0
        return _convert(_lastRaw, unit)
    }

    /**
     * Last valid temperature read, without querying the probe again.
     * Useful to send the same value in several units or to show it on the
     * display without waiting for another conversion.
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_ds18b20_ultima
    //% block="DS18B20 last temperature in %unit"
    //% group="Measurement"
    //% weight=85
    //% unit.defl=FbTemperatureUnit.Celsius
    export function lastTemperature(unit: FbTemperatureUnit): number {
        if (!_hasReading) return 0
        return _convert(_lastRaw, unit)
    }

    /**
     * Probe resolution: more bits = finer but slower.
     * 9 bits: 0.5 °C in 94 ms · 10 bits: 0.25 °C in 188 ms ·
     * 11 bits: 0.125 °C in 375 ms · 12 bits: 0.0625 °C in 750 ms (default).
     * To send to fisicabit.com more than once per second use 9 or 10 bits.
     * @param resolution Resolution in bits
     */
    //% blockId=fisicabit_ds18b20_resolucion
    //% block="set DS18B20 resolution %resolution"
    //% group="Measurement"
    //% weight=80
    //% resolution.defl=FbDS18B20Resolution.Bits12
    export function setResolution(resolution: FbDS18B20Resolution): void {
        _bits = resolution
    }

    // =========================================================================
    // DIAGNOSTICS
    // =========================================================================

    /**
     * True if the last reading was valid (probe present and CRC correct).
     */
    //% blockId=fisicabit_ds18b20_valida
    //% block="DS18B20 reading valid?"
    //% group="Diagnostics"
    //% weight=70
    export function readingValid(): boolean {
        return _ok
    }

    /**
     * True if a DS18B20 probe is responding on the pin (does not measure,
     * only checks the connection; takes about 2 ms).
     * @param pin Digital pin where DATA is connected
     */
    //% blockId=fisicabit_ds18b20_conectado
    //% block="DS18B20 connected on %pin?"
    //% group="Diagnostics"
    //% weight=65
    //% pin.defl=DigitalPin.P0
    export function isConnected(pin: DigitalPin): boolean {
        return _hwPresent(pin) == 1
    }

    /**
     * Code of the last error: 0 = no error, 1 = probe not connected
     * (check wiring and the 4.7 kΩ resistor), 2 = conversion does not
     * start, 3 = corrupt data (CRC), 4 = timeout.
     */
    //% blockId=fisicabit_ds18b20_error
    //% block="DS18B20 last error code"
    //% group="Diagnostics"
    //% weight=60
    export function errorCode(): number {
        return _hwError()
    }
}
