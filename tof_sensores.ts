// =============================================================================
//  tof_sensores.ts — Sensores de distancia ToF (Time-of-Flight) por I2C
// =============================================================================
//  Proyecto: FisicaBit.com
//  Módulos soportados (todos con dirección I2C 0x29):
//    - TOF050C      (chip VL6180X) — 2 a 50 cm,   infrarrojo 850 nm, FOV 25°
//    - TOF200C      (chip VL53L0X) — 3 a 200 cm,  infrarrojo 940 nm, FOV 25°
//    - GY-VL53L0XV2 (chip VL53L0X) — 3 a 200 cm,  igual que el TOF200C
//    - TOF400C      (chip VL53L1X) — 4 a 400 cm,  infrarrojo 940 nm, FOV 27°
//    - "autodetectar": lee el registro de identidad del chip y elige el driver
//
//  Alimentación: 3 V – 5 V DC, 40 mA máx.
//
//  PINES (kit de expansión / breakout del micro:bit):
//    1er sensor: SDA → P20 (marcado "SDA" o "20"), SCL → P19 ("SCL" o "19").
//                Es el bus I2C por hardware: el más rápido y el recomendado.
//    2º sensor:  SDA → P14, SCL → P13  (I2C por software, ver shims.cpp)
//    3er sensor: SDA → P16, SCL → P15
//    Como los módulos usan la misma dirección (0x29), para usar más de uno
//    hay que darles pines distintos. P13–P16 son pines digitales libres en
//    todos los kits (no tocan la pantalla LED ni los botones) y dejan P0–P2
//    libres para sensores analógicos.
//
//  CABLEADO (igual para todos los módulos):
//    VCC → 3V · GND → GND · SDA → pin SDA elegido · SCL → pin SCL elegido
//
//  USO TÍPICO EN BLOQUES (un solo bloque, se inicializa solo):
//    por siempre:
//      [enviar a fisicabit.com tiempo y
//         (distancia ToF [TOF200C] SDA [P20] SCL [P19] en [cm]) cada 50 ms]
// =============================================================================


// Extiende el namespace FisicaBit con los sensores de distancia ToF
//% weight=92
//% color=#1E90FF
//% icon="\uf140"
//% block="ToF — Laser Distance"
//% groups='["Measurement", "Configuration", "Diagnostics"]'
namespace FisicaBitToF {

    // =========================================================================
    // Bus I2C: por hardware (P20/P19) o por software (cualquier otro par)
    // =========================================================================
    const ADDR = 0x29

    //% shim=fisicabit_native::swi2cWrite
    function _swWrite(sda: number, scl: number, addr: number, b: Buffer): number {
        return 3   // simulador: sin bus por software
    }

    //% shim=fisicabit_native::swi2cRead
    function _swRead(sda: number, scl: number, addr: number, n: number): Buffer {
        return pins.createBuffer(0)
    }

    class Bus {
        sda: DigitalPin
        scl: DigitalPin
        hw: boolean
        ok: boolean
        constructor(sda: DigitalPin, scl: DigitalPin) {
            this.sda = sda
            this.scl = scl
            this.hw = (sda == DigitalPin.P20 && scl == DigitalPin.P19)
            this.ok = true
        }
        write(b: Buffer): void {
            if (this.hw) {
                this.ok = pins.i2cWriteBuffer(ADDR, b) == 0
            } else {
                this.ok = _swWrite(this.sda, this.scl, ADDR, b) == 0
            }
        }
        read(n: number): Buffer {
            if (this.hw) return pins.i2cReadBuffer(ADDR, n)
            const r = _swRead(this.sda, this.scl, ADDR, n)
            if (r.length < n) {
                this.ok = false
                return pins.createBuffer(n)
            }
            return r
        }
    }

    // =========================================================================
    // Sensor: un objeto por par de pines (permite varios módulos a la vez)
    // =========================================================================
    let _filtroDef = 3
    let _rapidoDef = false

