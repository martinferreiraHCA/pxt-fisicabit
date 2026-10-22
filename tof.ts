// =============================================================================
//  tof.ts — ToF (Time-of-Flight) laser distance sensors over I2C
// =============================================================================
//  Project: FisicaBit.com
//  Supported modules (all with I2C address 0x29):
//    - TOF050C      (VL6180X chip) — 2 to 50 cm,   850 nm infrared, FOV 25°
//    - TOF200C      (VL53L0X chip) — 3 to 200 cm,  940 nm infrared, FOV 25°
//    - GY-VL53L0XV2 (VL53L0X chip) — 3 to 200 cm,  same as the TOF200C
//    - TOF400C      (VL53L1X chip) — 4 to 400 cm,  940 nm infrared, FOV 27°
//    - "auto-detect": reads the chip identity register and picks the driver
//
//  Power supply: 3 V – 5 V DC, 40 mA max.
//
//  PINS (micro:bit expansion kit / breakout):
//    1st sensor: SDA → P20 (labelled "SDA" or "20"), SCL → P19 ("SCL" or "19").
//                This is the hardware I2C bus: the fastest and the recommended one.
//    2nd sensor: SDA → P14, SCL → P13  (software I2C, see shims.cpp)
//    3rd sensor: SDA → P16, SCL → P15
//    Since the modules share the same address (0x29), using more than one
//    requires giving each its own pins. P13–P16 are free digital pins on
//    every kit (they do not touch the LED display or the buttons) and leave
//    P0–P2 free for analog sensors.
//
//  WIRING (same for all modules):
//    VCC → 3V · GND → GND · SDA → chosen SDA pin · SCL → chosen SCL pin
//
//  TYPICAL BLOCK USAGE (a single block, initializes itself):
//    forever:
//      [send to fisicabit.com time and
//         (ToF distance [TOF200C] SDA [P20] SCL [P19] in [cm]) every 50 ms]
//
//  PRECISION (C++ sampler, shims.cpp):
//    After initialization, readings are taken by a native sampler that polls
//    the sensor in the background and stores every sample with its timestamp
//    (µs of the system timer). With the module's INT/GPIO1 pin connected
//    (suggested: P8 / P12 / P1), the timestamp is that of the hardware
//    interrupt. The "send ToF distance ..." block sends every sample with
//    that time, at the sensor's actual rate. Hardware I2C bus at 400 kHz;
//    software bus with assembly delays (≈400 kHz).
// =============================================================================


/** Laser Time-of-Flight distance sensors (TOF050C, TOF200C, TOF400C, GY-VL53L0XV2) for physics experiments. */
//% weight=92
//% color=#1E90FF
//% icon="\uf140"
//% block="ToF laser"
//% groups='["Measurement", "Configuration", "Diagnostics"]'
namespace fisicabitToF {

    // =========================================================================
    // I2C bus: hardware (P20/P19) or software (any other pin pair)
    // =========================================================================
    const ADDR = 0x29

    //% shim=fisicabitNative::swi2cWrite
    function _swWrite(sda: number, scl: number, addr: number, b: Buffer): number {
        return 3   // simulator: no software bus
    }

    //% shim=fisicabitNative::swi2cRead
    function _swRead(sda: number, scl: number, addr: number, n: number): Buffer {
        return pins.createBuffer(0)
    }

