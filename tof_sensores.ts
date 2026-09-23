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
    // DRIVER: VL53L0X (TOF200C, GY-VL53L0XV2) — 3 a 200 cm
    // =========================================================================
    // Chip: VL53L0X, infrarrojo 940 nm, FOV 25°
    // Registros: direcciones de 8 bits
    // Referencia: ST API VL53L0X (DataInit + StaticInit + PerformRefCalibration)
    // en la forma de la biblioteca Pololu VL53L0X, que es la implementación
    // mínima probada: SPADs de referencia, "tuning settings", interrupción de
    // muestra lista, presupuesto de tiempo y calibraciones VHV / fase.
    // =========================================================================

    /** Lee N bytes consecutivos desde un registro de 8 bits. */
    function r8multi(reg: number, n: number): Buffer {
        let b = pins.createBuffer(1)
        b[0] = reg
        _b.write(b)
        return _b.read(n)
    }

    /** Escribe N bytes consecutivos desde un registro de 8 bits. */
    function w8multi(reg: number, datos: number[]): void {
        let b = pins.createBuffer(datos.length + 1)
        b[0] = reg
        for (let i = 0; i < datos.length; i++) b[i + 1] = datos[i] & 0xFF
        _b.write(b)
    }

    /** Espera hasta que (reg & mask) != 0. */
    function poll_r8_nonzero(reg: number, mask: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r8(reg) & mask) != 0) return true
            basic.pause(1)
        }
        return false
    }

    function l0x_getSpadInfo(): number[] {
        // Devuelve [count, esApertura] o [] si falla
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        w8(0xFF, 0x06)
        w8(0x83, r8(0x83) | 0x04)
        w8(0xFF, 0x07)
        w8(0x81, 0x01)
        w8(0x80, 0x01)
        w8(0x94, 0x6B)
        w8(0x83, 0x00)
        if (!poll_r8_nonzero(0x83, 0xFF, 200)) return []
        w8(0x83, 0x01)
        const tmp = r8(0x92)
        const count = tmp & 0x7F
        const apertura = (tmp >> 7) & 0x01
        w8(0x81, 0x00)
        w8(0xFF, 0x06)
        w8(0x83, r8(0x83) & ~0x04)
        w8(0xFF, 0x01)
        w8(0x00, 0x01)
        w8(0xFF, 0x00)
        w8(0x80, 0x00)
        return [count, apertura]
    }

    function l0x_refCalibration(vhvInitByte: number): boolean {
        w8(0x00, 0x01 | vhvInitByte)               // SYSRANGE_START
        if (!poll_r8_nonzero(0x13, 0x07, 500)) return false
        w8(0x0B, 0x01)                             // SYSTEM_INTERRUPT_CLEAR
        w8(0x00, 0x00)
        return true
    }

    // ── Presupuesto de tiempo (timing budget), como en Pololu ──
    function l0x_decodeTimeout(v: number): number {
        return ((v & 0x00FF) << ((v & 0xFF00) >> 8)) + 1
    }
    function l0x_encodeTimeout(mclks: number): number {
        let ls = 0, ms = 0
        if (mclks > 0) {
            ls = mclks - 1
            while ((ls & 0xFFFFFF00) > 0) { ls >>= 1; ms++ }
            return (ms << 8) | (ls & 0xFF)
        }
        return 0
    }
    function l0x_macroPeriodNs(vcselPclks: number): number {
        return Math.idiv((2304 * vcselPclks * 1655) + 500, 1000)
    }
    function l0x_mclksToUs(mclks: number, vcselPclks: number): number {
        return Math.idiv((mclks * l0x_macroPeriodNs(vcselPclks)) + 500, 1000)
    }
    function l0x_usToMclks(us: number, vcselPclks: number): number {
        const macro = l0x_macroPeriodNs(vcselPclks)
        return Math.idiv((us * 1000) + Math.idiv(macro, 2), macro)
    }
    function l0x_vcselPclks(reg: number): number {
        return (r8(reg) + 1) << 1
    }

    function l0x_setTimingBudget(budgetUs: number): boolean {
        const StartOverhead = 1910, EndOverhead = 960, MsrcOverhead = 660
        const TccOverhead = 590, DssOverhead = 690, PreRangeOverhead = 660, FinalRangeOverhead = 550
        if (budgetUs < 20000) return false
        let used = StartOverhead + EndOverhead

        const sc = r8(0x01)                        // SYSTEM_SEQUENCE_CONFIG
        const tcc = (sc >> 4) & 1, dss = (sc >> 3) & 1, msrc = (sc >> 2) & 1
        const preRange = (sc >> 6) & 1, finalRange = (sc >> 7) & 1

        const preVcsel = l0x_vcselPclks(0x50)
        const msrcMclks = r8(0x46) + 1
        const msrcUs = l0x_mclksToUs(msrcMclks, preVcsel)
        const preMclks = l0x_decodeTimeout(r8v16(0x51))
        const preUs = l0x_mclksToUs(preMclks, preVcsel)
        const finalVcsel = l0x_vcselPclks(0x70)

        if (tcc) used += msrcUs + TccOverhead
        if (dss) used += 2 * (msrcUs + DssOverhead)
        else if (msrc) used += msrcUs + MsrcOverhead
        if (preRange) used += preUs + PreRangeOverhead
        if (finalRange) {
            used += FinalRangeOverhead
            if (used > budgetUs) return false
            let finalMclks = l0x_usToMclks(budgetUs - used, finalVcsel)
            if (preRange) finalMclks += preMclks
            w8v16(0x71, l0x_encodeTimeout(finalMclks))   // FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI
        }
        return true
    }

    function vl53l0x_init(): boolean {
        // Verificar identidad del chip (IDENTIFICATION_MODEL_ID = 0xEE)
        if (r8(0xC0) != 0xEE) return false

        // ── DataInit ──
        w8(0x89, r8(0x89) | 0x01)                  // modo 2,8 V en SDA/SCL
        w8(0x88, 0x00)                             // I2C standard mode
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        _s.stopVar = r8(0x91)
        w8(0x00, 0x01); w8(0xFF, 0x00); w8(0x80, 0x00)
        w8(0x60, r8(0x60) | 0x12)                  // sin límites MSRC / PRE_RANGE
        w8v16(0x44, 0x0020)                        // límite de señal 0,25 MCPS
        w8(0x01, 0xFF)                             // SYSTEM_SEQUENCE_CONFIG

        // ── StaticInit: SPADs de referencia ──
        const spad = l0x_getSpadInfo()
        if (spad.length == 0) return false
        const spadCount = spad[0]
        const primerSpad = spad[1] ? 12 : 0        // 12 = primer SPAD de apertura
        const mapa = r8multi(0xB0, 6)              // GLOBAL_CONFIG_SPAD_ENABLES_REF_0..5
        let ref: number[] = [mapa[0], mapa[1], mapa[2], mapa[3], mapa[4], mapa[5]]
        w8(0xFF, 0x01)
        w8(0x4F, 0x00)                             // DYNAMIC_SPAD_REF_EN_START_OFFSET
        w8(0x4E, 0x2C)                             // DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD
        w8(0xFF, 0x00)
        w8(0xB6, 0xB4)                             // GLOBAL_CONFIG_REF_EN_START_SELECT
        let habilitados = 0
        for (let i = 0; i < 48; i++) {
            const byte = i >> 3, bit = i & 7
            if (i < primerSpad || habilitados == spadCount) {
                ref[byte] &= ~(1 << bit)
            } else if ((ref[byte] >> bit) & 1) {
                habilitados++
            }
        }
        w8multi(0xB0, ref)

        // ── StaticInit: "tuning settings" por defecto (vl53l0x_tuning.h) ──
        const tun = [
            0xFF, 0x01, 0x00, 0x00, 0xFF, 0x00, 0x09, 0x00, 0x10, 0x00, 0x11, 0x00,
            0x24, 0x01, 0x25, 0xFF, 0x75, 0x00, 0xFF, 0x01, 0x4E, 0x2C, 0x48, 0x00,
            0x30, 0x20, 0xFF, 0x00, 0x30, 0x09, 0x54, 0x00, 0x31, 0x04, 0x32, 0x03,
            0x40, 0x83, 0x46, 0x25, 0x60, 0x00, 0x27, 0x00, 0x50, 0x06, 0x51, 0x00,
            0x52, 0x96, 0x56, 0x08, 0x57, 0x30, 0x61, 0x00, 0x62, 0x00, 0x64, 0x00,
            0x65, 0x00, 0x66, 0xA0, 0xFF, 0x01, 0x22, 0x32, 0x47, 0x14, 0x49, 0xFF,
            0x4A, 0x00, 0xFF, 0x00, 0x7A, 0x0A, 0x7B, 0x00, 0x78, 0x21, 0xFF, 0x01,
            0x23, 0x34, 0x42, 0x00, 0x44, 0xFF, 0x45, 0x26, 0x46, 0x05, 0x40, 0x40,
            0x0E, 0x06, 0x20, 0x1A, 0x43, 0x40, 0xFF, 0x00, 0x34, 0x03, 0x35, 0x44,
            0xFF, 0x01, 0x31, 0x04, 0x4B, 0x09, 0x4C, 0x05, 0x4D, 0x04, 0xFF, 0x00,
            0x44, 0x00, 0x45, 0x20, 0x47, 0x08, 0x48, 0x28, 0x67, 0x00, 0x70, 0x04,
            0x71, 0x01, 0x72, 0xFE, 0x76, 0x00, 0x77, 0x00, 0xFF, 0x01, 0x0D, 0x01,
            0xFF, 0x00, 0x80, 0x01, 0x01, 0xF8, 0xFF, 0x01, 0x8E, 0x01, 0x00, 0x01,
            0xFF, 0x00, 0x80, 0x00
        ]
        for (let i = 0; i < tun.length; i += 2) w8(tun[i], tun[i + 1])

        // ── Interrupción "muestra lista" en GPIO1 (se lee por I2C) ──
        w8(0x0A, 0x04)                             // SYSTEM_INTERRUPT_CONFIG_GPIO
        w8(0x84, r8(0x84) & ~0x10)                 // GPIO_HV_MUX_ACTIVE_HIGH: activa en bajo
        w8(0x0B, 0x01)                             // SYSTEM_INTERRUPT_CLEAR

        // ── Secuencia sin MSRC ni TCC y presupuesto de tiempo ──
        w8(0x01, 0xE8)
        // Estable: 66 ms (más preciso). Rápida: 20 ms (más muestras por segundo).
        l0x_setTimingBudget(_s.rapido ? 20000 : 66000)

        // ── Calibraciones de referencia: VHV y fase ──
        w8(0x01, 0x01)
        if (!l0x_refCalibration(0x40)) return false
        w8(0x01, 0x02)
        if (!l0x_refCalibration(0x00)) return false
        w8(0x01, 0xE8)

        return true
    }

    function vl53l0x_read(): number {
        // Secuencia de inicio de medición single-shot
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        w8(0x91, _s.stopVar)
        w8(0x00, 0x01); w8(0xFF, 0x00); w8(0x80, 0x00)
        w8(0x00, 0x01)                             // SYSRANGE_START

        // Esperar a que se borre el bit de arranque
        let t = 0
        while (r8(0x00) & 0x01) {
            if (++t > 200) return -1
            basic.pause(1)
        }

        // Esperar "muestra lista" (RESULT_INTERRUPT_STATUS bits 0-2 ≠ 0)
        if (!poll_r8_nonzero(0x13, 0x07, 300)) return -1

        // Distancia en mm (RESULT_RANGE_STATUS + 10)
        const d = r8v16(0x1E)

        // Limpiar interrupción
        w8(0x0B, 0x01)

        // 8190/8191 = fuera de rango; 0 = sin medición
        if (d == 0 || d >= 8000) return -1
        return d
    }


    // =========================================================================
    // DRIVER: VL53L1X (TOF400C) — 4 a 400 cm
    // =========================================================================
    // Chip: VL53L1X, infrarrojo 940 nm, FOV 27°
    // Registros: direcciones de 16 bits
    // Referencia: ST VL53L1X Ultra Lite Driver (ULD): SensorInit,
    // SetDistanceMode(Long), SetTimingBudgetInMs, SetInterMeasurementInMs,
    // StartRanging, CheckForDataReady, GetDistance, GetRangeStatus.
    // =========================================================================

    function vl53l1x_init(): boolean {
        // Esperar el arranque del firmware (FIRMWARE__SYSTEM_STATUS bit 0)
        if (!poll_r16(0x00E5, 0x01, 0x01, 1000)) return false

        // Verificar identidad (MODEL_ID + MODULE_TYPE = 0xEACC)
        if (r16v16(0x010F) != 0xEACC) return false

        // ── Configuración por defecto del ST ULD: 91 bytes desde 0x002D ──
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
        let buf = pins.createBuffer(cfg.length + 2)
        buf[0] = 0x00
        buf[1] = 0x2D
        for (let i = 0; i < cfg.length; i++) buf[i + 2] = cfg[i]
        _b.write(buf)

        // ── Primera medición de arranque (como en VL53L1X_SensorInit) ──
        w16(0x0087, 0x40)                          // StartRanging
        if (!poll_r16(0x0031, 0x01, 0x01, 500)) return false
        w16(0x0086, 0x01)                          // ClearInterrupt
        w16(0x0087, 0x00)                          // StopRanging
        w16(0x0008, 0x09)                          // VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND
        w16(0x000B, 0x00)                          // arrancar VHV desde la temperatura previa

        // ── Modo de distancia largo (hasta 4 m) ──
        w16(0x004B, 0x0A)      // PHASECAL_CONFIG__TIMEOUT_MACROP
        w16(0x0060, 0x0F)      // RANGE_CONFIG__VCSEL_PERIOD_A
        w16(0x0063, 0x0D)      // RANGE_CONFIG__VCSEL_PERIOD_B
        w16(0x0069, 0xB8)      // RANGE_CONFIG__VALID_PHASE_HIGH
        w16v16(0x0078, 0x0F0D) // SD_CONFIG__WOI_SD0
        w16v16(0x007A, 0x0E0E) // SD_CONFIG__INITIAL_PHASE_SD0

        // ── Presupuesto de tiempo (valores del ULD para modo largo) ──
        // Estable: 50 ms. Rápida: 20 ms.
        if (_s.rapido) {
            w16v16(0x005E, 0x001E)  // RANGE_CONFIG__TIMEOUT_MACROP_A_HI
            w16v16(0x0061, 0x0022)  // RANGE_CONFIG__TIMEOUT_MACROP_B_HI
        } else {
            w16v16(0x005E, 0x01AD)
            w16v16(0x0061, 0x01E8)
        }

        // ── Período entre mediciones (≥ presupuesto + 4 ms) ──
        let clk = r16v16(0x00DE) & 0x3FF
        if (clk > 0) {
            let periodoMs = _s.rapido ? 25 : 55
            let val = Math.round(clk * periodoMs * 1.075)
            w16v32(0x006C, val)
        }

        // ── Medición continua ──
        w16(0x0087, 0x40)
        basic.pause(20)

        return true
    }

    function vl53l1x_read(): number {
        // Esperar datos listos (GPIO__TIO_HV_STATUS bit 0 = polaridad activa)
        if (!poll_r16(0x0031, 0x01, 0x01, 300)) return -1

        // Distancia en mm (RESULT__FINAL_CROSSTALK_CORRECTED_RANGE_MM_SD0)
        let d = r16v16(0x0096)

        // Estado del rango: el chip devuelve 9 cuando la medición es válida
        // (el ULD lo traduce a 0); 6 = sigma, 4 = señal, 7 = wraparound, ...
        let status = r16(0x0089) & 0x1F

        // Limpiar interrupción (habilita la siguiente medición)
        w16(0x0086, 0x01)

        if (status != 9) return -1
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