    class Sensor {
        bus: Bus
        modeloPedido: ModeloToF
        driver: number            // 0=VL6180X, 1=VL53L0X, 2=VL53L1X, -1=desconocido
        listo: boolean
        filtroN: number
        rapido: boolean
        ultVal: number            // Último valor válido (fallback)
        ultOk: boolean            // ¿Última medición fue válida?
        stopVar: number           // Variable stop del VL53L0X
        ultIntentoMs: number
        constructor(sda: DigitalPin, scl: DigitalPin) {
            this.bus = new Bus(sda, scl)
            this.modeloPedido = ModeloToF.TOF200C
            this.driver = -1
            this.listo = false
            this.filtroN = _filtroDef
            this.rapido = _rapidoDef
            this.ultVal = 0
            this.ultOk = false
            this.stopVar = 0
            this.ultIntentoMs = -100000
        }
    }

    let _sensores: Sensor[] = []
    let _s: Sensor = null      // sensor activo (lo usan los drivers)
    let _b: Bus = null         // bus activo

    function _obtener(sda: DigitalPin, scl: DigitalPin): Sensor {
        for (let i = 0; i < _sensores.length; i++) {
            const t = _sensores[i]
            if (t.bus.sda == sda && t.bus.scl == scl) return t
        }
        const nuevo = new Sensor(sda, scl)
        _sensores.push(nuevo)
        return nuevo
    }

    function _porDefecto(): Sensor {
        return _obtener(DigitalPin.P20, DigitalPin.P19)
    }

    function _activar(s: Sensor): void {
        _s = s
        _b = s.bus
    }

    function _driverDe(modelo: ModeloToF): number {
        switch (modelo) {
            case ModeloToF.TOF050C: return 0
            case ModeloToF.TOF200C: return 1
            case ModeloToF.VL53L0XV2: return 1
            case ModeloToF.TOF400C: return 2
            default: return -1     // Auto
        }
    }

    // =========================================================================
    // I2C — Direcciones de registro de 8 bits (VL53L0X)
    // =========================================================================

    function w8(reg: number, val: number): void {
        let b = pins.createBuffer(2)
        b[0] = reg; b[1] = val
        _b.write(b)
    }

    function r8(reg: number): number {
        let b = pins.createBuffer(1)
        b[0] = reg
        _b.write(b)
        return _b.read(1)[0]
    }

    function w8v16(reg: number, val: number): void {
        let b = pins.createBuffer(3)
        b[0] = reg
        b[1] = (val >> 8) & 0xFF
        b[2] = val & 0xFF
        _b.write(b)
    }

    function r8v16(reg: number): number {
        let b = pins.createBuffer(1)
        b[0] = reg
        _b.write(b)
        let r = _b.read(2)
        return (r[0] << 8) | r[1]
    }

    // =========================================================================
    // I2C — Direcciones de registro de 16 bits (VL6180X, VL53L1X)
    // =========================================================================

    function w16(reg: number, val: number): void {
        let b = pins.createBuffer(3)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        b[2] = val & 0xFF
        _b.write(b)
    }

    function r16(reg: number): number {
        let b = pins.createBuffer(2)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        _b.write(b)
        return _b.read(1)[0]
    }

    function w16v16(reg: number, val: number): void {
        let b = pins.createBuffer(4)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        b[2] = (val >> 8) & 0xFF
        b[3] = val & 0xFF
        _b.write(b)
    }

