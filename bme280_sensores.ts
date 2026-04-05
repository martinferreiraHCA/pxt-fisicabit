// =============================================================================
//  bme280_sensores.ts — Sensor de presión/temperatura/humedad GY-BME280
// =============================================================================
//  Proyecto: FisicaBit.com
//  Chip: Bosch BME280 (temperatura + humedad + presión barométrica)
//  Comunicación: I2C (dirección 0x76 con SDO→GND, o 0x77 con SDO→VCC)
//  Alimentación: 1.8V – 3.6V, típicamente 3.3V
//
//  CABLEADO:
//    ┌──────────────────────────────────┐
//    │  GY-BME280                       │
//    │  ┌──────────────────────┐        │
//    │  │  VCC  │──── 3V       │        │
//    │  │  GND  │──── GND      │        │
//    │  │  SDA  │──── P20 (SDA)│        │  Bus I2C
//    │  │  SCL  │──── P19 (SCL)│        │
//    │  │  SDO  │──── GND      │        │  → dirección 0x76
//    │  └──────────────────────┘        │
//    └──────────────────────────────────┘
//
//  PRECISIÓN (según datasheet Bosch):
//    Temperatura: ±1.0 °C (rango -40 a +85 °C)
//    Humedad:     ±3 %RH  (rango 0 a 100 %RH)
//    Presión:     ±1.0 hPa (rango 300 a 1100 hPa)
//
//  COMPENSACIÓN:
//    El BME280 entrega valores crudos ADC de 20 bits que deben compensarse
//    con coeficientes de calibración grabados en fábrica (registros 0x88-0xA1
//    y 0xE1-0xE7). Las fórmulas de compensación son del datasheet de Bosch
//    (capítulo 4.2.3, implementación en punto fijo de 32 bits).
// =============================================================================

// Extiende el namespace FisicaBit con el sensor BME280
namespace FisicaBit {

    // ── Dirección I2C ──
    let _bmeAddr = 0x76
    let _bmeListo = false

    // ── Coeficientes de calibración de temperatura ──
    let _bmeDigT1 = 0
    let _bmeDigT2 = 0
    let _bmeDigT3 = 0

    // ── Coeficientes de calibración de presión ──
    let _bmeDigP1 = 0
    let _bmeDigP2 = 0
    let _bmeDigP3 = 0
    let _bmeDigP4 = 0
    let _bmeDigP5 = 0
    let _bmeDigP6 = 0
    let _bmeDigP7 = 0
    let _bmeDigP8 = 0
    let _bmeDigP9 = 0

    // ── Coeficientes de calibración de humedad ──
    let _bmeDigH1 = 0
    let _bmeDigH2 = 0
    let _bmeDigH3 = 0
    let _bmeDigH4 = 0
    let _bmeDigH5 = 0
    let _bmeDigH6 = 0

    // ── Variable t_fine (compartida entre temperatura y presión) ──
    let _bmeTFine = 0

    // ── Últimos valores ──
    let _bmeUltTemp = 0
    let _bmeUltHum = 0
    let _bmeUltPres = 0

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

    // ── Leer unsigned 16-bit little-endian ──
    function _bmeRU16LE(reg: number): number {
        let b = _bmeReadBlock(reg, 2)
        return (b[1] << 8) | b[0]
    }

    // ── Leer signed 16-bit little-endian ──
    function _bmeRS16LE(reg: number): number {
        let v = _bmeRU16LE(reg)
        if (v > 32767) v -= 65536
        return v
    }

    // =========================================================================
    // Lectura de coeficientes de calibración
    // =========================================================================

