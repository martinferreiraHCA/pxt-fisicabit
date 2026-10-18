// =============================================================================
//  max6675.ts — Type K thermocouple with MAX6675 module (Maxim)
// =============================================================================
//  Project: FisicaBit.com
//  Sensor: Type K thermocouple (chromel/alumel) + MAX6675 converter
//  Protocol: read-only SPI (3 wires: SCK, CS, SO), bit-banged in TS
//  Power: 3.0 V – 5.5 V → connect to the micro:bit 3V (the SO output sits
//         at VCC level, so at 3 V it is safe for the board)
//
//  WIRING (generic MAX6675 module, 5 pins):
//    ┌─────────────────────────────────────────────┐
//    │  MAX6675 module               micro:bit     │
//    │  ┌────────┐                                 │
//    │  │  VCC   │──────────────── 3V              │
//    │  │  GND   │──────────────── GND             │
//    │  │  SCK   │──────────────── P13  (clock)    │
//    │  │  CS    │──────────────── P16  (select)   │
//    │  │  SO    │──────────────── P14  (data)     │
//    │  └────────┘                                 │
//    │  Thermocouple: red wire → "−", yellow → "+" │
//    │  (on the module connector; if the reading   │
//    │   drops when heating, they are swapped)     │
//    └─────────────────────────────────────────────┘
//
//    P13/P14 are the micro:bit hardware SPI pins and P13–P16 are free on
//    the expansion kits (they do not touch the display or the buttons).
//    Any digital pin works: the block names all three.
//    Several modules: they share SCK and SO, each with its own CS.
//
//  MAX6675 PROTOCOL (16 bits, MSB first, data valid with SCK low):
//    D15     = 0 (dummy)
//    D14–D3  = temperature, 12 unsigned bits, 0.25 °C step (0 to 1023.75 °C)
//    D2      = 1 if the thermocouple is open (broken or disconnected)
//    D1      = 0 (chip identifier)
//    D0      = high impedance (reads anything)
//    With CS high the chip converts on its own (170–220 ms); pulling CS low
//    stops the conversion and presents the last result. Reading more often
//    than every 220 ms returns the same value, so the block does not touch
//    the bus if that time has not elapsed yet (it never blocks).
//
//  ACCURACY: ±2 °C typical between 0 and 700 °C (internal cold-junction
//  compensation, −20 to 85 °C at the chip); resolution 0.25 °C. If accuracy
//  is needed, calibrate in ice water (0 °C) with `set correction`.
//
//  USE IN PHYSICS: heating/cooling curve, boiling point, burner flame,
//  tin melting, thermal equilibrium with two probes.
// =============================================================================

/** Type K thermocouple with MAX6675 module for high-temperature experiments. */
//% weight=86
//% color=#BF360C
//% icon=""
//% block="MAX6675"
//% groups='["Measurement", "Calibration", "Diagnostics"]'
namespace fisicabitMAX6675 {

    const MIN_INTERVAL_MS = 220     // maximum conversion time of the chip
    const ERR_NONE = 0
    const ERR_NO_MODULE = 1
    const ERR_OPEN_THERMOCOUPLE = 2

    // State of the last module queried (blocks without pins use it)
    let _lastRaw = 0                // last 16-bit word read
    let _lastQuarters = 0           // last valid temperature in 1/4 °C
    let _hasReading = false
    let _ok = false
    let _error = ERR_NONE
    let _correction = 0             // correction in °C added to every reading

    // Per-module state, indexed by the CS pin (allows several MAX6675
    // sharing SCK and SO, each with its own CS and its own 220 ms clock).
    let _modCs: number[] = []
    let _modMs: number[] = []
    let _modRaw: number[] = []
    let _modQuarters: number[] = []
    let _modHas: boolean[] = []
    let _modOk: boolean[] = []
    let _modError: number[] = []

