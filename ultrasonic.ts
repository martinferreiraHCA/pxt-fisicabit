// =============================================================================
//  ultrasonic.ts — HC-SR04 and HY-SRF05 ultrasonic distance sensors
// =============================================================================
//  Project: FisicaBit.com
//  Sensors: HC-SR04 (4 pins) and HY-SRF05 (5 pins; with OUT floating it behaves
//           like the HC-SR04; with OUT tied to GND it uses a single TRIG/ECHO wire).
//  Range: 2 cm – 400 cm (≈1.5–2 m when powered at 3 V). Frequency: 40 kHz.
//
//  HOW IT WORKS:
//    1. A 10 µs HIGH pulse is sent on TRIG.
//    2. The sensor emits 8 pulses at 40 kHz and drives ECHO high until the
//       reflection comes back: pulse width = round-trip time.
//    3. distance = width × speed of sound / 2 (the speed depends on the air
//       temperature: 331.3 + 0.606·T m/s).
//
//  WIRING (same for both; the simulator shows the sensor and the wires):
//    VCC → 3V · GND → GND · TRIG → P8 · ECHO → P12   (HY-SRF05: OUT floating)
//    Expansion kit: headers 8 and 12 (G·V·S). With 5 V on VCC add a
//    1 kΩ / 2 kΩ divider on ECHO (the micro:bit only tolerates 3.3 V).
//    Second sensor: TRIG P1 · ECHO P2. Third: TRIG P15 · ECHO P16.
//
//  ACQUISITION:
//    Default = classic ping, identical to Microsoft's pxt-sonar: TRIG low 2 µs,
//    high 10 µs, low; pins.pulseIn on ECHO; distance = echo µs × speed of
//    sound / 2 (the "echo / 2000000 × 343" formula). One measurement per
//    block call, proven on real HC-SR04 / HY-SRF05 modules.
//    Optional (block "ultrasonic background sampler on"): a C++ sampler in
//    shims.cpp fires TRIG at a fixed period and times the echo with CODAL's
//    interrupt-driven pulse capture, stamping every sample with the instant
//    the sound hit the object (3 m range → ≈38 Hz; 1.5 m → ≈55 Hz).
//    Filter in both modes: sliding median (does not lower the rate) + step
//    rejection + offset calibration.
// =============================================================================

/** Ultrasonic distance sensors HC-SR04 and HY-SRF05 for physics experiments. */
//% weight=95
//% color=#FF8C00
//% icon=""
//% block="Ultrasonic"
//% groups='["Measurement", "Configuration", "Diagnostics"]'
namespace fisicabitUltrasonic {

