// =============================================================================
//  tof_sensores.ts — Sensores de distancia ToF (Time-of-Flight) por I2C
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensores soportados:
//    - TOF050C (chip VL6180X)  — 0 a 50 cm,  infrarrojo 850 nm, FOV 25°
//    - TOF200C (chip VL53L0X)  — 0 a 200 cm, infrarrojo 940 nm, FOV 25°
//    - TOF400C (chip VL53L1X)  — 0 a 400 cm, infrarrojo 940 nm, FOV 27°
//
//  Comunicación: I2C (dirección 7-bit: 0x29)
//  Alimentación: 3.0V – 5.0V DC, 40 mA máx.
//  Solo se puede usar UN sensor a la vez (comparten dirección I2C).
//
//  CABLEADO (igual para los 3 módulos):
//    ┌──────────────────────────────────┐
//    │  Módulo TOF                      │
//    │  ┌──────────────────────┐        │
//    │  │  VCC  │──── 3V       │        │
//    │  │  GND  │──── GND      │        │
//    │  │  SDA  │──── P20 (SDA)│        │  Bus I2C del micro:bit
//    │  │  SCL  │──── P19 (SCL)│        │
//    │  └──────────────────────┘        │
//    └──────────────────────────────────┘
//
//  USO TÍPICO EN BLOQUES:
//    al iniciar:
//      [seleccionar módulo ToF [TOF200C (2 m)]]
//      [inicializar sensor ToF]
//    por siempre:
//      [serial muestrear [tiempo serial] y [distancia ToF mm] cada 50 ms]
// =============================================================================


//% weight=95
//% color=#8B5CF6
//% icon="\uf0b2"
//% block="FisicaBit ToF"
//% groups="['Setup', 'Measurement', 'Advanced']"
namespace FisicaBitToF {

    // =========================================================================
    // Estado interno
    // =========================================================================
    const ADDR = 0x29
    let _modelo = 1           // 0=VL6180X, 1=VL53L0X, 2=VL53L1X
    let _listo = false
    let _filtroN = 3
    let _rapido = false
    let _ultVal = 0           // Último valor válido (fallback)
    let _ultOk = false        // ¿Última medición fue válida?
    let _stopVar = 0          // Variable stop del VL53L0X

    // =========================================================================
    // I2C — Direcciones de registro de 8 bits (VL53L0X)
    // =========================================================================

    function w8(reg: number, val: number): void {
        let b = pins.createBuffer(2)
        b[0] = reg; b[1] = val
        pins.i2cWriteBuffer(ADDR, b)
    }

