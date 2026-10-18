// =============================================================================
//  bme280.ts — GY-BME280 pressure/temperature/humidity sensor
// =============================================================================
//  Project: FisicaBit.com
//  Chip: Bosch BME280 (temperature + humidity + barometric pressure)
//  Communication: I2C (address 0x76 with SDO→GND, or 0x77 with SDO→VCC)
//  Power: 1.8V – 3.6V, typically 3.3V
//
//  WIRING:
//    ┌──────────────────────────────────┐
//    │  GY-BME280                       │
//    │  ┌──────────────────────┐        │
//    │  │  VCC  │──── 3V       │        │
//    │  │  GND  │──── GND      │        │
//    │  │  SDA  │──── P20 (SDA)│        │  I2C bus
//    │  │  SCL  │──── P19 (SCL)│        │
//    │  │  SDO  │──── GND      │        │  → address 0x76
//    │  └──────────────────────┘        │
//    └──────────────────────────────────┘
//
//  ACCURACY (per Bosch datasheet):
//    Temperature: ±1.0 °C (range -40 to +85 °C)
//    Humidity:    ±3 %RH  (range 0 to 100 %RH)
//    Pressure:    ±1.0 hPa (range 300 to 1100 hPa)
//
//  COMPENSATION:
//    The BME280 delivers 20-bit raw ADC values that must be compensated
//    with factory-programmed calibration coefficients (registers 0x88-0xA1
//    and 0xE1-0xE7). The compensation formulas come from the Bosch datasheet
//    (chapter 4.2.3, 32-bit fixed-point implementation).
// =============================================================================

// BME280 sensor as a standalone category
/** Bosch BME280 barometric pressure, temperature and humidity sensor over I2C. */
//% weight=90
//% color=#2E8B57
//% icon=""
//% block="BME280"
//% groups='["Configuration", "Measurement", "Diagnostics"]'
namespace fisicabitBME280 {

    // ── I2C address ──
    let _bmeAddr = 0x76
    let _bmeReady = false

    // ── Temperature calibration coefficients ──
    let _bmeDigT1 = 0
    let _bmeDigT2 = 0
    let _bmeDigT3 = 0

    // ── Pressure calibration coefficients ──
    let _bmeDigP1 = 0
    let _bmeDigP2 = 0
    let _bmeDigP3 = 0
    let _bmeDigP4 = 0
    let _bmeDigP5 = 0
    let _bmeDigP6 = 0
    let _bmeDigP7 = 0
    let _bmeDigP8 = 0
    let _bmeDigP9 = 0

    // ── Humidity calibration coefficients ──
    let _bmeDigH1 = 0
    let _bmeDigH2 = 0
    let _bmeDigH3 = 0
    let _bmeDigH4 = 0
    let _bmeDigH5 = 0
    let _bmeDigH6 = 0

    // ── t_fine variable (shared between temperature and pressure) ──
    let _bmeTFine = 0

    // ── Last values ──
    let _bmeLastTemp = 0
    let _bmeLastHum = 0
    let _bmeLastPres = 0

    // =========================================================================
    // I2C helpers (8-bit register address)
    // =========================================================================

    function _bmeW8(reg: number, val: number): void {
        let b = pins.createBuffer(2)
        b[0] = reg
        b[1] = val
        pins.i2cWriteBuffer(_bmeAddr, b)
    }

