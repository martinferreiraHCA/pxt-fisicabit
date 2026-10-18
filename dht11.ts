// =============================================================================
//  dht11.ts — DHT11 temperature and humidity sensor
// =============================================================================
//  Project: FisicaBit.com
//  Sensor: DHT11 (also compatible with DHT22/AM2302 with adjustments)
//  Protocol: bidirectional single-wire (proprietary)
//  Power: 3.3V – 5V
//
//  WIRING:
//    ┌──────────────────────────────────┐
//    │  DHT11 (3 or 4 pins)             │
//    │  ┌──────────────────────┐        │
//    │  │  VCC  │──── 3V       │        │
//    │  │  DATA │──── P0       │        │  (any digital pin)
//    │  │  GND  │──── GND      │        │
//    │  └──────────────────────┘        │
//    └──────────────────────────────────┘
//
//    ⚠ A 4.7kΩ – 10kΩ pull-up resistor between DATA and VCC is
//      recommended. Some modules include it on the PCB.
//
//  PROTOCOL:
//    1. MCU sends the start signal: LOW ≥18ms, then HIGH ~30μs
//    2. DHT11 responds: LOW ~80μs, HIGH ~80μs
//    3. DHT11 sends 40 bits (5 bytes):
//       - Byte 1: humidity integer part
//       - Byte 2: humidity decimal part (always 0 on DHT11)
//       - Byte 3: temperature integer part
//       - Byte 4: temperature decimal part (always 0 on DHT11)
//       - Byte 5: checksum (sum of bytes 1-4)
//    4. Each bit: LOW ~50μs, then HIGH 26-28μs=0, HIGH 70μs=1
//
//  ACCURACY:
//    DHT11: humidity ±5%RH, temperature ±2°C
//           Range: 20-90%RH, 0-50°C
//           Sampling: max 1 reading/second
//
//  NOTE: The protocol requires precise timing (<50μs).
//        The full decoding is done in TS by measuring the HIGH pulses of
//        each bit with pulseIn; the C++ shim measurePulseNative is
//        available for the critical measurements.
// =============================================================================

// DHT11 sensor as a standalone category
/** DHT11 humidity and temperature sensor for weather and thermal experiments. */
//% weight=88
//% color=#FF6347
//% icon=""
//% block="DHT11"
//% groups='["Measurement", "Batch Reading", "Diagnostics"]'
namespace fisicabitDHT11 {

    // ── DHT11 state ──
    let _dhtLastHumidity = 0     // last valid humidity (%RH × 10)
    let _dhtLastTemperature = 0  // last valid temperature (°C × 10)
    let _dhtLastReadMs = 0       // timestamp of the last reading (ms)
    let _dhtOk = false           // was the last reading valid?

    // =========================================================================
    // DHT11 protocol reading
    // =========================================================================

    /**
     * Reads the 40 bits of the DHT11 using MakeCode pulseIn.
     * Returns true if the reading is valid (checksum correct).
     */
    function _dhtRead(pin: DigitalPin): boolean {
        // ── Start signal ──
        // MCU: LOW for ≥18ms → HIGH → release pin (input)
        pins.digitalWritePin(pin, 0)
        basic.pause(20)
        pins.digitalWritePin(pin, 1)
        control.waitMicros(30)
        pins.setPull(pin, PinPullMode.PullUp)

        // ── DHT11 response ──
        // DHT11 pulls LOW ~80μs, then HIGH ~80μs
        // Wait for the response to pass
        let respLow = pins.pulseIn(pin, PulseValue.Low, 500)
        if (respLow == 0) return false
        let respHigh = pins.pulseIn(pin, PulseValue.High, 500)
        if (respHigh == 0) return false

        // ── Read 40 bits ──
        // Each bit: LOW ~50μs (sync), then HIGH
        //   HIGH ~26-28μs → bit 0
        //   HIGH ~70μs    → bit 1
        // Threshold: if HIGH > 40μs → bit 1
        let data: number[] = [0, 0, 0, 0, 0]

        for (let i = 0; i < 40; i++) {
            // Wait for the LOW sync pulse
            let syncLow = pins.pulseIn(pin, PulseValue.Low, 200)
            if (syncLow == 0) return false

            // Measure the HIGH pulse (determines the bit)
            let pulseHigh = pins.pulseIn(pin, PulseValue.High, 200)
            if (pulseHigh == 0) return false

            // Decode bit
            let byteIdx = i >> 3  // i / 8
            data[byteIdx] = data[byteIdx] << 1
            if (pulseHigh > 40) {
                data[byteIdx] = data[byteIdx] | 1
            }
        }

        // ── Verify checksum ──
        let checksum = (data[0] + data[1] + data[2] + data[3]) & 0xFF
        if (checksum != data[4]) return false

        // ── Store values ──
        // DHT11: data[0] = humidity integer, data[1] = 0
        //        data[2] = temperature integer, data[3] = 0
        _dhtLastHumidity = data[0] * 10 + data[1]     // %RH × 10
        _dhtLastTemperature = data[2] * 10 + data[3]  // °C × 10

        return true
    }