    function r16v16(reg: number): number {
        let b = pins.createBuffer(2)
        b[0] = (reg >> 8) & 0xFF
        b[1] = reg & 0xFF
        _b.write(b)
        let r = _b.read(2)
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
        _b.write(b)
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
        w16(0x001C, _s.rapido ? 0x18 : 0x32)

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
        _s.stopVar = r8(0x91)
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
        if (!_s.rapido) {
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
        w8(0x91, _s.stopVar)
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
        _b.write(buf)

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
        if (_s.rapido) {
            w16v16(0x005E, 0x001E)  // Timeout macro A
            w16v16(0x0061, 0x0022)  // Timeout macro B
        } else {
            w16v16(0x005E, 0x00AD)  // Timeout macro A
            w16v16(0x0061, 0x00C6)  // Timeout macro B
        }

        // ── Configurar período entre mediciones ──
        let clk = r16v16(0x00DE) & 0x3FF
        if (clk > 0) {
            let periodoMs = _s.rapido ? 25 : 55
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

    /** Detecta el chip leyendo su registro de identidad (bus activo). */
    function _detectar(): number {
        if (r16(0x0000) == 0xB4 && _b.ok) return 0          // VL6180X
        if (r16v16(0x010F) == 0xEACC && _b.ok) return 2      // VL53L1X
        if (r8(0xC0) == 0xEE && _b.ok) return 1              // VL53L0X
        return -1
    }

    function _doInit(s: Sensor): boolean {
        _activar(s)
        s.bus.ok = true
        s.driver = _driverDe(s.modeloPedido)
        if (s.driver < 0) s.driver = _detectar()
        if (s.driver < 0) return false
        let ok = false
        switch (s.driver) {
            case 0: ok = vl6180x_init(); break
            case 1: ok = vl53l0x_init(); break
            case 2: ok = vl53l1x_init(); break
        }
        return ok && s.bus.ok
    }

    function _doRead(s: Sensor): number {
        if (!s.listo) return -1
        _activar(s)
        let d = -1
        switch (s.driver) {
            case 0: d = vl6180x_read(); break
            case 1: d = vl53l0x_read(); break
            case 2: d = vl53l1x_read(); break
        }
        return s.bus.ok ? d : -1
    }

    /**
     * Lee la distancia aplicando filtro de mediana.
     * El filtro toma N lecturas, ordena y devuelve la central,
     * eliminando picos espurios de manera robusta.
     */
    function _readFiltered(s: Sensor): number {
        if (!s.listo) return 0

        let n = s.filtroN

        // ── Sin filtro: lectura única ──
        if (n <= 1) {
            let d = _doRead(s)
            if (d >= 0) {
                s.ultVal = d
                s.ultOk = true
            } else {
                s.ultOk = false
            }
            return d >= 0 ? d : s.ultVal
        }

        // ── Con filtro de mediana ──
        let lecturas: number[] = []
        let validas = 0

        for (let i = 0; i < n; i++) {
            let d = _doRead(s)
            if (d >= 0) {
                lecturas.push(d)
                validas++
            }
            // Pausa entre lecturas para sensores single-shot
            if (i < n - 1 && s.driver != 2) {
                basic.pause(5)
            }
        }

        if (validas == 0) {
            s.ultOk = false
            return s.ultVal
        }

        // Ordenar y tomar mediana
        isort(lecturas, validas)
        let mediana = lecturas[Math.idiv(validas, 2)]
        s.ultVal = mediana
        s.ultOk = true
        return mediana
    }

    /** Inicializa si hace falta, reintentando como mucho una vez por segundo. */
    function _asegurar(s: Sensor): boolean {
        if (s.listo) return true
        const ahora = control.millis()
        if (ahora - s.ultIntentoMs < 1000) return false
        s.ultIntentoMs = ahora
        s.listo = _doInit(s)
        if (!s.listo) s.ultOk = false
        return s.listo
    }

    function _convertir(mm: number, unidad: UnidadDistancia): number {
        switch (unidad) {
            case UnidadDistancia.Milimetros: return mm
            case UnidadDistancia.Pulgadas: return Math.round(mm / 25.4 * 100) / 100
            default: return Math.round(mm) / 10          // cm con 1 decimal
        }
    }

    function _nombreDriver(d: number): string {
        switch (d) {
            case 0: return "TOF050C (VL6180X)"
            case 1: return "TOF200C / GY-VL53L0XV2 (VL53L0X)"
            case 2: return "TOF400C (VL53L1X)"
            default: return "none"
        }
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Medición en un solo bloque
    // =========================================================================

    /**
     * Mide la distancia con un módulo láser ToF en UN solo bloque: elegí el
     * módulo, indicá en qué pines está conectado y la unidad. Se inicializa
     * solo la primera vez (y se reintenta si el sensor no responde); usa
     * filtro de mediana y, si una medición falla, devuelve la última válida.
     *
     * Pines sugeridos en un kit de expansión del micro:bit:
     *   1er sensor: SDA P20 (pin "SDA"/"20") y SCL P19 ("SCL"/"19") = bus
     *               I2C por hardware, el más rápido. VCC → 3V, GND → GND.
     *   2º sensor:  SDA P14 y SCL P13 · 3er sensor: SDA P16 y SCL P15
     *               (los módulos comparten la dirección 0x29, así que cada
     *               sensor extra necesita su propio par de pines).
     *
     * Ejemplo (MRU en un riel): [para siempre] → [enviar a fisicabit.com
     * tiempo y (distancia ToF [TOF200C] SDA [P20] SCL [P19] en [cm]) cada 50 ms]
     * @param modelo Módulo conectado (o autodetectar)
     * @param sda Pin conectado a SDA del módulo
     * @param scl Pin conectado a SCL del módulo
     * @param unidad Unidad: cm (1 decimal), mm o pulgadas
     */
    //% block="ToF distance %modelo SDA %sda SCL %scl in %unidad"
    //% blockId=fisicabit_tof_distancia
    //% group="Measurement"
    //% weight=100
    //% inlineInputMode=inline
    //% modelo.defl=ModeloToF.TOF200C
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    //% unidad.defl=UnidadDistancia.Centimetros
    export function tofDistancia(modelo: ModeloToF, sda: DigitalPin, scl: DigitalPin, unidad: UnidadDistancia): number {
        const s = _obtener(sda, scl)
        if (s.modeloPedido != modelo) {
            s.modeloPedido = modelo
            s.listo = false
            s.ultIntentoMs = -100000
        }
        if (!_asegurar(s)) return _convertir(s.ultVal, unidad)
        return _convertir(_readFiltered(s), unidad)
    }

    /**
     * Pines sugeridos para el sensor número 1, 2 o 3 en un kit de expansión
     * del micro:bit, como texto (por ejemplo "SDA P20 SCL P19"). Mostrarlo
     * en pantalla o enviarlo por USB para saber dónde cablear.
     * @param numero Número de sensor (1 = bus por hardware P20/P19)
     */
    //% block="suggested ToF pins for sensor number %numero"
    //% blockId=fisicabit_tof_pines
    //% group="Measurement"
    //% weight=95
    //% numero.min=1 numero.max=3 numero.defl=1
    export function tofPinesSugeridos(numero: number): string {
        if (numero <= 1) return "SDA P20 SCL P19"
        if (numero == 2) return "SDA P14 SCL P13"
        return "SDA P16 SCL P15"
    }

    /**
     * Módulo detectado en los pines indicados, leyendo la identidad del chip:
     * "TOF050C (VL6180X)", "TOF200C / GY-VL53L0XV2 (VL53L0X)",
     * "TOF400C (VL53L1X)" o "none" si no responde nada (revisar VCC, GND y
     * que SDA/SCL no estén cruzados).
     * @param sda Pin conectado a SDA del módulo
     * @param scl Pin conectado a SCL del módulo
     */
    //% block="ToF module detected SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_detectado
    //% group="Diagnostics"
    //% weight=82
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofModuloDetectado(sda: DigitalPin, scl: DigitalPin): string {
        const s = _obtener(sda, scl)
        _activar(s)
        s.bus.ok = true
        return _nombreDriver(_detectar())
    }

    /**
     * Verdadero si hay un módulo ToF respondiendo en los pines indicados.
     * @param sda Pin conectado a SDA del módulo
     * @param scl Pin conectado a SCL del módulo
     */
    //% block="ToF sensor found? SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_hay
    //% group="Diagnostics"
    //% weight=81
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofHaySensor(sda: DigitalPin, scl: DigitalPin): boolean {
        const s = _obtener(sda, scl)
        _activar(s)
        s.bus.ok = true
        return _detectar() >= 0
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — Setup
    // =========================================================================

    /**
     * (Modo clásico, sensor en P20/P19) Selecciona el módulo ToF que vas a
     * usar. Llamar ANTES de inicializar. Con el bloque "distancia ToF ..."
     * de un solo paso no hace falta.
     *
     * @param modelo El módulo conectado al micro:bit
     */
    //% block="select ToF module %modelo"
    //% blockId=fisicabit_tof_seleccionar
    //% group="Configuration"
    //% weight=100
    //% modelo.defl=ModeloToF.TOF200C
    export function tofSeleccionarModulo(modelo: ModeloToF): void {
        const s = _porDefecto()
        s.modeloPedido = modelo
        s.listo = false
    }

    /**
     * Inicializa el sensor ToF seleccionado.
     * Detecta el chip, lo configura y lo deja listo para medir.
     * Muestra ✓ en el LED si tuvo éxito, ✗ si falló.
     *
     * Conexión física ToF (TOF050C/200C/400C) → micro:bit:
     *   VCC → 3V
     *   GND → GND
     *   SDA → P20 (SDA)
     *   SCL → P19 (SCL)
     */
    //% block="initialize ToF sensor (I2C: SDA P20 SCL P19)"
    //% blockId=fisicabit_tof_inicializar
    //% group="Configuration"
    //% weight=99
    export function tofInicializar(): void {
        const s = _porDefecto()
        s.listo = _doInit(s)
        s.ultVal = 0
        s.ultOk = false
        if (s.listo) {
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
    //% group="Configuration"
    //% weight=95
    //% filtro.defl=FiltroToF.Bajo
    export function tofFijarSuavizado(filtro: FiltroToF): void {
        _filtroDef = filtro
        for (let i = 0; i < _sensores.length; i++) _sensores[i].filtroN = filtro
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
    //% group="Configuration"
    //% weight=94
    //% modo.defl=ModoToF.Estable
    export function tofFijarModo(modo: ModoToF): void {
        _rapidoDef = (modo == ModoToF.Rapida)
        for (let i = 0; i < _sensores.length; i++) {
            const s = _sensores[i]
            s.rapido = _rapidoDef
            if (s.listo) s.listo = _doInit(s)
        }
    }


    // =========================================================================
    // BLOQUES PÚBLICOS — Medición
    // =========================================================================

    /**
     * (Modo clásico, sensor en P20/P19) Mide la distancia en milímetros.
     * Incluye filtro de mediana para eliminar picos espurios. Si todavía no
     * se inicializó, lo hace solo con el módulo seleccionado.
     */
    //% block="ToF distance (mm)"
    //% blockId=fisicabit_tof_mm
    //% group="Measurement"
    //% weight=90
    export function tofDistanciaMm(): number {
        const s = _porDefecto()
        if (!_asegurar(s)) return s.ultVal
        return _readFiltered(s)
    }

    /**
     * (Modo clásico, sensor en P20/P19) Mide la distancia en centímetros
     * (entero). Útil para mostrar en la pantalla LED o para cálculos simples.
     */
    //% block="ToF distance (cm)"
    //% blockId=fisicabit_tof_cm
    //% group="Measurement"
    //% weight=89
    export function tofDistanciaCm(): number {
        const s = _porDefecto()
        if (!_asegurar(s)) return Math.idiv(s.ultVal, 10)
        return Math.idiv(_readFiltered(s), 10)
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
    export function tofMedicionValida(): boolean {
        let ok = false
        for (let i = 0; i < _sensores.length; i++) if (_sensores[i].ultOk) ok = true
        return ok
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
    //% group="Diagnostics"
    //% weight=80
    export function tofSensorConectado(): boolean {
        return _porDefecto().listo
    }

    /**
     * Reinicia el sensor desde cero.
     * Útil si el sensor dejó de responder o se desconectó y reconectó.
     */
    //% block="restart ToF sensor"
    //% blockId=fisicabit_tof_reiniciar
    //% group="Diagnostics"
    //% weight=75
    export function tofReiniciar(): void {
        for (let i = 0; i < _sensores.length; i++) {
            const s = _sensores[i]
            s.listo = false
            basic.pause(50)
            s.listo = _doInit(s)
            s.ultVal = 0
            s.ultOk = false
        }
    }

    /**
     * Lee la distancia cruda sin filtrar (una sola lectura).
     * Máxima velocidad pero puede tener picos espurios.
     * Devuelve -1 si la medición falló.
     */
    //% block="ToF raw distance (mm)"
    //% blockId=fisicabit_tof_crudo
    //% group="Diagnostics"
    //% weight=70
    export function tofDistanciaCrudaMm(): number {
        const s = _porDefecto()
        if (!_asegurar(s)) return -1
        return _doRead(s)
    }
}