    function _bmeR8(reg: number): number {
        pins.i2cWriteNumber(_bmeAddr, reg, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(_bmeAddr, NumberFormat.UInt8BE)
    }

    function _bmeReadBlock(reg: number, len: number): Buffer {
        pins.i2cWriteNumber(_bmeAddr, reg, NumberFormat.UInt8BE)
        return pins.i2cReadBuffer(_bmeAddr, len)
    }

    // ── Read unsigned 16-bit little-endian ──
    function _bmeRU16LE(reg: number): number {
        let b = _bmeReadBlock(reg, 2)
        return (b[1] << 8) | b[0]
    }

    // ── Read signed 16-bit little-endian ──
    function _bmeRS16LE(reg: number): number {
        let v = _bmeRU16LE(reg)
        if (v > 32767) v -= 65536
        return v
    }

    // =========================================================================
    // Calibration coefficient reading
    // =========================================================================

    function _bmeReadCalib(): void {
        // Temperature (0x88-0x8D)
        _bmeDigT1 = _bmeRU16LE(0x88)
        _bmeDigT2 = _bmeRS16LE(0x8A)
        _bmeDigT3 = _bmeRS16LE(0x8C)

        // Pressure (0x8E-0x9F)
        _bmeDigP1 = _bmeRU16LE(0x8E)
        _bmeDigP2 = _bmeRS16LE(0x90)
        _bmeDigP3 = _bmeRS16LE(0x92)
        _bmeDigP4 = _bmeRS16LE(0x94)
        _bmeDigP5 = _bmeRS16LE(0x96)
        _bmeDigP6 = _bmeRS16LE(0x98)
        _bmeDigP7 = _bmeRS16LE(0x9A)
        _bmeDigP8 = _bmeRS16LE(0x9C)
        _bmeDigP9 = _bmeRS16LE(0x9E)

        // Humidity (0xA1, 0xE1-0xE7)
        _bmeDigH1 = _bmeR8(0xA1)
        _bmeDigH2 = _bmeRS16LE(0xE1)
        _bmeDigH3 = _bmeR8(0xE3)
        let e4 = _bmeR8(0xE4)
        let e5 = _bmeR8(0xE5)
        let e6 = _bmeR8(0xE6)
        _bmeDigH4 = (e4 << 4) | (e5 & 0x0F)
        if (_bmeDigH4 > 2047) _bmeDigH4 -= 4096
        _bmeDigH5 = (e6 << 4) | ((e5 >> 4) & 0x0F)
        if (_bmeDigH5 > 2047) _bmeDigH5 -= 4096
        _bmeDigH6 = _bmeR8(0xE7)
        if (_bmeDigH6 > 127) _bmeDigH6 -= 256
    }

    // =========================================================================
    // Compensation (Bosch datasheet algorithm, 32-bit fixed point)
    // =========================================================================

    function _bmeCompTemp(adcT: number): number {
        // BME280 datasheet formula - chapter 4.2.3
        let var1 = (((adcT >> 3) - (_bmeDigT1 << 1)) * _bmeDigT2) >> 11
        let var2 = (((((adcT >> 4) - _bmeDigT1) * ((adcT >> 4) - _bmeDigT1)) >> 12) * _bmeDigT3) >> 14
        _bmeTFine = var1 + var2
        return (_bmeTFine * 5 + 128) >> 8  // result in hundredths of °C
    }

    function _bmeCompPres(adcP: number): number {
        let var1 = _bmeTFine - 128000
        let var2 = var1 * var1 * _bmeDigP6
        var2 = var2 + ((var1 * _bmeDigP5) << 17)
        var2 = var2 + ((_bmeDigP4) << 35)
        var1 = ((var1 * var1 * _bmeDigP3) >> 8) + ((var1 * _bmeDigP2) << 12)
        var1 = ((1 << 47) + var1) * _bmeDigP1 >> 33
        if (var1 == 0) return 0
        let p = 1048576 - adcP
        p = Math.idiv((p << 31) - var2, var1) * 2
        var1 = (_bmeDigP9 * Math.idiv(Math.idiv(p, 8) * Math.idiv(p, 8), 8192)) >> 25
        var2 = (_bmeDigP8 * p) >> 19
        p = Math.idiv(p + var1 + var2, 256) + ((_bmeDigP7) << 4)
        return p  // result in Pa × 256
    }

    function _bmeCompHum(adcH: number): number {
        let h = _bmeTFine - 76800
        if (h == 0) return 0
        let x1 = adcH - ((_bmeDigH4 << 20) + (_bmeDigH5 * h))
        x1 = x1 + 16384
        x1 = Math.idiv(x1, 32768)
        let x2 = Math.idiv(h * _bmeDigH6, 1024)
        x2 = Math.idiv(x2 * (Math.idiv(h * _bmeDigH3, 2048) + 32768), 1024) + 2097152
        x2 = Math.idiv(x2 * _bmeDigH2 + 8192, 16384)
        h = x1 * x2
        h = h - Math.idiv(Math.idiv(Math.idiv(h, 32768) * Math.idiv(h, 32768), 128) * _bmeDigH1, 16)
        if (h < 0) h = 0
        if (h > 419430400) h = 419430400
        return h >> 12  // result in %RH × 1024
    }

    // =========================================================================
    // Forced reading (forced mode)
    // =========================================================================

    function _bmeForceReading(): void {
        // Config: standby=0.5ms, filter coeff=16, SPI off
        _bmeW8(0xF5, (0x00 << 5) | (0x04 << 2) | 0x00)
        // ctrl_hum: humidity oversampling ×1
        _bmeW8(0xF2, 0x01)
        // ctrl_meas: temperature oversampling ×2, pressure ×16, forced mode
        _bmeW8(0xF4, (0x02 << 5) | (0x05 << 2) | 0x01)

        // Wait for the measurement to finish (status bit 3)
        for (let i = 0; i < 50; i++) {
            if ((_bmeR8(0xF3) & 0x08) == 0) break
            basic.pause(2)
        }

        // Read 8 data bytes: pressure[3] + temperature[3] + humidity[2]
        let raw = _bmeReadBlock(0xF7, 8)
        let adcP = ((raw[0] << 16) | (raw[1] << 8) | raw[2]) >> 4
        let adcT = ((raw[3] << 16) | (raw[4] << 8) | raw[5]) >> 4
        let adcH = (raw[6] << 8) | raw[7]

        // Compensate (temperature first, it produces t_fine for pressure and humidity)
        let tComp = _bmeCompTemp(adcT)
        _bmeLastTemp = tComp  // hundredths of °C

        let pComp = _bmeCompPres(adcP)
        _bmeLastPres = pComp  // Pa × 256

        let hComp = _bmeCompHum(adcH)
        _bmeLastHum = hComp  // %RH × 1024
    }


    // =========================================================================
    // PUBLIC BLOCKS — BME280 sensor
    // =========================================================================

    /**
     * Initializes the GY-BME280 sensor over I2C.
     * Reads the factory-programmed calibration coefficients.
     * Shows ✓ if the sensor responds correctly, ✗ otherwise.
     *
     * Physical wiring GY-BME280 → micro:bit:
     *   VCC → 3V
     *   GND → GND
     *   SCL → P19 (SCL)
     *   SDA → P20 (SDA)
     *   CSB → 3V (selects I2C mode)
     *   SDO → GND (address 0x76) or VCC (address 0x77)
     *
     * @param address I2C address (0x76 if SDO→GND, 0x77 if SDO→VCC)
     */
    //% blockId=fisicabit_bme280_inicializar
    //% block="initialize BME280 (VCC GND SCL→P19 SDA→P20 CSB SDO) at %address"
    //% group="Configuration"
    //% weight=100
    //% address.defl=FbBME280Address.Addr76
    export function bme280Init(address: FbBME280Address): void {
        _bmeAddr = address

        // Verify chip ID (0x60 = BME280)
        let id = _bmeR8(0xD0)
        if (id != 0x60) {
            _bmeReady = false
            basic.showIcon(IconNames.No)
            basic.pause(500)
            basic.clearScreen()
            return
        }

        // Soft reset
        _bmeW8(0xE0, 0xB6)
        basic.pause(50)

        // Read calibration coefficients
        _bmeReadCalib()
        _bmeReady = true

        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Reads the BME280 temperature in the selected unit.
     * Resolution: 0.01 °C. Accuracy: ±1.0 °C.
     * @param unit Temperature unit
     */
    //% blockId=fisicabit_bme280_temperatura
    //% block="BME280 temperature in %unit"
    //% group="Measurement"
    //% weight=95
    //% unit.defl=FbTemperatureUnit.Celsius
    export function bme280Temperature(unit: FbTemperatureUnit): number {
        if (!_bmeReady) return 0
        _bmeForceReading()
        let tempC = _bmeLastTemp / 100.0
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
     * Reads the BME280 barometric pressure.
     * Resolution: 0.18 Pa. Range: 300 – 1100 hPa.
     * @param unit Pressure unit
     */
    //% blockId=fisicabit_bme280_presion
    //% block="BME280 pressure in %unit"
    //% group="Measurement"
    //% weight=94
    //% unit.defl=FbPressureUnit.hPa
    export function bme280Pressure(unit: FbPressureUnit): number {
        if (!_bmeReady) return 0
        _bmeForceReading()
        // _bmeLastPres is in Pa × 256
        let pa = _bmeLastPres / 256.0
        switch (unit) {
            case FbPressureUnit.Pa:
                return Math.round(pa)
            case FbPressureUnit.hPa:
                return Math.round(pa / 100 * 10) / 10
            case FbPressureUnit.mmHg:
                return Math.round(pa * 0.00750062 * 10) / 10
            case FbPressureUnit.Atm:
                return Math.round(pa / 101325 * 10000) / 10000
            default:
                return Math.round(pa / 100 * 10) / 10
        }
    }

    /**
     * Reads the BME280 relative humidity in %.
     * Resolution: 0.008 %RH. Accuracy: ±3 %RH.
     */
    //% blockId=fisicabit_bme280_humedad
    //% block="BME280 humidity (percent RH)"
    //% group="Measurement"
    //% weight=93
    export function bme280Humidity(): number {
        if (!_bmeReady) return 0
        _bmeForceReading()
        // _bmeLastHum is in %RH × 1024
        return Math.round(_bmeLastHum / 1024 * 10) / 10
    }

    /**
     * Computes the approximate altitude from the barometric pressure.
     * Barometric formula: altitude = 44330 × (1 - (P/P₀)^0.1903)
     * where P₀ = sea-level pressure (1013.25 hPa by default).
     * @param seaLevelPressure Reference sea-level pressure in hPa
     */
    //% blockId=fisicabit_bme280_altitud
    //% block="BME280 altitude (m) sea level %seaLevelPressure hPa"
    //% group="Measurement"
    //% weight=92
    //% seaLevelPressure.defl=1013.25
    export function bme280Altitude(seaLevelPressure: number): number {
        if (!_bmeReady) return 0
        _bmeForceReading()
        let pHpa = _bmeLastPres / 256.0 / 100.0
        if (seaLevelPressure <= 0) seaLevelPressure = 1013.25
        // International barometric formula
        let alt = 44330.0 * (1.0 - Math.pow(pHpa / seaLevelPressure, 0.1903))
        return Math.round(alt * 10) / 10
    }

    /**
     * Tells whether the BME280 sensor was detected and initialized correctly.
     */
    //% blockId=fisicabit_bme280_conectado
    //% block="BME280 sensor connected"
    //% group="Diagnostics"
    //% weight=85
    export function bme280Connected(): boolean {
        return _bmeReady
    }
}