    function r8(reg: number): number {
        pins.i2cWriteNumber(ADDR, reg, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(ADDR, NumberFormat.UInt8BE)
    }

    function w8v16(reg: number, val: number): void {
        let b = pins.createBuffer(3)
        b[0] = reg
        b[1] = (val >> 8) & 0xFF
        b[2] = val & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
    }

    function r8v16(reg: number): number {
        pins.i2cWriteNumber(ADDR, reg, NumberFormat.UInt8BE)
        let b = pins.i2cReadBuffer(ADDR, 2)
        return (b[0] << 8) | b[1]
    }

    // =========================================================================
    // I2C — Direcciones de registro de 16 bits (VL6180X, VL53L1X)
    // =========================================================================

    function w16(reg: number, val: number): void {
        let b = pins.createBuffer(3)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        b[2] = val & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
    }

    function r16(reg: number): number {
        let b = pins.createBuffer(2)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
        return pins.i2cReadBuffer(ADDR, 1)[0]
    }

    function w16v16(reg: number, val: number): void {
        let b = pins.createBuffer(4)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        b[2] = (val >> 8) & 0xFF
        b[3] = val & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
    }

    function r16v16(reg: number): number {
        let b = pins.createBuffer(2)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
        let r = pins.i2cReadBuffer(ADDR, 2)
        return (r[0] << 8) | r[1]
    }

    function w16v32(reg: number, val: number): void {
        let b = pins.createBuffer(6)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        b[2] = (val >> 24) & 0xFF
        b[3] = (val >> 16) & 0xFF
        b[4] = (val >> 8) & 0xFF
        b[5] = val & 0xFF
        pins.i2cWriteBuffer(ADDR, b)
    }

    // =========================================================================
    // Helpers internos
    // =========================================================================

    /** Polling de un registro de 8 bits de dirección. */
    function poll_r8(reg: number, mask: number, val: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r8(reg) & mask) == val) return true
            basic.pause(1)
        }
        return false
    }

    /** Polling de un registro de 16 bits de dirección. */
    function poll_r16(reg: number, mask: number, val: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r16(reg) & mask) == val) return true
            basic.pause(1)
        }
        return false
    }

    /** Insertion sort para arrays pequeños (mediana). */
    function isort(a: number[], n: number): void {
        for (let i = 1; i < n; i++) {
            let k = a[i], j = i - 1
            while (j >= 0 && a[j] > k) { a[j + 1] = a[j]; j-- }
            a[j + 1] = k
        }
    }


    // =========================================================================
    // DRIVER: VL6180X (TOF050C) — 0 a 50 cm
    // =========================================================================
    // Chip: VL6180, infrarrojo 850 nm, FOV 25°
    // Zona muerta: 0–2 cm
    // Registros: direcciones de 16 bits, datos de 8 bits
    // Referencia: ST Application Note AN4545
    // =========================================================================

    function vl6180x_init(): boolean {
        // Verificar identidad del chip (MODEL_ID = 0xB4)
        if (r16(0x0000) != 0xB4) return false

        // ── Registros privados obligatorios (AN4545) ──
        w16(0x0207, 0x01); w16(0x0208, 0x01)
        w16(0x0096, 0x00); w16(0x0097, 0xFD)
        w16(0x00E3, 0x00); w16(0x00E4, 0x04)
        w16(0x00E5, 0x02); w16(0x00E6, 0x01)
        w16(0x00E7, 0x03); w16(0x00F5, 0x02)
        w16(0x00D9, 0x05); w16(0x00DB, 0xCE)
        w16(0x00DC, 0x03); w16(0x00DD, 0xF8)
        w16(0x009F, 0x00); w16(0x00A3, 0x3C)
        w16(0x00B7, 0x00); w16(0x00BB, 0x3C)
        w16(0x00B2, 0x09); w16(0x00CA, 0x09)
        w16(0x0198, 0x01); w16(0x01B0, 0x17)
        w16(0x01AD, 0x00); w16(0x00FF, 0x05)
        w16(0x0100, 0x05); w16(0x0199, 0x05)
        w16(0x01A6, 0x1B); w16(0x01AC, 0x3E)
        w16(0x01A7, 0x1F); w16(0x0030, 0x00)

        // ── Configuración pública recomendada ──
        w16(0x0011, 0x10)  // GPIO1 = muestra lista
        w16(0x010A, 0x30)  // Período de promediado
        w16(0x003F, 0x46)  // Ganancia
        w16(0x0031, 0xFF)  // Auto-calibración cada N mediciones
        w16(0x002E, 0x01)  // Calibración de temperatura

        // ── Configuración de rango ──
        w16(0x001B, 0x09)  // Período entre mediciones ~100ms
        w16(0x003E, 0x31)  // VHV repeat rate
        w16(0x0014, 0x24)  // VHV recalibración
        // Tiempo máximo de convergencia: 50ms estable, 24ms rápido
        w16(0x001C, _rapido ? 0x18 : 0x32)

        // Marcar como inicializado
        w16(0x0016, 0x00)
        return true
    }

    function vl6180x_read(): number {
        // Iniciar medición single-shot
        w16(0x0018, 0x01)

        // Esperar medición completa (bit 2 de RESULT__INTERRUPT_STATUS_GPIO)
        if (!poll_r16(0x004F, 0x04, 0x04, 150)) return -1

        // Leer distancia en mm
        let d = r16(0x0062)

        // Limpiar interrupción
        w16(0x0015, 0x07)

        // Verificar estado (0=OK, 11=convergencia temprana pero válida)
        let status = r16(0x004D) >> 4
        if (status != 0 && status != 11) return -1
        if (d >= 255) return -1

        return d
    }


    // =========================================================================
    // DRIVER: VL53L0X (TOF200C) — 0 a 200 cm
    // =========================================================================
    // Chip: VL53L0X, infrarrojo 940 nm, FOV 25°
    // Zona muerta: 0–3 cm
    // Registros: direcciones de 8 bits
    // Referencia: ST API / Pololu VL53L0X library
    // =========================================================================

    function vl53l0x_init(): boolean {
        // Verificar identidad del chip (register 0xC0 = 0xEE)
        if (r8(0xC0) != 0xEE) return false

        // Modo 2.8V (activar regulador interno)
        w8(0x89, r8(0x89) | 0x01)

        // I2C standard mode
        w8(0x88, 0x00)

        // Leer stop variable (necesaria para cada medición)
        w8(0x80, 0x01)
        w8(0xFF, 0x01)
        w8(0x00, 0x00)
        _stopVar = r8(0x91)
        w8(0x00, 0x01)
        w8(0xFF, 0x00)
        w8(0x80, 0x00)

        // Deshabilitar límite MSRC (mejora rango)
        w8(0x60, r8(0x60) | 0x12)

        // Límite de señal: 0.25 MCPS (32 = 0.25 × 128)
        w8v16(0x44, 0x0020)

        // Secuencia de medición
        w8(0x01, 0xE8)

        // Configuración de rango largo (mejor para > 50cm)
        if (!_rapido) {
            w8v16(0x51, 0x0099)  // Range config period A
            w8v16(0x70, 0x0078)  // Range config period B
        }

        // ── Calibración VHV ──
        w8(0x00, 0x41)
        if (!poll_r8(0x13, 0x07, 0x07, 200)) return false
        w8(0x0B, 0x01)  // Clear interrupt
        w8(0x00, 0x00)

        // ── Calibración de fase ──
        w8(0x00, 0x01)
        if (!poll_r8(0x13, 0x07, 0x07, 200)) return false
        w8(0x0B, 0x01)
        w8(0x00, 0x00)

        return true
    }

    function vl53l0x_read(): number {
        // Secuencia de inicio de medición single-shot
        w8(0x80, 0x01)
        w8(0xFF, 0x01)
        w8(0x00, 0x00)
        w8(0x91, _stopVar)
        w8(0x00, 0x01)
        w8(0xFF, 0x00)
        w8(0x80, 0x00)
        w8(0x00, 0x01)  // SYSRANGE_START

        // Esperar resultado (RESULT_INTERRUPT_STATUS bit 0-2)
        if (!poll_r8(0x13, 0x07, 0x07, 200)) return -1

        // Leer distancia (16 bits en RESULT_RANGE_STATUS + 10)
        let d = r8v16(0x1E)

        // Limpiar interrupción
        w8(0x0B, 0x01)

        // Validar
        if (d == 0 || d > 8190) return -1
        return d
    }


    // =========================================================================
    // DRIVER: VL53L1X (TOF400C) — 0 a 400 cm
    // =========================================================================
    // Chip: VL53L1X, infrarrojo 940 nm, FOV 27°
    // Zona muerta: 0–4 cm
    // Registros: direcciones de 16 bits
    // Referencia: ST VL53L1X Ultra Lite Driver (ULD)
    // =========================================================================

    function vl53l1x_init(): boolean {
        // Esperar boot del sensor (bit 0 de registro 0x0001)
        if (!poll_r16(0x0001, 0x01, 0x01, 1000)) return false

        // Verificar identidad (MODEL_ID + MODULE_TYPE = 0xEACC)
        if (r16v16(0x010F) != 0xEACC) return false

        // ── Escribir configuración por defecto del ST ULD ──
        // 91 bytes secuenciales desde registro 0x002D hasta 0x0087
        let cfg = [
            0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x02, 0x08,
            0x00, 0x08, 0x10, 0x01, 0x01, 0x00, 0x00, 0x00,
            0x00, 0xFF, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x20, 0x0B, 0x00, 0x00, 0x02, 0x0A, 0x21,
            0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0xC8,
            0x00, 0x00, 0x38, 0xFF, 0x01, 0x00, 0x08, 0x00,
            0x00, 0x01, 0xDB, 0x0F, 0x01, 0xF1, 0x0D, 0x01,
            0x68, 0x00, 0x80, 0x08, 0xB8, 0x00, 0x00, 0x00,
            0x00, 0x0F, 0x89, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x01, 0x0F, 0x0D, 0x0E, 0x0E, 0x00,
            0x00, 0x02, 0xC7, 0xFF, 0x9B, 0x00, 0x00, 0x00,
            0x01, 0x01, 0x40
        ]
        // Escribir todo en una sola transacción I2C (eficiente)
        let buf = pins.createBuffer(cfg.length + 2)
        buf[0] = 0x00  // Registro 0x002D byte alto
        buf[1] = 0x2D  // Registro 0x002D byte bajo
        for (let i = 0; i < cfg.length; i++) buf[i + 2] = cfg[i]
        pins.i2cWriteBuffer(ADDR, buf)

        basic.pause(100)

        // ── Configurar modo de distancia largo (hasta 4 m) ──
        w16(0x004B, 0x0A)      // PHASECAL timeout
        w16(0x0060, 0x0F)      // VCSEL period A
        w16(0x0063, 0x0D)      // VCSEL period B
        w16(0x0069, 0xB8)      // Valid phase high
        w16v16(0x0078, 0x0F0D) // WOI SD0
        w16v16(0x007A, 0x0E0E) // Initial phase SD0

        // ── Configurar timing budget ──
        // Estable: 50ms (preciso), Rápido: 20ms (alta frecuencia)
        if (_rapido) {
            w16v16(0x005E, 0x001E)  // Timeout macro A
            w16v16(0x0061, 0x0022)  // Timeout macro B
        } else {
            w16v16(0x005E, 0x00AD)  // Timeout macro A
            w16v16(0x0061, 0x00C6)  // Timeout macro B
        }

        // ── Configurar período entre mediciones ──
        let clk = r16v16(0x00DE) & 0x3FF
        if (clk > 0) {
            let periodoMs = _rapido ? 25 : 55
            let val = Math.round(clk * periodoMs * 1.075)
            w16v32(0x006C, val)
        }

        // ── Iniciar medición continua ──
        w16(0x0087, 0x40)
        basic.pause(20)

        return true
    }

    function vl53l1x_read(): number {
        // Esperar datos listos (bit 0 de GPIO__TIO_HV_STATUS)
        if (!poll_r16(0x0031, 0x01, 0x01, 200)) return -1

        // Leer distancia en mm (16 bits)
        let d = r16v16(0x0096)

        // Verificar estado del rango (0 = válido)
        let status = r16(0x0089) & 0x1F

        // Limpiar interrupción (permite la siguiente medición)
        w16(0x0086, 0x01)

        if (status != 0) return -1
        if (d == 0) return -1

        return d
    }


    // =========================================================================
    // Dispatcher interno — enruta al driver correcto
    // =========================================================================

    function _doInit(): boolean {
        switch (_modelo) {
            case 0: return vl6180x_init()
            case 1: return vl53l0x_init()
            case 2: return vl53l1x_init()
            default: return false
        }
    }

    function _doRead(): number {
        if (!_listo) return -1
        switch (_modelo) {
            case 0: return vl6180x_read()
            case 1: return vl53l0x_read()
            case 2: return vl53l1x_read()
            default: return -1
        }
    }

    /**
     * Lee la distancia aplicando filtro de mediana.
     * El filtro toma N lecturas, ordena y devuelve la central,
     * eliminando picos espurios de manera robusta.
     */
    function _readFiltered(): number {
        if (!_listo) return 0

        let n = _filtroN

        // ── Sin filtro: lectura única ──
        if (n <= 1) {
            let d = _doRead()
            if (d >= 0) {
                _ultVal = d
                _ultOk = true
            } else {
                _ultOk = false
            }
            return d >= 0 ? d : _ultVal
        }

        // ── Con filtro de mediana ──
        let lecturas: number[] = []
        let validas = 0

        for (let i = 0; i < n; i++) {
            let d = _doRead()
            if (d >= 0) {
                lecturas.push(d)
                validas++
            }
            // Pausa entre lecturas para sensores single-shot
            if (i < n - 1 && _modelo != 2) {
                basic.pause(5)
            }
        }

        if (validas == 0) {
            _ultOk = false
            return _ultVal
        }

        // Ordenar y tomar mediana
        isort(lecturas, validas)
        let mediana = lecturas[Math.idiv(validas, 2)]
        _ultVal = mediana
        _ultOk = true
        return mediana
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — Setup
    // =========================================================================

    /**
     * Selecciona el módulo ToF que vas a usar.
     * Llamar ANTES de inicializar.
     *
     * @param modelo El módulo conectado al micro:bit
     */
    //% block="select ToF module %modelo"
    //% blockId=fisicabit_tof_seleccionar
    //% group="Setup"
    //% weight=100
    //% modelo.defl=ModeloToF.TOF200C
    export function seleccionarModulo(modelo: ModeloToF): void {
        _modelo = modelo
        _listo = false
    }

    /**
     * Inicializa el sensor ToF seleccionado.
     * Detecta el chip, lo configura y lo deja listo para medir.
     * Muestra ✓ en el LED si tuvo éxito, ✗ si falló.
     */
    //% block="initialize ToF sensor"
    //% blockId=fisicabit_tof_inicializar
    //% group="Setup"
    //% weight=99
    export function inicializar(): void {
        _listo = _doInit()
        _ultVal = 0
        _ultOk = false
        if (_listo) {
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Ajusta el suavizado de las mediciones.
     * Más suavizado = menos ruido pero más lento.
     *
     * Para MRU lento: bajo o medio
     * Para caída libre: ninguno o bajo
     *
     * @param filtro Intensidad del suavizado
     */
    //% block="set ToF smoothing %filtro"
    //% blockId=fisicabit_tof_suavizado
    //% group="Setup"
    //% weight=95
    //% filtro.defl=FiltroToF.Bajo
    export function fijarSuavizado(filtro: FiltroToF): void {
        _filtroN = filtro
    }

    /**
     * Cambia el modo de medición.
     * Estable: mediciones precisas para análisis detallado.
     * Rápida: más mediciones por segundo para fenómenos veloces.
     *
     * Si el sensor ya está iniciado, se re-inicializa automáticamente.
     *
     * @param modo Modo de medición
     */
    //% block="set ToF mode %modo"
    //% blockId=fisicabit_tof_modo
    //% group="Setup"
    //% weight=94
    //% modo.defl=ModoToF.Estable
    export function fijarModo(modo: ModoToF): void {
        _rapido = (modo == ModoToF.Rapida)
        if (_listo) {
            _listo = _doInit()
        }
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — Medición
    // =========================================================================

    /**
     * Mide la distancia en milímetros.
     * Incluye filtro de mediana para eliminar picos espurios.
     * Ideal para muestreo serial o Bluetooth en experimentos de movimiento.
     */
    //% block="ToF distance (mm)"
    //% blockId=fisicabit_tof_mm
    //% group="Measurement"
    //% weight=90
    export function distanciaMm(): number {
        return _readFiltered()
    }

    /**
     * Mide la distancia en centímetros (entero).
     * Útil para mostrar en la pantalla LED o para cálculos simples.
     */
    //% block="ToF distance (cm)"
    //% blockId=fisicabit_tof_cm
    //% group="Measurement"
    //% weight=89
    export function distanciaCm(): number {
        let mm = _readFiltered()
        return Math.idiv(mm, 10)
    }

    /**
     * Indica si la última medición fue válida.
     * Devuelve falso si el sensor no respondió, el objeto está
     * fuera de rango, o hubo un error de comunicación.
     */
    //% block="ToF measurement valid"
    //% blockId=fisicabit_tof_valida
    //% group="Measurement"
    //% weight=85
    export function medicionValida(): boolean {
        return _ultOk
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — Avanzado
    // =========================================================================

    /**
     * Indica si el sensor fue inicializado correctamente
     * y está listo para medir.
     */
    //% block="ToF sensor connected"
    //% blockId=fisicabit_tof_conectado
    //% group="Advanced"
    //% weight=80
    export function sensorConectado(): boolean {
        return _listo
    }

    /**
     * Reinicia el sensor desde cero.
     * Útil si el sensor dejó de responder o se desconectó y reconectó.
     */
    //% block="restart ToF sensor"
    //% blockId=fisicabit_tof_reiniciar
    //% group="Advanced"
    //% weight=75
    export function reiniciar(): void {
        _listo = false
        basic.pause(50)
        _listo = _doInit()
        _ultVal = 0
        _ultOk = false
    }

    /**
     * Lee la distancia cruda sin filtrar (una sola lectura).
     * Máxima velocidad pero puede tener picos espurios.
     * Devuelve -1 si la medición falló.
     */
    //% block="ToF raw distance (mm)"
    //% blockId=fisicabit_tof_crudo
    //% group="Advanced"
    //% weight=70
    export function distanciaCrudaMm(): number {
        return _doRead()
    }
}