    // ── Native sampler (shims.cpp): reads the sensor in the background with a
    //    hardware timestamp. It does not exist in the simulator (returns 0).
    //% shim=fisicabitNative::tofStart
    function _hwTofStart(idx: number, type: number, pins: number, intPin: number): number {
        return 0
    }
    //% shim=fisicabitNative::tofStop
    function _hwTofStop(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::tofSeq
    function _hwTofSeq(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::tofDist
    function _hwTofDist(idx: number): number {
        return -1
    }
    //% shim=fisicabitNative::tofTimeTenths
    function _hwTofTimeTenths(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::tofStats
    function _hwTofStats(idx: number, which: number): number {
        return 0
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
    // Sensor: one object per pin pair (allows several modules at once)
    // =========================================================================
    let _defaultFilter = 3
    let _defaultMode = 0            // 0 stable, 1 fast, 2 precise
    const MAX_SENSORS = 3           // sensors with a native sampler

    class Sensor {
        bus: Bus
        requestedModel: FbToFModel
        driver: number            // 0=VL6180X, 1=VL53L0X, 2=VL53L1X, -1=unknown
        ready: boolean
        filterN: number
        mode: number              // 0 stable, 1 fast, 2 precise
        idx: number               // index in the native sampler (-1 = none)
        intPin: number            // DigitalPin id of the INT pin or -1
        native: boolean           // true if the native sampler is active
        lastSeq: number           // last sample consumed from the sampler
        offsetMm: number          // offset correction (calibration)
        lastValue: number         // last valid value (fallback)
        lastOk: boolean           // was the last measurement valid?
        stopVar: number           // VL53L0X stop variable
        lastAttemptMs: number
        hist: number[]            // last valid readings (sliding median)
        constructor(sda: DigitalPin, scl: DigitalPin) {
            this.bus = new Bus(sda, scl)
            this.requestedModel = FbToFModel.TOF200C
            this.driver = -1
            this.ready = false
            this.filterN = _defaultFilter
            this.mode = _defaultMode
            this.idx = -1
            this.intPin = -1
            this.native = false
            this.lastSeq = 0
            this.offsetMm = 0
            this.lastValue = 0
            this.lastOk = false
            this.stopVar = 0
            this.lastAttemptMs = -100000
            this.hist = []
        }
    }

    let _sensors: Sensor[] = []
    let _s: Sensor = null      // active sensor (used by the drivers)
    let _b: Bus = null         // active bus

    function _get(sda: DigitalPin, scl: DigitalPin): Sensor {
        for (let i = 0; i < _sensors.length; i++) {
            const t = _sensors[i]
            if (t.bus.sda == sda && t.bus.scl == scl) return t
        }
        const created = new Sensor(sda, scl)
        created.idx = _sensors.length < MAX_SENSORS ? _sensors.length : -1
        _sensors.push(created)
        return created
    }

    function _default(): Sensor {
        return _get(DigitalPin.P20, DigitalPin.P19)
    }

    function _activate(s: Sensor): void {
        _s = s
        _b = s.bus
    }

    function _driverOf(model: FbToFModel): number {
        switch (model) {
            case FbToFModel.TOF050C: return 0
            case FbToFModel.TOF200C: return 1
            case FbToFModel.VL53L0XV2: return 1
            case FbToFModel.TOF400C: return 2
            default: return -1     // Auto
        }
    }

    // =========================================================================
    // I2C — 8-bit register addresses (VL53L0X)
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
    // I2C — 16-bit register addresses (VL6180X, VL53L1X)
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
    // Internal helpers
    // =========================================================================

    /** Polls a register with an 8-bit address. */
    function pollR8(reg: number, mask: number, val: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r8(reg) & mask) == val) return true
            basic.pause(1)
        }
        return false
    }

    /** Polls a register with a 16-bit address. */
    function pollR16(reg: number, mask: number, val: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r16(reg) & mask) == val) return true
            basic.pause(1)
        }
        return false
    }

    /** Insertion sort for small arrays (median). */
    function isort(a: number[], n: number): void {
        for (let i = 1; i < n; i++) {
            let k = a[i], j = i - 1
            while (j >= 0 && a[j] > k) { a[j + 1] = a[j]; j-- }
            a[j + 1] = k
        }
    }


    // =========================================================================
    // DRIVER: VL6180X (TOF050C) — 0 to 50 cm
    // =========================================================================
    // Chip: VL6180, 850 nm infrared, FOV 25°
    // Dead zone: 0–2 cm
    // Registers: 16-bit addresses, 8-bit data
    // Reference: ST Application Note AN4545
    // =========================================================================

    function vl6180xInit(): boolean {
        // Check the chip identity (MODEL_ID = 0xB4)
        if (r16(0x0000) != 0xB4) return false

        // ── Mandatory private registers (AN4545) ──
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

        // ── Recommended public configuration ──
        w16(0x0011, 0x10)  // GPIO1 = sample ready
        w16(0x010A, 0x30)  // Averaging period
        w16(0x003F, 0x46)  // Gain
        w16(0x0031, 0xFF)  // Auto-calibration every N measurements
        w16(0x002E, 0x01)  // Temperature calibration

        // ── Range configuration ──
        // Inter-measurement period in continuous mode (10 ms steps):
        // stable 50 ms (≈20 Hz), fast 30 ms (≈33 Hz)
        w16(0x001B, _s.mode == 1 ? 0x02 : (_s.mode == 2 ? 0x09 : 0x04))
        w16(0x003E, 0x31)  // VHV repeat rate
        w16(0x0014, 0x24)  // VHV recalibration
        // Maximum convergence time: 50 ms stable, 24 ms fast
        w16(0x001C, _s.mode == 1 ? 0x18 : 0x31)

        // Mark as initialized
        w16(0x0016, 0x00)

        // Continuous measurement: the sensor measures on its own and every read takes the latest
        w16(0x0018, 0x03)
        return true
    }

    function vl6180xRead(): number {
        // Wait for the next continuous-mode sample
        // (RESULT__INTERRUPT_STATUS_GPIO bits 0-2 = 4: sample ready)
        if (!pollR16(0x004F, 0x07, 0x04, 150)) return -1

        // Read distance in mm
        let d = r16(0x0062)

        // Clear interrupt
        w16(0x0015, 0x07)

        // Check status (0=OK, 11=early convergence but valid)
        let status = r16(0x004D) >> 4
        if (status != 0 && status != 11) return -1
        if (d >= 255) return -1

        return d
    }


    // =========================================================================
    // DRIVER: VL53L0X (TOF200C, GY-VL53L0XV2) — 3 to 200 cm
    // =========================================================================
    // Chip: VL53L0X, 940 nm infrared, FOV 25°
    // Registers: 8-bit addresses
    // Reference: ST VL53L0X API (DataInit + StaticInit + PerformRefCalibration)
    // in the form of the Pololu VL53L0X library, which is the minimal proven
    // implementation: reference SPADs, "tuning settings", sample-ready
    // interrupt, timing budget and VHV / phase calibrations.
    // =========================================================================

    /** Reads N consecutive bytes starting at an 8-bit register. */
    function r8multi(reg: number, n: number): Buffer {
        let b = pins.createBuffer(1)
        b[0] = reg
        _b.write(b)
        return _b.read(n)
    }

    /** Writes N consecutive bytes starting at an 8-bit register. */
    function w8multi(reg: number, data: number[]): void {
        let b = pins.createBuffer(data.length + 1)
        b[0] = reg
        for (let i = 0; i < data.length; i++) b[i + 1] = data[i] & 0xFF
        _b.write(b)
    }

    /** Waits until (reg & mask) != 0. */
    function pollR8Nonzero(reg: number, mask: number, ms: number): boolean {
        for (let i = 0; i < ms; i++) {
            if ((r8(reg) & mask) != 0) return true
            basic.pause(1)
        }
        return false
    }

    function l0xGetSpadInfo(): number[] {
        // Returns [count, isAperture] or [] on failure
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        w8(0xFF, 0x06)
        w8(0x83, r8(0x83) | 0x04)
        w8(0xFF, 0x07)
        w8(0x81, 0x01)
        w8(0x80, 0x01)
        w8(0x94, 0x6B)
        w8(0x83, 0x00)
        if (!pollR8Nonzero(0x83, 0xFF, 200)) return []
        w8(0x83, 0x01)
        const tmp = r8(0x92)
        const count = tmp & 0x7F
        const aperture = (tmp >> 7) & 0x01
        w8(0x81, 0x00)
        w8(0xFF, 0x06)
        w8(0x83, r8(0x83) & ~0x04)
        w8(0xFF, 0x01)
        w8(0x00, 0x01)
        w8(0xFF, 0x00)
        w8(0x80, 0x00)
        return [count, aperture]
    }

    function l0xRefCalibration(vhvInitByte: number): boolean {
        w8(0x00, 0x01 | vhvInitByte)               // SYSRANGE_START
        if (!pollR8Nonzero(0x13, 0x07, 500)) return false
        w8(0x0B, 0x01)                             // SYSTEM_INTERRUPT_CLEAR
        w8(0x00, 0x00)
        return true
    }

    // ── Timing budget, as in Pololu ──
    function l0xDecodeTimeout(v: number): number {
        return ((v & 0x00FF) << ((v & 0xFF00) >> 8)) + 1
    }
    function l0xEncodeTimeout(mclks: number): number {
        let ls = 0, ms = 0
        if (mclks > 0) {
            ls = mclks - 1
            while ((ls & 0xFFFFFF00) > 0) { ls >>= 1; ms++ }
            return (ms << 8) | (ls & 0xFF)
        }
        return 0
    }
    function l0xMacroPeriodNs(vcselPclks: number): number {
        return Math.idiv((2304 * vcselPclks * 1655) + 500, 1000)
    }
    function l0xMclksToUs(mclks: number, vcselPclks: number): number {
        return Math.idiv((mclks * l0xMacroPeriodNs(vcselPclks)) + 500, 1000)
    }
    function l0xUsToMclks(us: number, vcselPclks: number): number {
        const macro = l0xMacroPeriodNs(vcselPclks)
        return Math.idiv((us * 1000) + Math.idiv(macro, 2), macro)
    }
    function l0xVcselPclks(reg: number): number {
        return (r8(reg) + 1) << 1
    }

    function l0xSetTimingBudget(budgetUs: number): boolean {
        const StartOverhead = 1910, EndOverhead = 960, MsrcOverhead = 660
        const TccOverhead = 590, DssOverhead = 690, PreRangeOverhead = 660, FinalRangeOverhead = 550
        if (budgetUs < 20000) return false
        let used = StartOverhead + EndOverhead

        const sc = r8(0x01)                        // SYSTEM_SEQUENCE_CONFIG
        const tcc = (sc >> 4) & 1, dss = (sc >> 3) & 1, msrc = (sc >> 2) & 1
        const preRange = (sc >> 6) & 1, finalRange = (sc >> 7) & 1

        const preVcsel = l0xVcselPclks(0x50)
        const msrcMclks = r8(0x46) + 1
        const msrcUs = l0xMclksToUs(msrcMclks, preVcsel)
        const preMclks = l0xDecodeTimeout(r8v16(0x51))
        const preUs = l0xMclksToUs(preMclks, preVcsel)
        const finalVcsel = l0xVcselPclks(0x70)

        if (tcc) used += msrcUs + TccOverhead
        if (dss) used += 2 * (msrcUs + DssOverhead)
        else if (msrc) used += msrcUs + MsrcOverhead
        if (preRange) used += preUs + PreRangeOverhead
        if (finalRange) {
            used += FinalRangeOverhead
            if (used > budgetUs) return false
            let finalMclks = l0xUsToMclks(budgetUs - used, finalVcsel)
            if (preRange) finalMclks += preMclks
            w8v16(0x71, l0xEncodeTimeout(finalMclks))   // FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI
        }
        return true
    }

    function vl53l0xInit(): boolean {
        // Check the chip identity (IDENTIFICATION_MODEL_ID = 0xEE)
        if (r8(0xC0) != 0xEE) return false

        // ── DataInit ──
        w8(0x89, r8(0x89) | 0x01)                  // 2.8 V mode on SDA/SCL
        w8(0x88, 0x00)                             // I2C standard mode
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        _s.stopVar = r8(0x91)
        w8(0x00, 0x01); w8(0xFF, 0x00); w8(0x80, 0x00)
        w8(0x60, r8(0x60) | 0x12)                  // no MSRC / PRE_RANGE limit checks
        w8v16(0x44, 0x0020)                        // signal rate limit 0.25 MCPS
        w8(0x01, 0xFF)                             // SYSTEM_SEQUENCE_CONFIG

        // ── StaticInit: reference SPADs ──
        const spad = l0xGetSpadInfo()
        if (spad.length == 0) return false
        const spadCount = spad[0]
        const firstSpad = spad[1] ? 12 : 0         // 12 = first aperture SPAD
        const spadMap = r8multi(0xB0, 6)           // GLOBAL_CONFIG_SPAD_ENABLES_REF_0..5
        let ref: number[] = [spadMap[0], spadMap[1], spadMap[2], spadMap[3], spadMap[4], spadMap[5]]
        w8(0xFF, 0x01)
        w8(0x4F, 0x00)                             // DYNAMIC_SPAD_REF_EN_START_OFFSET
        w8(0x4E, 0x2C)                             // DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD
        w8(0xFF, 0x00)
        w8(0xB6, 0xB4)                             // GLOBAL_CONFIG_REF_EN_START_SELECT
        let enabled = 0
        for (let i = 0; i < 48; i++) {
            const byte = i >> 3, bit = i & 7
            if (i < firstSpad || enabled == spadCount) {
                ref[byte] &= ~(1 << bit)
            } else if ((ref[byte] >> bit) & 1) {
                enabled++
            }
        }
        w8multi(0xB0, ref)

        // ── StaticInit: default "tuning settings" (vl53l0x_tuning.h) ──
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

        // ── "Sample ready" interrupt on GPIO1 (read over I2C) ──
        w8(0x0A, 0x04)                             // SYSTEM_INTERRUPT_CONFIG_GPIO
        w8(0x84, r8(0x84) & ~0x10)                 // GPIO_HV_MUX_ACTIVE_HIGH: active low
        w8(0x0B, 0x01)                             // SYSTEM_INTERRUPT_CLEAR

        // ── Sequence without MSRC or TCC, and timing budget ──
        w8(0x01, 0xE8)
        // Stable: 33 ms (ST default mode, ≈30 Hz). Fast: 20 ms (≈50 Hz).
        // Precise: 100 ms (≈10 Hz, the lowest noise).
        l0xSetTimingBudget(_s.mode == 1 ? 20000 : (_s.mode == 2 ? 100000 : 33000))

        // ── Reference calibrations: VHV and phase ──
        w8(0x01, 0x01)
        if (!l0xRefCalibration(0x40)) return false
        w8(0x01, 0x02)
        if (!l0xRefCalibration(0x00)) return false
        w8(0x01, 0xE8)

        // ── Continuous "back-to-back" measurement: the sensor measures
        //    non-stop and every read takes the latest sample (maximum rate) ──
        w8(0x80, 0x01); w8(0xFF, 0x01); w8(0x00, 0x00)
        w8(0x91, _s.stopVar)
        w8(0x00, 0x01); w8(0xFF, 0x00); w8(0x80, 0x00)
        w8(0x00, 0x02)                             // SYSRANGE_START back-to-back

        return true
    }

    function vl53l0xRead(): number {
        // Wait for "sample ready" in continuous mode (RESULT_INTERRUPT_STATUS ≠ 0)
        if (!pollR8Nonzero(0x13, 0x07, 150)) return -1

        // Distance in mm (RESULT_RANGE_STATUS + 10)
        const d = r8v16(0x1E)

        // Clear interrupt (releases the next sample)
        w8(0x0B, 0x01)

        // 8190/8191 = out of range; 0 = no measurement
        if (d == 0 || d >= 8000) return -1
        return d
    }


    // =========================================================================
    // DRIVER: VL53L1X (TOF400C) — 4 to 400 cm
    // =========================================================================
    // Chip: VL53L1X, 940 nm infrared, FOV 27°
    // Registers: 16-bit addresses
    // Reference: ST VL53L1X Ultra Lite Driver (ULD): SensorInit,
    // SetDistanceMode(Long), SetTimingBudgetInMs, SetInterMeasurementInMs,
    // StartRanging, CheckForDataReady, GetDistance, GetRangeStatus.
    // =========================================================================

    function vl53l1xInit(): boolean {
        // Wait for the firmware to boot (FIRMWARE__SYSTEM_STATUS bit 0)
        if (!pollR16(0x00E5, 0x01, 0x01, 1000)) return false

        // Check identity (MODEL_ID + MODULE_TYPE = 0xEACC)
        if (r16v16(0x010F) != 0xEACC) return false

        // ── ST ULD default configuration: 91 bytes starting at 0x002D ──
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

        // ── First boot measurement (as in VL53L1X_SensorInit) ──
        w16(0x0087, 0x40)                          // StartRanging
        if (!pollR16(0x0031, 0x01, 0x01, 500)) return false
        w16(0x0086, 0x01)                          // ClearInterrupt
        w16(0x0087, 0x00)                          // StopRanging
        w16(0x0008, 0x09)                          // VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND
        w16(0x000B, 0x00)                          // start VHV from the previous temperature

        if (_s.mode == 1) {
            // ── Fast: short mode (up to 1.3 m), 20 ms (≈40 Hz) ──
            w16(0x004B, 0x14)      // PHASECAL_CONFIG__TIMEOUT_MACROP
            w16(0x0060, 0x07)      // RANGE_CONFIG__VCSEL_PERIOD_A
            w16(0x0063, 0x05)      // RANGE_CONFIG__VCSEL_PERIOD_B
            w16(0x0069, 0x38)      // RANGE_CONFIG__VALID_PHASE_HIGH
            w16v16(0x0078, 0x0705) // SD_CONFIG__WOI_SD0
            w16v16(0x007A, 0x0606) // SD_CONFIG__INITIAL_PHASE_SD0
            w16v16(0x005E, 0x001D) // RANGE_CONFIG__TIMEOUT_MACROP_A_HI (20 ms, short mode)
            w16v16(0x0061, 0x0022) // RANGE_CONFIG__TIMEOUT_MACROP_B_HI
        } else {
            // ── Stable: long mode (up to 4 m), 33 ms (≈26 Hz) ──
            w16(0x004B, 0x0A)
            w16(0x0060, 0x0F)
            w16(0x0063, 0x0D)
            w16(0x0069, 0xB8)
            w16v16(0x0078, 0x0F0D)
            w16v16(0x007A, 0x0E0E)
            if (_s.mode == 2) {
                w16v16(0x005E, 0x02E1) // 100 ms, long mode (precise)
                w16v16(0x0061, 0x0388)
            } else {
                w16v16(0x005E, 0x0060) // 33 ms, long mode
                w16v16(0x0061, 0x006E)
            }
        }

        // ── Inter-measurement period (≥ budget + 4 ms) ──
        let clk = r16v16(0x00DE) & 0x3FF
        if (clk > 0) {
            let periodMs = _s.mode == 1 ? 24 : (_s.mode == 2 ? 105 : 38)
            let val = Math.round(clk * periodMs * 1.075)
            w16v32(0x006C, val)
        }

        // ── Continuous measurement ──
        w16(0x0087, 0x40)
        basic.pause(20)

        return true
    }

    function vl53l1xRead(): number {
        // Wait for data ready (GPIO__TIO_HV_STATUS bit 0 = active polarity)
        if (!pollR16(0x0031, 0x01, 0x01, 300)) return -1

        // Distance in mm (RESULT__FINAL_CROSSTALK_CORRECTED_RANGE_MM_SD0)
        let d = r16v16(0x0096)

        // Range status: the chip returns 9 when the measurement is valid
        // (the ULD translates it to 0); 6 = sigma, 4 = signal, 7 = wraparound, ...
        let status = r16(0x0089) & 0x1F

        // Clear interrupt (enables the next measurement)
        w16(0x0086, 0x01)

        if (status != 9) return -1
        if (d == 0) return -1

        return d
    }


    // =========================================================================
    // Internal dispatcher — routes to the right driver
    // =========================================================================

    /** Detects the chip by reading its identity register (active bus). */
    function _detect(): number {
        if (r16(0x0000) == 0xB4 && _b.ok) return 0          // VL6180X
        if (r16v16(0x010F) == 0xEACC && _b.ok) return 2      // VL53L1X
        if (r8(0xC0) == 0xEE && _b.ok) return 1              // VL53L0X
        return -1
    }

    function _doInit(s: Sensor): boolean {
        if (s.idx >= 0) _hwTofStop(s.idx)        // pause the sampler while configuring
        s.native = false
        _activate(s)
        s.bus.ok = true
        s.driver = _driverOf(s.requestedModel)
        if (s.driver < 0) s.driver = _detect()
        if (s.driver < 0) return false
        let ok = false
        switch (s.driver) {
            case 0: ok = vl6180xInit(); break
            case 1: ok = vl53l0xInit(); break
            case 2: ok = vl53l1xInit(); break
        }
        ok = ok && s.bus.ok
        if (ok && s.idx >= 0) {
            // Delegate the readings to the C++ sampler (real timestamp)
            // Packed pins: native functions accept at most 4 parameters
            s.native = _hwTofStart(s.idx, s.driver, (s.bus.sda << 16) | s.bus.scl, s.intPin) == 1
            s.lastSeq = 0
        }
        return ok
    }

    function _doRead(s: Sensor): number {
        if (!s.ready) return -1
        if (s.native) {
            const seq = _hwTofSeq(s.idx)
            if (seq == s.lastSeq) return -2       // no new sample yet
            s.lastSeq = seq
            return _hwTofDist(s.idx)
        }
        _activate(s)
        let d = -1
        switch (s.driver) {
            case 0: d = vl6180xRead(); break
            case 1: d = vl53l0xRead(); break
            case 2: d = vl53l1xRead(); break
        }
        return s.bus.ok ? d : -1
    }

    /**
     * Takes ONE new reading and returns the median of the last N valid
     * readings (sliding median): removes spurious spikes without lowering
     * the sampling rate (it only adds a delay of N/2 samples).
     */
    function _readFiltered(s: Sensor): number {
        if (!s.ready) return 0

        const n = s.filterN
        let d = _doRead(s)
        if (d == -2) return s.lastValue          // no new sample: repeat the last one
        if (d < 0) {
            s.lastOk = false
            return s.lastValue
        }
        s.lastOk = true
        d += s.offsetMm
        if (d < 0) d = 0

        if (n <= 1) {
            s.lastValue = d
            return d
        }

        s.hist.push(d)
        while (s.hist.length > n) s.hist.shift()

        // Copy, sort and take the middle one
        let copy: number[] = []
        for (let i = 0; i < s.hist.length; i++) copy.push(s.hist[i])
        isort(copy, copy.length)
        s.lastValue = copy[Math.idiv(copy.length, 2)]
        return s.lastValue
    }

    /** Initializes if needed, retrying at most once per second. */
    function _ensure(s: Sensor): boolean {
        if (s.ready) return true
        const now = control.millis()
        if (now - s.lastAttemptMs < 1000) return false
        s.lastAttemptMs = now
        s.ready = _doInit(s)
        if (!s.ready) s.lastOk = false
        return s.ready
    }

    function _convert(mm: number, unit: FbDistanceUnit): number {
        switch (unit) {
            case FbDistanceUnit.Millimeters: return mm
            case FbDistanceUnit.Inches: return Math.round(mm / 25.4 * 100) / 100
            case FbDistanceUnit.Meters: return Math.round(mm) / 1000      // m with 3 decimals
            default: return Math.round(mm) / 10          // cm with 1 decimal
        }
    }

    function _driverName(d: number): string {
        switch (d) {
            case 0: return "TOF050C (VL6180X)"
            case 1: return "TOF200C / GY-VL53L0XV2 (VL53L0X)"
            case 2: return "TOF400C (VL53L1X)"
            default: return "none"
        }
    }

    // =========================================================================
    // PUBLIC BLOCKS — Single-block measurement
    // =========================================================================

    /**
     * Measures the distance with a ToF laser module in ONE block: choose the
     * module, say which pins it is connected to and the unit. It initializes
     * itself the first time (and retries if the sensor does not respond);
     * it uses a median filter and, if a measurement fails, returns the last
     * valid one.
     *
     * Suggested pins on a micro:bit expansion kit:
     *   1st sensor: SDA P20 (pin "SDA"/"20") and SCL P19 ("SCL"/"19") =
     *               hardware I2C bus, the fastest. VCC → 3V, GND → GND.
     *   2nd sensor: SDA P14 and SCL P13 · 3rd sensor: SDA P16 and SCL P15
     *               (the modules share address 0x29, so every extra sensor
     *               needs its own pin pair).
     *
     * Example (uniform motion on a rail): [forever] → [send to fisicabit.com
     * time and (ToF distance [TOF200C] SDA [P20] SCL [P19] in [cm]) every 50 ms]
     * @param model Connected module (or auto-detect)
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     * @param unit Unit: cm (1 decimal), mm or inches
     */
    //% block="ToF distance %model SDA %sda SCL %scl in %unit"
    //% blockId=fisicabit_tof_distancia
    //% parts="tof" trackArgs=1,2
    //% group="Measurement"
    //% weight=100
    //% inlineInputMode=inline
    //% model.defl=FbToFModel.TOF200C
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    //% unit.defl=FbDistanceUnit.Centimeters
    export function tofDistance(model: FbToFModel, sda: DigitalPin, scl: DigitalPin, unit: FbDistanceUnit): number {
        const s = _get(sda, scl)
        if (s.requestedModel != model) {
            s.requestedModel = model
            s.ready = false
            s.lastAttemptMs = -100000
        }
        if (!_ensure(s)) return _convert(s.lastValue, unit)
        return _convert(_readFiltered(s), unit)
    }

    /**
     * Waits for the sensor's next sample (up to maxMs) and returns true if it
     * arrived. Only with the native sampler; otherwise returns true at once.
     */
    function _waitSample(s: Sensor, maxMs: number): boolean {
        if (!s.native) return true
        let waited = 0
        while (_hwTofSeq(s.idx) == s.lastSeq) {
            if (waited >= maxMs) return false
            basic.pause(1)
            waited++
        }
        return true
    }

    function _decimalsOf(unit: FbDistanceUnit): number {
        if (unit == FbDistanceUnit.Millimeters) return 0
        if (unit == FbDistanceUnit.Inches) return 2
        if (unit == FbDistanceUnit.Meters) return 3
        return 1
    }

    /**
     * Sends to fisicabit.com every new sensor sample with the exact instant
     * at which the sensor measured it (not the send time): one
     * "time,distance" line per sample, at the sensor's actual rate
     * (≈30 Hz stable, ≈50 Hz fast, ≈10 Hz precise). With the INT pin
     * connected the time is that of the hardware interrupt (µs).
     * Put it inside "forever"; no "every ... ms" is needed.
     *
     * Example (uniform motion on a rail, over USB): [forever] → [send ToF
     * distance [TOF200C] SDA [P20] SCL [P19] in [cm] via [USB]]
     * @param model Connected module (or auto-detect)
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     * @param unit Unit: cm (1 decimal), mm or inches
     * @param channel USB or Bluetooth
     */
    //% block="send ToF distance %model SDA %sda SCL %scl in %unit via %channel"
    //% blockId=fisicabit_tof_enviar
    //% parts="tof" trackArgs=1,2
    //% group="Measurement"
    //% weight=98
    //% inlineInputMode=inline
    //% model.defl=FbToFModel.TOF200C
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    //% unit.defl=FbDistanceUnit.Centimeters
    //% channel.defl=FbChannel.USB
    export function tofSendDistance(model: FbToFModel, sda: DigitalPin, scl: DigitalPin, unit: FbDistanceUnit, channel: FbChannel): void {
        const s = _get(sda, scl)
        if (s.requestedModel != model) {
            s.requestedModel = model
            s.ready = false
            s.lastAttemptMs = -100000
        }
        if (!_ensure(s)) {
            basic.pause(100)
            return
        }
        if (!_waitSample(s, 500)) return
        const mm = _readFiltered(s)
        // Sample time in the fisicabit.com time base
        let tMs: number
        const baseMs = control.millis() - fisicabitData.channelTime(channel)
        if (s.native) tMs = _hwTofTimeTenths(s.idx) / 10 - baseMs
        else tMs = control.millis() - baseMs
        if (tMs < 0) tMs = 0
        const line = fisicabitData.format(tMs, 1) + "," + fisicabitData.format(_convert(mm, unit), _decimalsOf(unit))
        fisicabitData.channelSendText(channel, line)
    }

    /**
     * Precision start: besides SDA and SCL, connect the module's INT (GPIO1)
     * pin to a micro:bit pin. Every sample then carries the exact instant at
     * which the sensor finished measuring, captured by a hardware interrupt
     * (microsecond precision) instead of by polling (±1-6 ms).
     * Suggested INT pins: sensor 1 → P8, sensor 2 → P12, sensor 3 → P1.
     * Put it in "on start"; then use "ToF distance" or "send ToF distance"
     * with the same pins.
     * @param model Connected module (or auto-detect)
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     * @param intPin Pin connected to the module's INT / GPIO1
     */
    //% block="start precision ToF %model SDA %sda SCL %scl INT %intPin"
    //% blockId=fisicabit_tof_iniciar_precision
    //% parts="tof" trackArgs=1,2
    //% group="Configuration"
    //% weight=100
    //% inlineInputMode=inline
    //% model.defl=FbToFModel.TOF200C
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    //% intPin.defl=DigitalPin.P8
    export function tofStartPrecision(model: FbToFModel, sda: DigitalPin, scl: DigitalPin, intPin: DigitalPin): void {
        const s = _get(sda, scl)
        s.requestedModel = model
        s.intPin = intPin
        s.ready = false
        s.lastAttemptMs = -100000
        _ensure(s)
    }

    /**
     * Calibrates the sensor offset: place a flat object at a known distance
     * (for example 100 mm measured with a ruler), run the block and the
     * extension corrects all following readings. Removes the chip's zero
     * error and the shift caused by glass or an enclosure. Takes ~1 s.
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     * @param distanceMm Actual distance to the object in mm
     */
    //% block="calibrate ToF SDA %sda SCL %scl with target at %distanceMm mm"
    //% blockId=fisicabit_tof_calibrar_offset
    //% parts="tof" trackArgs=0,1
    //% group="Configuration"
    //% weight=93
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    //% distanceMm.min=20 distanceMm.max=2000 distanceMm.defl=100
    export function tofCalibrateOffset(sda: DigitalPin, scl: DigitalPin, distanceMm: number): void {
        const s = _get(sda, scl)
        if (!_ensure(s)) return
        const previousOffset = s.offsetMm
        s.offsetMm = 0
        let sum = 0, n = 0
        for (let i = 0; i < 40 && n < 20; i++) {
            if (!_waitSample(s, 300)) break
            const d = _doRead(s)
            if (d >= 0) { sum += d; n++ }
            if (!s.native) basic.pause(30)
        }
        if (n >= 5) {
            s.offsetMm = Math.round(distanceMm - sum / n)
            s.hist = []
            basic.showIcon(IconNames.Yes)
        } else {
            s.offsetMm = previousOffset
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Instant (ms since power-on, 1 decimal) at which the sensor measured the
     * last sample. With an INT pin: time of the hardware interrupt.
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     */
    //% block="ToF last sample time (ms) SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_tiempo_muestra
    //% parts="tof" trackArgs=0,1
    //% group="Diagnostics"
    //% weight=79
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofSampleTime(sda: DigitalPin, scl: DigitalPin): number {
        const s = _get(sda, scl)
        if (!s.native) return control.millis()
        return _hwTofTimeTenths(s.idx) / 10
    }

    /**
     * Actual sampling rate of the sensor (Hz), measured over 1 second.
     * Useful to verify the mode: ≈30 Hz stable, ≈50 Hz fast, ≈10 Hz precise.
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     */
    //% block="ToF actual sampling rate (Hz) SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_hz
    //% parts="tof" trackArgs=0,1
    //% group="Diagnostics"
    //% weight=78
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofActualSampleRate(sda: DigitalPin, scl: DigitalPin): number {
        const s = _get(sda, scl)
        if (!_ensure(s) || !s.native) return 0
        const before = _hwTofStats(s.idx, 0) + _hwTofStats(s.idx, 1)
        basic.pause(1000)
        return _hwTofStats(s.idx, 0) + _hwTofStats(s.idx, 1) - before
    }

    /**
     * Suggested pins for sensor number 1, 2 or 3 on a micro:bit expansion
     * kit, as text (for example "SDA P20 SCL P19"). Show it on the display
     * or send it over USB to know where to wire.
     * @param number Sensor number (1 = hardware bus P20/P19)
     */
    //% block="suggested ToF pins for sensor number %number"
    //% blockId=fisicabit_tof_pines
    //% group="Measurement"
    //% weight=95
    //% number.min=1 number.max=3 number.defl=1
    export function tofSuggestedPins(number: number): string {
        if (number <= 1) return "SDA P20 SCL P19"
        if (number == 2) return "SDA P14 SCL P13"
        return "SDA P16 SCL P15"
    }

    /**
     * Module detected on the given pins, by reading the chip identity:
     * "TOF050C (VL6180X)", "TOF200C / GY-VL53L0XV2 (VL53L0X)",
     * "TOF400C (VL53L1X)" or "none" if nothing responds (check VCC, GND and
     * that SDA/SCL are not swapped).
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     */
    //% block="ToF module detected SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_detectado
    //% parts="tof" trackArgs=0,1
    //% group="Diagnostics"
    //% weight=82
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofDetectedModule(sda: DigitalPin, scl: DigitalPin): string {
        const s = _get(sda, scl)
        _activate(s)
        s.bus.ok = true
        return _driverName(_detect())
    }

    /**
     * True if a ToF module is responding on the given pins.
     * @param sda Pin connected to the module's SDA
     * @param scl Pin connected to the module's SCL
     */
    //% block="ToF sensor found? SDA %sda SCL %scl"
    //% blockId=fisicabit_tof_hay
    //% parts="tof" trackArgs=0,1
    //% group="Diagnostics"
    //% weight=81
    //% sda.defl=DigitalPin.P20
    //% scl.defl=DigitalPin.P19
    export function tofSensorFound(sda: DigitalPin, scl: DigitalPin): boolean {
        const s = _get(sda, scl)
        _activate(s)
        s.bus.ok = true
        return _detect() >= 0
    }


    // =========================================================================
    // PUBLIC BLOCKS — Setup
    // =========================================================================

    /**
     * (Classic mode, sensor on P20/P19) Selects the ToF module you are going
     * to use. Call it BEFORE initializing. Not needed with the one-step
     * "ToF distance ..." block.
     *
     * @param model The module connected to the micro:bit
     */
    //% block="select ToF module %model"
    //% blockId=fisicabit_tof_seleccionar
    //% group="Configuration"
    //% weight=100
    //% model.defl=FbToFModel.TOF200C
    export function tofSelectModule(model: FbToFModel): void {
        const s = _default()
        s.requestedModel = model
        s.ready = false
    }

    /**
     * Initializes the selected ToF sensor.
     * Detects the chip, configures it and leaves it ready to measure.
     * Shows ✓ on the LEDs on success, ✗ on failure.
     *
     * Physical ToF connection (TOF050C/200C/400C) → micro:bit:
     *   VCC → 3V
     *   GND → GND
     *   SDA → P20 (SDA)
     *   SCL → P19 (SCL)
     */
    //% block="initialize ToF sensor (I2C: SDA P20 SCL P19)"
    //% blockId=fisicabit_tof_inicializar
    //% group="Configuration"
    //% weight=99
    export function tofInit(): void {
        const s = _default()
        s.ready = _doInit(s)
        s.lastValue = 0
        s.lastOk = false
        if (s.ready) {
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Sets the smoothing: median of the last 3, 5 or 7 readings. It does not
     * lower the sampling rate, but adds a delay of 1, 2 or 3 samples.
     *
     * For slow uniform motion: low or medium
     * For free fall or collisions: none or low
     *
     * @param filter Smoothing strength
     */
    //% block="set ToF smoothing %filter"
    //% blockId=fisicabit_tof_suavizado
    //% group="Configuration"
    //% weight=95
    //% filter.defl=FbToFFilter.Low
    export function tofSetSmoothing(filter: FbToFFilter): void {
        _defaultFilter = filter
        for (let i = 0; i < _sensors.length; i++) {
            _sensors[i].filterN = filter
            _sensors[i].hist = []
        }
    }

    /**
     * Changes the measurement mode.
     * Stable: ≈20–30 readings per second with the module's full range.
     * Fast: ≈33–50 readings per second; on the TOF400C the range drops to 1.3 m.
     *
     * If the sensor is already started, it is re-initialized automatically.
     *
     * @param mode Measurement mode
     */
    //% block="set ToF mode %mode"
    //% blockId=fisicabit_tof_modo
    //% group="Configuration"
    //% weight=94
    //% mode.defl=FbToFMode.Stable
    export function tofSetMode(mode: FbToFMode): void {
        _defaultMode = mode
        for (let i = 0; i < _sensors.length; i++) {
            const s = _sensors[i]
            s.mode = _defaultMode
            if (s.ready) s.ready = _doInit(s)
        }
    }


    // =========================================================================
    // PUBLIC BLOCKS — Measurement
    // =========================================================================

    /**
     * (Classic mode, sensor on P20/P19) Measures the distance in millimeters.
     * Includes a median filter to remove spurious spikes. If not initialized
     * yet, it does so itself with the selected module.
     */
    //% block="ToF distance (mm)"
    //% blockId=fisicabit_tof_mm
    //% group="Measurement"
    //% weight=90
    export function tofDistanceMm(): number {
        const s = _default()
        if (!_ensure(s)) return s.lastValue
        return _readFiltered(s)
    }

    /**
     * (Classic mode, sensor on P20/P19) Measures the distance in centimeters
     * (integer). Useful to show on the LED display or for simple calculations.
     */
    //% block="ToF distance (cm)"
    //% blockId=fisicabit_tof_cm
    //% group="Measurement"
    //% weight=89
    export function tofDistanceCm(): number {
        const s = _default()
        if (!_ensure(s)) return Math.idiv(s.lastValue, 10)
        return Math.idiv(_readFiltered(s), 10)
    }

    /**
     * Tells whether the last measurement was valid.
     * Returns false if the sensor did not respond, the object is
     * out of range, or there was a communication error.
     */
    //% block="ToF measurement valid"
    //% blockId=fisicabit_tof_valida
    //% group="Measurement"
    //% weight=85
    export function tofMeasurementValid(): boolean {
        let ok = false
        for (let i = 0; i < _sensors.length; i++) if (_sensors[i].lastOk) ok = true
        return ok
    }


    // =========================================================================
    // PUBLIC BLOCKS — Advanced
    // =========================================================================

    /**
     * Tells whether the sensor was initialized correctly
     * and is ready to measure.
     */
    //% block="ToF sensor connected"
    //% blockId=fisicabit_tof_conectado
    //% group="Diagnostics"
    //% weight=80
    export function tofSensorConnected(): boolean {
        return _default().ready
    }

    /**
     * Restarts the sensor from scratch.
     * Useful if the sensor stopped responding or was unplugged and plugged back in.
     */
    //% block="restart ToF sensor"
    //% blockId=fisicabit_tof_reiniciar
    //% group="Diagnostics"
    //% weight=75
    export function tofRestart(): void {
        for (let i = 0; i < _sensors.length; i++) {
            const s = _sensors[i]
            s.ready = false
            basic.pause(50)
            s.ready = _doInit(s)
            s.lastValue = 0
            s.lastOk = false
        }
    }

    /**
     * Reads the raw, unfiltered distance (a single reading).
     * Maximum speed but it may contain spurious spikes.
     * Returns -1 if the measurement failed.
     */
    //% block="ToF raw distance (mm)"
    //% blockId=fisicabit_tof_crudo
    //% group="Diagnostics"
    //% weight=70
    export function tofRawDistanceMm(): number {
        const s = _default()
        if (!_ensure(s)) return -1
        return _doRead(s)
    }
}