    /**
     * Tries to read the DHT11, with retries if it fails.
     * Respects the minimum 1-second interval between readings.
     */
    function _dhtReadWithRetry(pin: DigitalPin): void {
        // The DHT11 needs at least 1 s between readings
        let now = input.runningTime()
        if (now - _dhtLastReadMs < 1100) {
            return  // use the last cached values
        }

        // Try up to 3 times
        for (let attempt = 0; attempt < 3; attempt++) {
            if (_dhtRead(pin)) {
                _dhtOk = true
                _dhtLastReadMs = input.runningTime()
                return
            }
            basic.pause(100)
        }
        _dhtOk = false
    }

    // =========================================================================
    // PUBLIC BLOCKS — DHT11 sensor
    // =========================================================================

    /**
     * Reads the relative humidity of the DHT11 sensor (%).
     * Range: 20 – 90 %RH. Accuracy: ±5 %RH.
     * Sampling: at most 1 reading per second.
     *
     * Physical wiring DHT11 → micro:bit:
     *   VCC (or +)  → 3V
     *   GND (or -)  → GND
     *   DATA (or S) → P16
     *
     * @param pin Digital pin where DATA is connected
     */
    //% blockId=fisicabit_dht11_humedad
    //% block="DHT11 humidity (percent) on %pin"
    //% group="Measurement"
    //% weight=90
    //% pin.defl=DigitalPin.P16
    export function dht11Humidity(pin: DigitalPin): number {
        _dhtReadWithRetry(pin)
        return _dhtLastHumidity / 10
    }

    /**
     * Reads the temperature of the DHT11 sensor.
     * Range: 0 – 50 °C. Accuracy: ±2 °C.
     * @param pin Digital pin where DATA is connected
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_dht11_temperatura
    //% block="DHT11 temperature on %pin in %unit"
    //% group="Measurement"
    //% weight=89
    //% pin.defl=DigitalPin.P16
    //% unit.defl=FbTemperatureUnit.Celsius
    export function dht11Temperature(pin: DigitalPin, unit: FbTemperatureUnit): number {
        _dhtReadWithRetry(pin)
        let tempC = _dhtLastTemperature / 10.0
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

    /**
     * Reads humidity and temperature from the DHT11 in one go.
     * More efficient than calling humidity and temperature separately,
     * since a single bus reading returns both values.
     * Use the "DHT11 last humidity" and "DHT11 last temperature" blocks
     * to get the values after this reading.
     * @param pin Digital pin where DATA is connected
     */
    //% blockId=fisicabit_dht11_leer
    //% block="DHT11 read all on %pin"
    //% group="Batch Reading"
    //% weight=88
    //% pin.defl=DigitalPin.P16
    export function dht11Read(pin: DigitalPin): void {
        _dhtReadWithRetry(pin)
    }

    /**
     * Gets the last humidity read (after dht11Read).
     */
    //% blockId=fisicabit_dht11_ult_humedad
    //% block="DHT11 last humidity (percent)"
    //% group="Batch Reading"
    //% weight=87
    export function dht11LastHumidity(): number {
        return _dhtLastHumidity / 10
    }

    /**
     * Gets the last temperature read (after dht11Read).
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_dht11_ult_temp
    //% block="DHT11 last temperature in %unit"
    //% group="Batch Reading"
    //% weight=86
    //% unit.defl=FbTemperatureUnit.Celsius
    export function dht11LastTemperature(unit: FbTemperatureUnit): number {
        let tempC = _dhtLastTemperature / 10.0
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

    /**
     * Tells whether the last DHT11 reading was valid.
     * It can fail if: loose wire, sensor not connected,
     * electrical interference, or reading too fast (<1s).
     */
    //% blockId=fisicabit_dht11_valido
    //% block="DHT11 reading valid"
    //% group="Diagnostics"
    //% weight=80
    export function dht11Valid(): boolean {
        return _dhtOk
    }
}