    function _bmeReadCalib(): void {
        // Temperatura (0x88-0x8D)
        _bmeDigT1 = _bmeRU16LE(0x88)
        _bmeDigT2 = _bmeRS16LE(0x8A)
        _bmeDigT3 = _bmeRS16LE(0x8C)

        // Presión (0x8E-0x9F)
        _bmeDigP1 = _bmeRU16LE(0x8E)
        _bmeDigP2 = _bmeRS16LE(0x90)
        _bmeDigP3 = _bmeRS16LE(0x92)
        _bmeDigP4 = _bmeRS16LE(0x94)
        _bmeDigP5 = _bmeRS16LE(0x96)
        _bmeDigP6 = _bmeRS16LE(0x98)
        _bmeDigP7 = _bmeRS16LE(0x9A)
        _bmeDigP8 = _bmeRS16LE(0x9C)
        _bmeDigP9 = _bmeRS16LE(0x9E)

        // Humedad (0xA1, 0xE1-0xE7)
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
    // Compensación (algoritmo del datasheet Bosch, punto fijo 32 bits)
    // =========================================================================

    function _bmeCompTemp(adcT: number): number {
        // Fórmula del datasheet BME280 - capítulo 4.2.3
        let var1 = (((adcT >> 3) - (_bmeDigT1 << 1)) * _bmeDigT2) >> 11
        let var2 = (((((adcT >> 4) - _bmeDigT1) * ((adcT >> 4) - _bmeDigT1)) >> 12) * _bmeDigT3) >> 14
        _bmeTFine = var1 + var2
        return (_bmeTFine * 5 + 128) >> 8  // resultado en centésimas de °C
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
        return p  // resultado en Pa × 256
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
        return h >> 12  // resultado en %RH × 1024
    }

    // =========================================================================
    // Lectura forzada (forced mode)
    // =========================================================================

    function _bmeForzarLectura(): void {
        // Config: standby=0.5ms, filter coeff=16, SPI off
        _bmeW8(0xF5, (0x00 << 5) | (0x04 << 2) | 0x00)
        // ctrl_hum: oversampling humedad ×1
        _bmeW8(0xF2, 0x01)
        // ctrl_meas: oversampling temp ×2, presión ×16, forced mode
        _bmeW8(0xF4, (0x02 << 5) | (0x05 << 2) | 0x01)

        // Esperar a que termine la medición (bit 3 del status)
        for (let i = 0; i < 50; i++) {
            if ((_bmeR8(0xF3) & 0x08) == 0) break
            basic.pause(2)
        }

        // Leer 8 bytes de datos: presión[3] + temperatura[3] + humedad[2]
        let raw = _bmeReadBlock(0xF7, 8)
        let adcP = ((raw[0] << 16) | (raw[1] << 8) | raw[2]) >> 4
        let adcT = ((raw[3] << 16) | (raw[4] << 8) | raw[5]) >> 4
        let adcH = (raw[6] << 8) | raw[7]

        // Compensar (temperatura primero, produce t_fine para presión y humedad)
        let tComp = _bmeCompTemp(adcT)
        _bmeUltTemp = tComp  // centésimas de °C

        let pComp = _bmeCompPres(adcP)
        _bmeUltPres = pComp  // Pa × 256

        let hComp = _bmeCompHum(adcH)
        _bmeUltHum = hComp  // %RH × 1024
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — BME280 Sensor
    // =========================================================================

    /**
     * Inicializa el sensor GY-BME280 por I2C.
     * Lee los coeficientes de calibración grabados en fábrica.
     * Muestra ✓ si el sensor responde correctamente, ✗ si no.
     * @param direccion Dirección I2C (0x76 si SDO→GND, 0x77 si SDO→VCC)
     */
    //% blockId=fisicabit_bme280_inicializar
    //% block="initialize BME280 (I2C: SDA P20 SCL P19) at %direccion"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=100
    //% direccion.defl=DireccionBME280.Addr76
    export function bme280Inicializar(direccion: DireccionBME280): void {
        _bmeAddr = direccion

        // Verificar chip ID (0x60 = BME280)
        let id = _bmeR8(0xD0)
        if (id != 0x60) {
            _bmeListo = false
            basic.showIcon(IconNames.No)
            basic.pause(500)
            basic.clearScreen()
            return
        }

        // Soft reset
        _bmeW8(0xE0, 0xB6)
        basic.pause(50)

        // Leer coeficientes de calibración
        _bmeReadCalib()
        _bmeListo = true

        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Lee la temperatura del BME280 en la unidad seleccionada.
     * Resolución: 0.01 °C. Precisión: ±1.0 °C.
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_bme280_temperatura
    //% block="BME280 temperature in %unidad"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=95
    //% unidad.defl=UnidadTemperatura.Celsius
    export function bme280Temperatura(unidad: UnidadTemperatura): number {
        if (!_bmeListo) return 0
        _bmeForzarLectura()
        let tempC = _bmeUltTemp / 100.0
        switch (unidad) {
            case UnidadTemperatura.Celsius:
                return Math.round(tempC * 10) / 10
            case UnidadTemperatura.Fahrenheit:
                return Math.round((tempC * 9 / 5 + 32) * 10) / 10
            case UnidadTemperatura.Kelvin:
                return Math.round((tempC + 273.15) * 10) / 10
            default:
                return Math.round(tempC * 10) / 10
        }
    }

    /**
     * Lee la presión barométrica del BME280.
     * Resolución: 0.18 Pa. Rango: 300 – 1100 hPa.
     * @param unidad Unidad de presión
     */
    //% blockId=fisicabit_bme280_presion
    //% block="BME280 pressure in %unidad"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=94
    //% unidad.defl=UnidadPresion.hPa
    export function bme280Presion(unidad: UnidadPresion): number {
        if (!_bmeListo) return 0
        _bmeForzarLectura()
        // _bmeUltPres está en Pa × 256
        let pa = _bmeUltPres / 256.0
        switch (unidad) {
            case UnidadPresion.Pa:
                return Math.round(pa)
            case UnidadPresion.hPa:
                return Math.round(pa / 100 * 10) / 10
            case UnidadPresion.mmHg:
                return Math.round(pa * 0.00750062 * 10) / 10
            case UnidadPresion.Atm:
                return Math.round(pa / 101325 * 10000) / 10000
            default:
                return Math.round(pa / 100 * 10) / 10
        }
    }

    /**
     * Lee la humedad relativa del BME280 en %.
     * Resolución: 0.008 %RH. Precisión: ±3 %RH.
     */
    //% blockId=fisicabit_bme280_humedad
    //% block="BME280 humidity (percent RH)"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=93
    export function bme280Humedad(): number {
        if (!_bmeListo) return 0
        _bmeForzarLectura()
        // _bmeUltHum está en %RH × 1024
        return Math.round(_bmeUltHum / 1024 * 10) / 10
    }

    /**
     * Calcula la altitud aproximada usando la presión barométrica.
     * Fórmula barométrica: altitud = 44330 × (1 - (P/P₀)^0.1903)
     * donde P₀ = presión a nivel del mar (1013.25 hPa por defecto).
     * @param presionNivelMar Presión de referencia a nivel del mar en hPa
     */
    //% blockId=fisicabit_bme280_altitud
    //% block="BME280 altitude (m) sea level %presionNivelMar hPa"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=92
    //% presionNivelMar.defl=1013.25
    export function bme280Altitud(presionNivelMar: number): number {
        if (!_bmeListo) return 0
        _bmeForzarLectura()
        let pHpa = _bmeUltPres / 256.0 / 100.0
        if (presionNivelMar <= 0) presionNivelMar = 1013.25
        // Fórmula barométrica internacional
        let alt = 44330.0 * (1.0 - Math.pow(pHpa / presionNivelMar, 0.1903))
        return Math.round(alt * 10) / 10
    }

    /**
     * Indica si el sensor BME280 fue detectado e inicializado correctamente.
     */
    //% blockId=fisicabit_bme280_conectado
    //% block="BME280 sensor connected"
    //% group="BME280 — Pressure/Temp/Humidity (I2C)"
    //% weight=85
    export function bme280Conectado(): boolean {
        return _bmeListo
    }
}