    function _index(cs: DigitalPin): number {
        for (let i = 0; i < _modCs.length; i++) if (_modCs[i] == cs) return i
        _modCs.push(cs)
        _modMs.push(-MIN_INTERVAL_MS)
        _modRaw.push(0)
        _modQuarters.push(0)
        _modHas.push(false)
        _modOk.push(false)
        _modError.push(ERR_NONE)
        return _modCs.length - 1
    }

    // =========================================================================
    // Bus access (bit-bang SPI mode 0, read only)
    // =========================================================================

    /**
     * Reads the 16 bits of the MAX6675. SCK stays low between readings; the
     * data is sampled with SCK low (after the falling edge), like the
     * Adafruit reference library. Takes ~1 ms in TypeScript.
     */
    function _readWord(sck: DigitalPin, cs: DigitalPin, so: DigitalPin): number {
        pins.digitalWritePin(sck, 0)
        pins.digitalWritePin(cs, 1)
        pins.setPull(so, PinPullMode.PullNone)
        control.waitMicros(5)
        pins.digitalWritePin(cs, 0)     // stops the conversion and presents D15
        control.waitMicros(5)
        let word = 0
        for (let i = 0; i < 16; i++) {
            pins.digitalWritePin(sck, 0)
            control.waitMicros(2)
            word = (word << 1) | (pins.digitalReadPin(so) & 1)
            pins.digitalWritePin(sck, 1)
            control.waitMicros(2)
        }
        pins.digitalWritePin(sck, 0)
        pins.digitalWritePin(cs, 1)     // starts a new conversion
        return word & 0xFFFF
    }

    function _update(sck: DigitalPin, cs: DigitalPin, so: DigitalPin, force: boolean): void {
        const k = _index(cs)
        const now = control.millis()
        if (force || now - _modMs[k] >= MIN_INTERVAL_MS) {
            const raw = _readWord(sck, cs, so)
            _modMs[k] = now
            _modRaw[k] = raw
            // Without a module (SO floating or unpowered) the bus returns all 1s
            // or all 0s; also bit D1 (identifier) must always be 0.
            if (raw == 0xFFFF || raw == 0x0000 || (raw & 0x0002) != 0) {
                _modOk[k] = false
                _modError[k] = ERR_NO_MODULE
            } else if ((raw & 0x0004) != 0) {
                _modOk[k] = false
                _modError[k] = ERR_OPEN_THERMOCOUPLE
            } else {
                _modQuarters[k] = (raw >> 3) & 0x0FFF
                _modOk[k] = true
                _modError[k] = ERR_NONE
                _modHas[k] = true
            }
        }
        // If 220 ms have not elapsed yet the previous result of the module is
        // kept: pulling CS low too early would cut the conversion in progress.
        _lastRaw = _modRaw[k]
        _lastQuarters = _modQuarters[k]
        _hasReading = _modHas[k]
        _ok = _modOk[k]
        _error = _modError[k]
    }

    function _convert(quarters: number, unit: FbTemperatureUnit): number {
        const c = quarters * 0.25 + _correction
        let v = c
        if (unit == FbTemperatureUnit.Fahrenheit) v = c * 9 / 5 + 32
        else if (unit == FbTemperatureUnit.Kelvin) v = c + 273.15
        return Math.round(v * 100) / 100
    }

    // =========================================================================
    // MEASUREMENT
    // =========================================================================