    // ── Native shims (TS body = simulator) ──
    //% shim=fisicabitNative::usStart
    function _hwStart(idx: number, pinsPacked: number, maxMm: number, periodMs: number): number {
        return 0
    }
    //% shim=fisicabitNative::usStop
    function _hwStop(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::usConfigure
    function _hwConfigure(idx: number, maxMm: number, periodMs: number, speedMmPerS: number): number {
        return 0
    }
    //% shim=fisicabitNative::usSeq
    function _hwSeq(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::usDist
    function _hwDist(idx: number): number {
        return -1
    }
    //% shim=fisicabitNative::usEcho
    function _hwEcho(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::usTimeTenths
    function _hwTimeTenths(idx: number): number {
        return 0
    }
    //% shim=fisicabitNative::usStats
    function _hwStats(idx: number, which: number): number {
        return 0
    }

    // ── Global configuration ──
    const MAX_SENSORS = 3
    let _filterN = 3            // sliding median of N readings
    let _minMm = 20
    let _maxMm = 3000           // maximum range: defines the echo timeout and the sample rate
    let _periodMs = 0           // 0 = automatic from the range
    let _maxStepMm = 0          // step rejection (0 = disabled)
    let _tempC = 20             // air temperature for the speed of sound
    // false (default) = classic "ping": the same measurement as Microsoft's
    // pxt-sonar (10 µs pulse on TRIG, pins.pulseIn on ECHO, distance = echo
    // time × speed of sound / 2), proven on real HC-SR04 / HY-SRF05 modules.
    // true = native background sampler (C++), opt-in via the advanced block.
    let _backgroundMode = false

    function _speedMmPerS(): number {
        return Math.round((331.3 + 0.606 * _tempC) * 1000)
    }

    class UltrasonicSensor {
        idx: number
        trig: DigitalPin
        echo: DigitalPin
        singleWire: boolean
        native: boolean
        ready: boolean
        lastSeq: number
        lastAttemptMs: number
        nativeSinceMs: number   // start of the native sampler (watchdog)
        lastPingMs: number      // time of the last classic ping (pacing)
        lastSampleMs: number    // physical instant of the last valid echo (ms, 1 decimal)
        lastRawMm: number       // last raw (unfiltered) distance, -1 = no echo
        hist: number[]
        lastVal: number         // last valid distance (mm, with offset)
        lastOk: boolean
        offsetMm: number
        constructor(trig: DigitalPin, echo: DigitalPin) {
            this.idx = -1
            this.trig = trig
            this.echo = echo
            this.singleWire = (trig == echo)
            this.native = false
            this.lastPingMs = -100000
            this.lastSampleMs = 0
            this.lastRawMm = -1
            this.ready = false
            this.lastSeq = 0
            this.lastAttemptMs = -100000
            this.nativeSinceMs = 0
            this.hist = []
            this.lastVal = 0
            this.lastOk = false
            this.offsetMm = 0
        }
    }
    let _sensors: UltrasonicSensor[] = []

    function _get(trig: DigitalPin, echo: DigitalPin): UltrasonicSensor {
        for (let i = 0; i < _sensors.length; i++) {
            const t = _sensors[i]
            if (t.trig == trig && t.echo == echo) return t
        }
        const s = new UltrasonicSensor(trig, echo)
        s.idx = _sensors.length < MAX_SENSORS ? _sensors.length : -1
        _sensors.push(s)
        return s
    }

    function _ensure(s: UltrasonicSensor): void {
        if (s.ready) return
        const now = control.millis()
        if (now - s.lastAttemptMs < 500) return
        s.lastAttemptMs = now
        if (_backgroundMode && s.idx >= 0) {
            // Packed pins: native functions accept at most 4 parameters
            s.native = _hwStart(s.idx, (s.trig << 16) | s.echo, _maxMm, _periodMs) == 1
            if (s.native) _hwConfigure(s.idx, _maxMm, _periodMs, _speedMmPerS())
            s.nativeSinceMs = control.millis()
        }
        s.ready = true
        s.lastSeq = 0
    }

    function _reconfigureAll(): void {
        for (let i = 0; i < _sensors.length; i++) {
            const s = _sensors[i]
            if (s.native) _hwConfigure(s.idx, _maxMm, _periodMs, _speedMmPerS())
        }
    }

    /**
     * One classic measurement, exactly like `sonar.ping` of Microsoft's
     * pxt-sonar: TRIG low 2 µs, high 10 µs, low; then pins.pulseIn on ECHO.
     * Distance (mm) = echo µs × speed of sound (mm/s) / 2 000 000, i.e. the
     * "echo / 2000000 × 343" formula in metres. Returns -1 when no echo
     * arrives within the time of flight of the configured range.
     */
    function _ping(s: UltrasonicSensor): number {
        pins.setPull(s.trig, PinPullMode.PullNone)
        const t0 = input.runningTimeMicros()
        pins.digitalWritePin(s.trig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(s.trig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(s.trig, 0)
        // pxt-sonar uses maxCm × 58 µs; the same value from the range and temperature
        const timeout = Math.idiv(_maxMm * 2 * 1000000, _speedMmPerS()) + 3000
        const dur = pins.pulseIn(s.echo, PulseValue.High, timeout)
        s.lastPingMs = control.millis()
        if (dur <= 0) { s.lastRawMm = -1; return -1 }
        // Physical instant of the measurement: the module emits the burst
        // ≈0.45 ms after the trigger and the sound reaches the object half-way
        // through the echo (0.1 ms resolution: at 10 m/s an object moves 1 mm
        // in 0.1 ms).
        s.lastSampleMs = Math.round((t0 + 12 + 450 + dur / 2) / 100) / 10
        s.lastRawMm = Math.idiv(dur * _speedMmPerS(), 2000000)
        return s.lastRawMm
    }

    // Minimum spacing between classic pings. The HC-SR04 ignores a trigger
    // while its internal cycle (≈25-30 ms) is running: a faster trigger
    // produces no echo, pulseIn waits for the whole timeout and the block
    // would only repeat the previous value (measured: 10 ms requested → 36 ms
    // real with 80 % repeated samples; 30 ms requested → 30 ms real, all new).
    const CLASSIC_MIN_PERIOD_MS = 30

    /** Period between classic pings (ms): the user's rate, or time of flight + 8 ms, never below the module cycle. */
    function _classicPeriodMs(): number {
        let p = _periodMs > 0 ? _periodMs : Math.idiv(_maxMm * 2 * 1000, _speedMmPerS()) + 8
        if (p < CLASSIC_MIN_PERIOD_MS) p = CLASSIC_MIN_PERIOD_MS
        if (p > 500) p = 500
        return p
    }

    /**
     * Reads ONE new sample (native or TS). -2 = no new sample yet;
     * -1 = invalid echo; ≥0 = raw distance in mm.
     */
    function _readRaw(s: UltrasonicSensor): number {
        _ensure(s)
        if (s.native) {
            const seq = _hwSeq(s.idx)
            if (seq == s.lastSeq) {
                // Watchdog: if the native sampler produced no sample at all
                // in 500 ms, fall back to the classic method (blocking pulse)
                if (seq == 0 && control.millis() - s.nativeSinceMs > 500) {
                    _hwStop(s.idx)
                    s.native = false
                    return _ping(s)
                }
                return -2
            }
            s.lastSeq = seq
            return _hwDist(s.idx)
        }
        // Classic mode: never trigger faster than the module cycle. Called
        // sooner, the block returns the previous value without blocking.
        if (control.millis() - s.lastPingMs < _classicPeriodMs()) return -2
        return _ping(s)
    }

    function _sort(arr: number[], len: number): void {
        for (let i = 1; i < len; i++) {
            let key = arr[i]
            let j = i - 1
            while (j >= 0 && arr[j] > key) { arr[j + 1] = arr[j]; j-- }
            arr[j + 1] = key
        }
    }

    /** Filtered distance (mm): sliding median + step rejection + offset. */
    function _readFiltered(s: UltrasonicSensor): number {
        // First reading after start-up: wait for the first echo (≈30 ms) so
        // the block already returns a real distance instead of 0.
        if (!s.ready || (!s.lastOk && s.hist.length == 0)) _waitSample(s, 150)
        let d = _readRaw(s)
        if (d == -2) return s.lastVal
        if (d >= 0) d += s.offsetMm
        if (d < _minMm || d > _maxMm) d = -1
        if (d >= 0 && _maxStepMm > 0 && s.lastOk && Math.abs(d - s.lastVal) > _maxStepMm) d = -1
        if (d < 0) {
            s.lastOk = false
            return s.lastVal
        }
        s.lastOk = true
        if (_filterN <= 1) {
            s.lastVal = d
            return d
        }
        s.hist.push(d)
        while (s.hist.length > _filterN) s.hist.shift()
        let copy: number[] = []
        for (let i = 0; i < s.hist.length; i++) copy.push(s.hist[i])
        _sort(copy, copy.length)
        s.lastVal = copy[Math.idiv(copy.length, 2)]
        return s.lastVal
    }

    function _convert(mm: number, unit: FbDistanceUnit): number {
        switch (unit) {
            case FbDistanceUnit.Millimeters: return mm
            case FbDistanceUnit.Inches: return Math.round(mm / 25.4 * 100) / 100
            case FbDistanceUnit.Meters: return Math.round(mm) / 1000      // m with 3 decimals
            default: return Math.round(mm) / 10          // cm with 1 decimal
        }
    }

    function _decimalsFor(unit: FbDistanceUnit): number {
        if (unit == FbDistanceUnit.Millimeters) return 0
        if (unit == FbDistanceUnit.Inches) return 2
        if (unit == FbDistanceUnit.Meters) return 3
        return 1
    }

    /** Waits for the next sample (up to maxMs). Returns false if none arrived. */
    function _waitSample(s: UltrasonicSensor, maxMs: number): boolean {
        _ensure(s)
        if (!s.native) return true
        let waited = 0
        while (_hwSeq(s.idx) == s.lastSeq) {
            if (waited >= maxMs) return false
            basic.pause(1)
            waited++
        }
        return true
    }

    function _send(s: UltrasonicSensor, unit: FbDistanceUnit, channel: FbChannel): void {
        if (!_waitSample(s, 600)) return
        if (!s.native) {
            // Classic mode: keep the ping period (as pxt-sonar recommends ≥ 60 ms
            // between pings at long range) so one echo never overlaps the next.
            const wait = _classicPeriodMs() - (control.millis() - s.lastPingMs)
            if (wait > 0) basic.pause(wait)
        }
        const mm = _readFiltered(s)
        // No echo in this ping: send nothing rather than repeating a stale value
        if (!s.lastOk) return
        const baseMs = control.millis() - fisicabitData.channelTime(channel)
        // Time of the sample = the instant the sound hit the object, in the
        // fisicabit.com time base (not the instant the line is written)
        let tMs = (s.native ? _hwTimeTenths(s.idx) / 10 : s.lastSampleMs) - baseMs
        if (tMs < 0) tMs = 0
        const line = fisicabitData.format(tMs, 1) + "," + fisicabitData.format(_convert(mm, unit), _decimalsFor(unit))
        fisicabitData.channelSendText(channel, line)
    }

    // =========================================================================
    // MEASUREMENT
    // =========================================================================

    /**
     * Distance measured with an HC-SR04. It initializes itself: trigger and
     * echo are timed by native code in the background with microsecond
     * resolution, and the block returns the latest filtered measurement
     * (sliding median). If the echo fails, it returns the last valid value.
     *
     * Wiring: VCC → 3V, GND → GND, TRIG → P8, ECHO → P12 (the simulator shows
     * it). With 5 V on VCC, 1 kΩ / 2 kΩ divider on ECHO.
     *
     * Example (uniform motion): [forever] → [send to fisicabit.com time and
     * (HC-SR04 distance TRIG P8 ECHO P12 in cm) every 50 ms]
     * @param trigPin Pin connected to TRIG (trigger)
     * @param echoPin Pin connected to ECHO (response)
     * @param unit Unit: cm (1 decimal), mm or inches
     */
    //% block="HC-SR04 distance TRIG %trigPin ECHO %echoPin in %unit"
    //% blockId=fisicabit_ultrasonido
    //% group="Measurement"
    //% weight=100
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% unit.defl=FbDistanceUnit.Centimeters
    export function distance(trigPin: DigitalPin, echoPin: DigitalPin, unit: FbDistanceUnit): number {
        return _convert(_readFiltered(_get(trigPin, echoPin)), unit)
    }

    /**
     * Distance measured with an HY-SRF05. With OUT floating (4-wire mode) it
     * is wired like the HC-SR04: VCC → 3V, GND → GND, TRIG → P8,
     * ECHO → P12. Single-wire mode (OUT to GND): use the SAME pin for TRIG
     * and ECHO. Everything else works like the HC-SR04 block.
     * @param trigPin Pin connected to TRIG (trigger)
     * @param echoPin Pin connected to ECHO (or the same as TRIG in single-wire mode)
     * @param unit Unit: cm (1 decimal), mm or inches
     */
    //% block="HY-SRF05 distance TRIG %trigPin ECHO %echoPin in %unit"
    //% blockId=fisicabit_us_srf05
    //% group="Measurement"
    //% weight=99
    //% parts="hysrf05" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% unit.defl=FbDistanceUnit.Centimeters
    export function distanceSRF05(trigPin: DigitalPin, echoPin: DigitalPin, unit: FbDistanceUnit): number {
        return _convert(_readFiltered(_get(trigPin, echoPin)), unit)
    }

    /**
     * Sends to fisicabit.com every HC-SR04 echo with the real instant at which
     * the sound hit the object: one "time,distance" line per sample, at the
     * sensor rate (≈38 Hz with a 3 m range, ≈55 Hz with 1.5 m).
     * Put it inside "forever"; no "every ... ms" is needed.
     *
     * Example (cart on a track): [forever] → [send HC-SR04 distance
     * TRIG P8 ECHO P12 in cm via USB]
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     * @param unit Unit: cm (1 decimal), mm or inches
     * @param channel USB or Bluetooth
     */
    //% block="send HC-SR04 distance TRIG %trigPin ECHO %echoPin in %unit via %channel"
    //% blockId=fisicabit_us_enviar_hcsr04
    //% group="Measurement"
    //% weight=98
    //% inlineInputMode=inline
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% unit.defl=FbDistanceUnit.Centimeters
    //% channel.defl=FbChannel.USB
    export function sendDistance(trigPin: DigitalPin, echoPin: DigitalPin, unit: FbDistanceUnit, channel: FbChannel): void {
        _send(_get(trigPin, echoPin), unit, channel)
    }

    /**
     * Sends to fisicabit.com every HY-SRF05 echo with the real instant at
     * which the sound hit the object (one line per sample, at the sensor
     * rate). Single-wire mode: the same pin for TRIG and ECHO.
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     * @param unit Unit: cm (1 decimal), mm or inches
     * @param channel USB or Bluetooth
     */
    //% block="send HY-SRF05 distance TRIG %trigPin ECHO %echoPin in %unit via %channel"
    //% blockId=fisicabit_us_enviar_srf05
    //% group="Measurement"
    //% weight=97
    //% inlineInputMode=inline
    //% parts="hysrf05" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% unit.defl=FbDistanceUnit.Centimeters
    //% channel.defl=FbChannel.USB
    export function sendDistanceSRF05(trigPin: DigitalPin, echoPin: DigitalPin, unit: FbDistanceUnit, channel: FbChannel): void {
        _send(_get(trigPin, echoPin), unit, channel)
    }

    /**
     * Last raw distance (no filter, no offset) in the chosen unit;
     * 0 if there was no echo. Shows the real noise of the sensor.
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     * @param unit Distance unit
     */
    //% block="HC-SR04 raw distance TRIG %trigPin ECHO %echoPin in %unit"
    //% blockId=fisicabit_ultrasonido_crudo
    //% group="Diagnostics"
    //% weight=78
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% unit.defl=FbDistanceUnit.Millimeters
    export function rawDistance(trigPin: DigitalPin, echoPin: DigitalPin, unit: FbDistanceUnit): number {
        const s = _get(trigPin, echoPin)
        let d = _readRaw(s)
        if (d == -2) d = s.lastRawMm
        if (d < 0) return 0
        return _convert(d, unit)
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * Maximum range you want to measure. It defines how long to wait for the
     * echo and, with that, the sample rate: 150 cm → ≈55 Hz, 300 cm → ≈38 Hz,
     * 400 cm → ≈31 Hz. For a cart on a 1.5 m track use 150 cm.
     * @param cm Maximum range in cm (20 to 600)
     */
    //% block="set ultrasonic max range %cm cm"
    //% blockId=fisicabit_us_alcance
    //% group="Configuration"
    //% weight=90
    //% cm.min=20 cm.max=600 cm.defl=300
    export function setRange(cm: number): void {
        _maxMm = Math.max(200, Math.min(6000, Math.round(cm * 10)))
        _reconfigureAll()
    }

    /**
     * Air temperature used to compute the speed of sound
     * (331.3 + 0.606·T m/s). At 20 °C it is 343.4 m/s; every 5 °C changes
     * the distances by ≈1 %. You can plug in a DS18B20 or DHT11 reading here.
     * @param degreesC Air temperature in °C
     */
    //% block="set air temperature for ultrasonic %degreesC °C"
    //% blockId=fisicabit_us_temperatura
    //% group="Configuration"
    //% weight=88
    //% degreesC.min=-20 degreesC.max=50 degreesC.defl=20
    export function setAirTemperature(degreesC: number): void {
        _tempC = degreesC
        _reconfigureAll()
    }

    /**
     * Smoothing: median of the last 3, 5 or 7 samples. It does not lower the
     * sample rate; it adds a delay of 1, 2 or 3 samples.
     * For uniform/accelerated motion: light. For collisions or free fall: none.
     * @param filter Filter strength
     */
    //% block="set ultrasonic filter to %filter"
    //% blockId=fisicabit_us_configurar
    //% group="Configuration"
    //% weight=86
    //% filter.defl=FbUltrasonicFilter.Light
    export function setFilter(filter: FbUltrasonicFilter): void {
        _filterN = filter
        for (let i = 0; i < _sensors.length; i++) _sensors[i].hist = []
    }

    /**
     * Fixed sample rate in Hz (0 = automatic from the range).
     * If you ask for more than the range allows, the echo of one measurement
     * may contaminate the next one: use it with short ranges.
     * @param hz Samples per second (0 = automatic, max. 60)
     */
    //% block="set ultrasonic sampling rate %hz Hz (0 = auto)"
    //% blockId=fisicabit_us_frecuencia
    //% group="Configuration"
    //% weight=84
    //% hz.min=0 hz.max=60 hz.defl=0
    export function setSampleRate(hz: number): void {
        // Classic ping: the HC-SR04 cycle limits the rate to ≈33 Hz (30 ms);
        // the background sampler accepts up to ≈66 Hz at short range.
        _periodMs = hz <= 0 ? 0 : Math.max(15, Math.round(1000 / hz))
        _reconfigureAll()
    }

    /**
     * Valid range: readings outside it are discarded and the last valid one
     * is kept. The maximum also sets the range (echo timeout).
     * @param minMm Minimum valid distance in mm (default 20)
     * @param maxMm Maximum valid distance in mm (default 3000)
     */
    //% block="set ultrasonic range from %minMm to %maxMm mm"
    //% blockId=fisicabit_us_rango
    //% group="Configuration"
    //% weight=82
    //% minMm.defl=20 minMm.min=10
    //% maxMm.defl=3000 maxMm.min=50 maxMm.max=6000
    //% inlineInputMode=inline
    export function setLimits(minMm: number, maxMm: number): void {
        _minMm = Math.max(10, minMm)
        _maxMm = Math.max(50, Math.min(6000, maxMm))
        _reconfigureAll()
    }

    /**
     * Step rejection: if a sample differs from the previous one by more than
     * this value it is discarded (side reflections, someone walking across).
     * 0 = disabled. For a cart at 1 m/s at 40 Hz the real step is
     * 25 mm per sample: use 100 mm.
     * @param maxStepMm Maximum allowed step in mm (0 = disabled)
     */
    //% block="set ultrasonic max step %maxStepMm mm"
    //% blockId=fisicabit_us_max_cambio
    //% group="Configuration"
    //% weight=80
    //% maxStepMm.defl=0 maxStepMm.min=0
    export function setMaxStep(maxStepMm: number): void {
        _maxStepMm = maxStepMm
    }

    /**
     * Calibrates the sensor offset: place a flat surface at a known distance
     * (for example 300 mm measured with a tape), run the block and the
     * extension corrects all following readings. Takes ~1 s.
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     * @param distanceMm Real distance to the object in mm
     */
    //% block="calibrate ultrasonic TRIG %trigPin ECHO %echoPin with target at %distanceMm mm"
    //% blockId=fisicabit_us_calibrar
    //% group="Configuration"
    //% weight=78
    //% inlineInputMode=inline
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    //% distanceMm.min=50 distanceMm.max=4000 distanceMm.defl=300
    export function calibrate(trigPin: DigitalPin, echoPin: DigitalPin, distanceMm: number): void {
        const s = _get(trigPin, echoPin)
        const previous = s.offsetMm
        s.offsetMm = 0
        let sum = 0, n = 0
        for (let i = 0; i < 40 && n < 20; i++) {
            if (!_waitSample(s, 400)) break
            const d = _readRaw(s)
            if (d >= 0) { sum += d; n++ }
            if (!s.native) basic.pause(40)
        }
        if (n >= 5) {
            s.offsetMm = Math.round(distanceMm - sum / n)
            s.hist = []
            basic.showIcon(IconNames.Yes)
        } else {
            s.offsetMm = previous
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    // =========================================================================
    // DIAGNOSTICS
    // =========================================================================

    /**
     * Sensor status in a few words, to show on the display and know at once
     * what is going on: "OK 38Hz" = measuring with the native sampler;
     * "OK PING 45cm" = measuring with the classic ping (default, or native did not
     * start); "NO ECHO" = the sensor does not respond (check VCC: many
     * HC-SR04 need 5 V; GND; and that there is an object within range);
     * "ECHO HIGH" = the ECHO pin is stuck high (TRIG and ECHO swapped or
     * module not powered).
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     */
    //% block="ultrasonic status TRIG %trigPin ECHO %echoPin"
    //% blockId=fisicabit_us_estado
    //% group="Diagnostics"
    //% weight=86
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    export function status(trigPin: DigitalPin, echoPin: DigitalPin): string {
        const s = _get(trigPin, echoPin)
        _ensure(s)
        if (s.native) {
            const v0 = _hwStats(s.idx, 0)
            const i0 = _hwStats(s.idx, 1)
            basic.pause(400)
            const dv = _hwStats(s.idx, 0) - v0
            const di = _hwStats(s.idx, 1) - i0
            if (dv > 0) return "OK " + Math.round(dv * 2.5) + "Hz"
            if (di > 0) return _hwStats(s.idx, 3) == 1 ? "ECHO HIGH" : "NO ECHO"
            // The native sampler produced no sample at all: switch to simple mode
            _hwStop(s.idx)
            s.native = false
        }
        const d = _ping(s)
        if (d > 0) return "OK PING " + Math.idiv(d, 10) + "cm"
        return pins.digitalReadPin(echoPin) == 1 ? "ECHO HIGH" : "NO ECHO"
    }

    /**
     * Chooses how the sensor is read. Off (default): classic ping, the same
     * measurement as Microsoft's pxt-sonar (10 µs pulse, pins.pulseIn), one
     * reading per block call. On: a native C++ sampler fires the sensor in
     * the background at the rate allowed by the range and time-stamps every
     * echo with microsecond precision (≈38-55 Hz); the blocks then return
     * the latest sample without waiting. If the sampler produces no echo it
     * falls back to the classic ping automatically.
     * @param enable true to use the background sampler
     */
    //% block="ultrasonic background sampler %enable"
    //% blockId=fisicabit_us_nativo
    //% group="Configuration"
    //% weight=70
    //% enable.shadow=toggleOnOff
    //% advanced=true
    export function setBackgroundSampler(enable: boolean): void {
        if (enable == _backgroundMode) return
        _backgroundMode = enable
        for (let i = 0; i < _sensors.length; i++) {
            const s = _sensors[i]
            if (s.native) _hwStop(s.idx)
            s.native = false
            s.ready = false
            s.lastAttemptMs = -100000
            s.lastSeq = 0
        }
    }

    /**
     * True if the last sample had a valid echo (object within range and no
     * rejected step).
     */
    //% block="ultrasonic echo valid?"
    //% blockId=fisicabit_us_valido
    //% group="Diagnostics"
    //% weight=84
    export function echoValid(): boolean {
        for (let i = 0; i < _sensors.length; i++) if (_sensors[i].lastOk) return true
        return false
    }

    /**
     * Actual sample rate of the sensor (Hz), measured over 1 second.
     * 3 m range → ≈38 Hz; 1.5 m → ≈55 Hz.
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     */
    //% block="ultrasonic actual sampling rate (Hz) TRIG %trigPin ECHO %echoPin"
    //% blockId=fisicabit_us_hz
    //% group="Diagnostics"
    //% weight=82
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    export function actualSampleRate(trigPin: DigitalPin, echoPin: DigitalPin): number {
        const s = _get(trigPin, echoPin)
        _ensure(s)
        if (!s.native) return 0
        const before = _hwStats(s.idx, 0) + _hwStats(s.idx, 1)
        basic.pause(1000)
        return _hwStats(s.idx, 0) + _hwStats(s.idx, 1) - before
    }

    /**
     * Instant (ms since power-up, 1 decimal) at which the sound hit the
     * object in the last sample (hardware echo time).
     * @param trigPin Pin connected to TRIG
     * @param echoPin Pin connected to ECHO
     */
    //% block="ultrasonic last echo time (ms) TRIG %trigPin ECHO %echoPin"
    //% blockId=fisicabit_us_tiempo
    //% group="Diagnostics"
    //% weight=80
    //% parts="hcsr04" trackArgs=0,1
    //% trigPin.defl=DigitalPin.P8
    //% echoPin.defl=DigitalPin.P12
    export function lastEchoTime(trigPin: DigitalPin, echoPin: DigitalPin): number {
        const s = _get(trigPin, echoPin)
        _ensure(s)
        if (!s.native) return s.lastSampleMs
        return _hwTimeTenths(s.idx) / 10
    }
}