    /**
     * Temperature of the type K thermocouple connected to the MAX6675 module.
     * Range 0 to 1023 °C, resolution 0.25 °C, accuracy ±2 °C. The chip
     * delivers a new value every 220 ms: if read more often it returns the
     * same value without blocking. If it fails, it returns the last valid
     * temperature (0 if there never was one).
     *
     * Wiring: VCC → 3V, GND → GND, SCK → P13, CS → P16, SO → P14.
     *
     * Example (cooling curve): [forever] → [send to fisicabit.com time and
     * (MAX6675 temperature SCK P13 CS P16 SO P14 in °C) every 500 ms]
     * @param sck Clock pin (SCK / CLK)
     * @param cs Chip-select pin (CS)
     * @param so Data pin (SO / DO / MISO)
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_max6675_temperatura
    //% block="MAX6675 temperature SCK %sck CS %cs SO %so in %unit"
    //% group="Measurement"
    //% weight=90
    //% sck.defl=DigitalPin.P13
    //% cs.defl=DigitalPin.P16
    //% so.defl=DigitalPin.P14
    //% unit.defl=FbTemperatureUnit.Celsius
    //% inlineInputMode=inline
    export function temperature(sck: DigitalPin, cs: DigitalPin, so: DigitalPin, unit: FbTemperatureUnit): number {
        _update(sck, cs, so, false)
        if (!_hasReading) return 0
        return _convert(_lastQuarters, unit)
    }

    /**
     * Last valid temperature read, without querying the module again.
     * Useful to send the same value in several units or to show it on the
     * display without waiting for another conversion.
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_max6675_ultima
    //% block="MAX6675 last temperature in %unit"
    //% group="Measurement"
    //% weight=85
    //% unit.defl=FbTemperatureUnit.Celsius
    export function lastTemperature(unit: FbTemperatureUnit): number {
        if (!_hasReading) return 0
        return _convert(_lastQuarters, unit)
    }

    // =========================================================================
    // CALIBRATION
    // =========================================================================

    /**
     * Correction in °C added to all readings (default 0).
     * To calibrate: put the thermocouple in crushed ice water (0 °C), wait
     * 1 minute and set the correction = −(temperature read).
     * Example: if it reads 1.5 °C, set correction −1.5.
     * @param degrees Correction in °C (positive or negative), eg: 0
     */
    //% blockId=fisicabit_max6675_correccion
    //% block="set MAX6675 correction %degrees °C"
    //% group="Calibration"
    //% weight=80
    //% degrees.defl=0
    export function setCorrection(degrees: number): void {
        _correction = degrees
    }

    /**
     * Correction in °C currently applied to the readings.
     */
    //% blockId=fisicabit_max6675_correccion_actual
    //% block="MAX6675 correction (°C)"
    //% group="Calibration"
    //% weight=75
    export function correction(): number {
        return _correction
    }

    // =========================================================================
    // DIAGNOSTICS
    // =========================================================================

    /**
     * True if the last reading was valid (module present and thermocouple
     * connected).
     */
    //% blockId=fisicabit_max6675_valida
    //% block="MAX6675 reading valid?"
    //% group="Diagnostics"
    //% weight=70
    export function readingValid(): boolean {
        return _ok
    }

    /**
     * True if a MAX6675 module is responding on those pins and the
     * thermocouple is connected. Queries the bus (takes ~1 ms).
     * @param sck Clock pin (SCK / CLK)
     * @param cs Chip-select pin (CS)
     * @param so Data pin (SO / DO / MISO)
     */
    //% blockId=fisicabit_max6675_conectado
    //% block="MAX6675 connected SCK %sck CS %cs SO %so?"
    //% group="Diagnostics"
    //% weight=65
    //% sck.defl=DigitalPin.P13
    //% cs.defl=DigitalPin.P16
    //% so.defl=DigitalPin.P14
    //% inlineInputMode=inline
    export function isConnected(sck: DigitalPin, cs: DigitalPin, so: DigitalPin): boolean {
        _update(sck, cs, so, true)
        return _ok
    }

    /**
     * Code of the last error: 0 = no error, 1 = module not responding
     * (check VCC, GND and the SCK/CS/SO pins), 2 = open thermocouple
     * (wire broken or disconnected from the module).
     */
    //% blockId=fisicabit_max6675_error
    //% block="MAX6675 last error code"
    //% group="Diagnostics"
    //% weight=60
    export function errorCode(): number {
        return _error
    }

    /**
     * 16-bit word as delivered by the chip in the last reading
     * (to debug the wiring: 65535 or 0 = module not responding).
     */
    //% blockId=fisicabit_max6675_crudo
    //% block="MAX6675 raw value"
    //% group="Diagnostics"
    //% weight=55
    export function rawValue(): number {
        return _lastRaw
    }
}
