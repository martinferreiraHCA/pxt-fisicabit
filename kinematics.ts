// =============================================================================
//  kinematics.ts — "FisicaBit kinematics": precision accelerometer
// =============================================================================
//  Project: FisicaBit.com
//
//  WHAT IS INSIDE THE micro:bit v2 (researched in the LSM303AGR datasheet,
//  DocID027765 Rev 9, and in the CODAL driver LSM303Accelerometer.cpp):
//  ─────────────────────────────────────────────────────────────────────────
//  • Sensor: LSM303AGR (ST), 3-axis capacitive MEMS. It has NO gyroscope.
//  • Range ±2 g by default (also ±4/±8/±16 g).
//  • Modes: normal (10 bits, 3.9 mg/LSB) and HIGH RESOLUTION (12 bits,
//    0.98 mg/LSB, noise 3 mg RMS at 100 Hz, bandwidth ODR/9).
//  • Output data rates (ODR): 1, 10, 25, 50, 100, 200, 400 Hz…
//  • Zero-g offset per axis: ±40 mg typical, up to ±80 mg.
//    → 0.4 m/s² of bias if not calibrated. Drift ±0.5 mg/°C.
//  • Sensitivity tolerance ±7 % (typically much better), 0.01 %/°C.
//
//  HOW MAKECODE USES IT (what the default firmware does):
//  ─────────────────────────────────────────────────────────────
//  • CODAL configures the chip in NORMAL mode (10 bits) at 50 Hz, ±2 g, and
//    decodes raw16/32·range. Result: `input.acceleration` returns
//    1024 COUNTS PER g (not 1000): at rest z ≈ −1024, and in normal mode
//    the values jump in steps of 4 counts (3.9 mg).
//  • Consequence: converting with 9.81/1000 introduces +2.4 % error.
//  • Every new sample fires the DATA_UPDATE event (id 5, value 1).
//
//  WHAT THIS MODULE DOES TO MEASURE ACCURATELY:
//  ─────────────────────────────────────────────────
//  1. Puts the chip in HIGH RESOLUTION (HR bit of CTRL_REG4_A) and at 200 Hz
//     (native shim in shims.cpp). 4× better resolution and less noise.
//  2. Processes EVERY sensor sample in the background (DATA_UPDATE event),
//     with the real timestamp of each one (control.micros()).
//  3. Calibrates the scale with the gravity measured at rest: measured |g| in
//     counts ↔ local g (9.80665 m/s² by default). This corrects at once the
//     1024 factor and the sensitivity tolerance of the chip.
//  4. Subtracts the reference gravity vector (learned at rest) to obtain the
//     LINEAR acceleration relative to the ground. Stillness is detected from
//     constant readings and |a| ≈ 1 g (without depending on the reference):
//     the first time the board is still, the measured gravity is adopted
//     (never the first sample, which may be a transient); if the tilt changes
//     at rest, the reference is learned again after 3 s still; and the offset
//     bias is corrected slowly at rest.
//  5. Moving average (10 samples = 50 ms) for the reading: noise /√10.
//  6. Velocity: integrates every sample (trapezoid, real dt) and is set to 0
//     automatically when rest is detected (ZUPT), which removes the drift
//     accumulated between movements.
//  7. 6-position calibration (advanced) for per-axis offset and scale.
//
//  PHYSICAL LIMIT THAT CANNOT BE BYPASSED: without a gyroscope the sensor
//  cannot tell gravity from acceleration when the board ROTATES while it
//  moves. For accurate measurements keep the orientation fixed during the
//  movement (cart on a rail, free fall, elevator). At rest the orientation
//  may be changed: the reference is learned again on its own.
// =============================================================================

/** Precision accelerometer for kinematics: linear acceleration, velocity, rest detection and calibration. */
//% weight=97
//% color=#1E88E5
//% icon=""
//% block="FisicaBit kinematics"
//% groups="['1. Start (in on start)', '2. Measure', '3. Send to fisicabit.com', '4. Optional', 'Advanced']"
namespace fisicabitKinematics {

    // =========================================================================
    // Native shims (TS body = simulator)
    // =========================================================================

    //% shim=fisicabitNative::accelConfigure
    function _hwConfigure(periodMs: number, rangeG: number, highRes: number): number {
        return periodMs
    }

    //% shim=fisicabitNative::accelEnsureHighRes
    function _hwEnsureHighRes(highRes: number): number {
        return -1
    }

    // =========================================================================
    // Constants and state
    // =========================================================================
    const G_STD = 9.80665
    const COUNTS_PER_G = 1024              // MakeCode: raw16/16 → 1024 counts ≈ 1 g
    const ACCEL_ID = 5                     // DAL.DEVICE_ID_ACCELEROMETER
    const EVT_DATA_UPDATE = 1              // ACCELEROMETER_EVT_DATA_UPDATE
    const MAX_WINDOW = 40
    const REST_WINDOW = 40                 // samples to detect rest (0.2 s at 200 Hz)
    const REST_RANGE = 24                  // counts: |a| almost constant (≈0.23 m/s²; noise alone gives ≈13–17)
    const REST_RANGE_AXIS = 32             // counts: each axis almost constant (≈0.31 m/s²)
    const REST_GRACE_MS = 150              // ms: an isolated noise spike does not reset the stillness counter
    const REST_LINEAR = 40                 // counts: small mean |a_linear| (≈0.4 m/s²) = real rest
    const REST_TOL_G_INITIAL = 100         // counts: ||a| − 1024| before the reference settles (±10 %)
    const REST_TOL_G = 60                  // counts: ||a| − |g_ref|| with the reference settled (≈0.6 m/s²)
    const REST_MS_JUMP = 3000              // ms still with large linear → the tilt changed at rest:
                                           // the new reference is adopted (a gentle constant acceleration lasts less)
    const DISCARD_SAMPLES = 20             // samples thrown away after reconfiguring the chip (transient)
    const REST_MS_ZUPT = 400               // ms still before setting v = 0
    const REST_MS_REF = 800                // ms still before correcting the reference
    const DEADBAND_MS2 = 0.02              // m/s² (only on the displayed reading)

    let _gLocal = G_STD
    let _periodMs = 5                      // 200 Hz
    let _rangeG = 2
    let _highRes = true
    let _window = 10
    let _fixedRef = false
    let _zupt = true
    let _started = false
    let _hr = -1                           // last result of _hwEnsureHighRes

    // 6-position calibration (counts): a_cal = (raw − off) · scale
    let _offX = 0, _offY = 0, _offZ = 0
    let _scaleX = 1, _scaleY = 1, _scaleZ = 1
    let _cal6 = false

    // Gravity reference (calibrated counts) and counts → m/s² factor
    let _gx = 0, _gy = 0, _gz = -COUNTS_PER_G
    let _gMag = COUNTS_PER_G
    let _gRefValid = false
    let _refSettled = false                // true when the reference was measured with the board still
    let _discard = 0                       // samples still to be discarded after reconfiguring
    let _factor = G_STD / COUNTS_PER_G

    // Last calibrated sample (counts) and instantaneous linear (counts)
    let _ax = 0, _ay = 0, _az = -COUNTS_PER_G
    let _lx = 0, _ly = 0, _lz = 0

    // Moving average of the linear acceleration and of the calibrated raw one
    let _bLx: number[] = []
    let _bLy: number[] = []
    let _bLz: number[] = []
    let _bAx: number[] = []
    let _bAy: number[] = []
    let _bAz: number[] = []
    let _bIdx = 0
    let _bN = 0
    let _sLx = 0, _sLy = 0, _sLz = 0
    let _sAx = 0, _sAy = 0, _sAz = 0

    // Rest detection: window of raw |a|
    let _bMag: number[] = []
    let _mIdx = 0
    let _mN = 0
    let _still = false                     // board still (constant readings)
    let _stillSinceMs = 0
    let _notStillSinceMs = 0               // start of the current interruption of stillness (0 = none)
    let _atRest = false                    // still AND linear acceleration ≈ 0 (real rest)

    // Velocity (m/s)
    let _vx = 0, _vy = 0, _vz = 0, _vV = 0
    let _lastTimeUs = 0
    let _aPrevX = 0, _aPrevY = 0, _aPrevZ = 0, _aPrevV = 0

    // Sampler statistics
    let _samples = 0
    let _lastEventMs = 0

    // =========================================================================
    // Background sampler
    // =========================================================================

    function _resetBuffers(): void {
        _bLx = []; _bLy = []; _bLz = []; _bAx = []; _bAy = []; _bAz = []
        for (let i = 0; i < MAX_WINDOW; i++) {
            _bLx.push(0); _bLy.push(0); _bLz.push(0)
            _bAx.push(0); _bAy.push(0); _bAz.push(0)
        }
        _bIdx = 0; _bN = 0
        _sLx = 0; _sLy = 0; _sLz = 0; _sAx = 0; _sAy = 0; _sAz = 0
        _bMag = []
        for (let i = 0; i < REST_WINDOW; i++) _bMag.push(0)
        _mIdx = 0; _mN = 0
    }

    function _configureHardware(): void {
        const actual = _hwConfigure(_periodMs, _rangeG, _highRes ? 1 : 0)
        if (actual > 0) _periodMs = actual
        _hr = _hwEnsureHighRes(_highRes ? 1 : 0)
        // When switching to HR the chip needs 7/ODR to settle: besides the
        // pause, the first samples are discarded and the integration is reset
        basic.pause(60)
        _discard = DISCARD_SAMPLES
        _lastTimeUs = 0
    }

    function _ensureStarted(): void {
        if (_started) return
        _started = true
        _resetBuffers()
        _configureHardware()
        // Every new sensor sample fires this event
        control.onEvent(ACCEL_ID, EVT_DATA_UPDATE, function () {
            _lastEventMs = control.millis()
            _process(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z), control.micros())
        })
        // Fallback: if no events arrive (simulator), sample by polling.
        // It also re-asserts HR mode every 2 s (CODAL loses it when reconfiguring).
        control.inBackground(function () {
            let count = 0
            while (true) {
                basic.pause(_periodMs)
                if (control.millis() - _lastEventMs > 250) {
                    _process(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z), control.micros())
                }
                count++
                if (count * _periodMs >= 2000) {
                    count = 0
                    _hr = _hwEnsureHighRes(_highRes ? 1 : 0)
                }
            }
        })
    }

    function _process(rx: number, ry: number, rz: number, tUs: number): void {
        if (_discard > 0) { _discard--; return }
        // 1) Per-axis offset/scale calibration
        const ax = (rx - _offX) * _scaleX
        const ay = (ry - _offY) * _scaleY
        const az = (rz - _offZ) * _scaleZ
        _ax = ax; _ay = ay; _az = az
        _samples++

        // 2) Provisional initial reference: first sample. It is replaced by
        //    the measured mean the first time the board is still.
        if (!_gRefValid) {
            _setReference(ax, ay, az, false)
        }

        // 3) Instantaneous linear acceleration (counts)
        const lx = ax - _gx
        const ly = ay - _gy
        const lz = az - _gz
        _lx = lx; _ly = ly; _lz = lz

        // 4) Moving averages (window _window)
        if (_bN >= _window) {
            const j = (_bIdx - _window + MAX_WINDOW) % MAX_WINDOW
            _sLx -= _bLx[j]; _sLy -= _bLy[j]; _sLz -= _bLz[j]
            _sAx -= _bAx[j]; _sAy -= _bAy[j]; _sAz -= _bAz[j]
        } else {
            _bN++
        }
        _bLx[_bIdx] = lx; _bLy[_bIdx] = ly; _bLz[_bIdx] = lz
        _bAx[_bIdx] = ax; _bAy[_bIdx] = ay; _bAz[_bIdx] = az
        _sLx += lx; _sLy += ly; _sLz += lz
        _sAx += ax; _sAy += ay; _sAz += az
        _bIdx = (_bIdx + 1) % MAX_WINDOW

        // 5) Stillness: each axis and the magnitude almost constant over the
        //    window, and magnitude ≈ 1 g. It does not depend on the gravity
        //    reference, so a badly learned reference does not prevent detecting it.
        const mag = Math.sqrt(ax * ax + ay * ay + az * az)
        _bMag[_mIdx] = mag
        _mIdx = (_mIdx + 1) % REST_WINDOW
        if (_mN < REST_WINDOW) _mN++
        let still = false
        if (_mN >= REST_WINDOW && _samples >= MAX_WINDOW) {
            let mn = _bMag[0], mx = _bMag[0], sum = 0
            let xn = _bAx[0], xm = _bAx[0], yn = _bAy[0], ym = _bAy[0], zn = _bAz[0], zm = _bAz[0]
            for (let i = 0; i < REST_WINDOW; i++) {
                const v = _bMag[i]
                if (v < mn) mn = v
                if (v > mx) mx = v
                sum += v
                const bx = _bAx[i], by = _bAy[i], bz = _bAz[i]
                if (bx < xn) xn = bx
                if (bx > xm) xm = bx
                if (by < yn) yn = by
                if (by > ym) ym = by
                if (bz < zn) zn = bz
                if (bz > zm) zm = bz
            }
            const magMean = sum / REST_WINDOW
            const gExpected = _refSettled ? _gMag : COUNTS_PER_G
            const tol = _refSettled ? REST_TOL_G : REST_TOL_G_INITIAL
            still = (mx - mn) < REST_RANGE
                && (xm - xn) < REST_RANGE_AXIS && (ym - yn) < REST_RANGE_AXIS && (zm - zn) < REST_RANGE_AXIS
                && Math.abs(magMean - gExpected) < tol
        }
        const nowMs = control.millis()
        if (still) {
            if (!_still) { _still = true; _stillSinceMs = nowMs }
            _notStillSinceMs = 0
            const stillMs = nowMs - _stillSinceMs
            const n = _bN > 0 ? _bN : 1
            const mAx = _sAx / n, mAy = _sAy / n, mAz = _sAz / n
            const dx = mAx - _gx, dy = mAy - _gy, dz = mAz - _gz
            const linear = Math.sqrt(dx * dx + dy * dy + dz * dz)
            // Real rest: still and the mean linear acceleration is ≈ 0. If the
            // linear part is large while still, either the tilt changed at rest
            // (old reference) or there is a very gentle constant acceleration
            // (uniform acceleration without vibration): told apart by duration.
            _atRest = !_refSettled || linear < REST_LINEAR
            if (_fixedRef) {
                _refSettled = true
            } else if (!_refSettled || (!_atRest && stillMs >= REST_MS_JUMP)) {
                // First time still, or a sustained new tilt: adopt the measured
                // gravity as reference and restart the velocity at 0
                _setReference(mAx, mAy, mAz, true)
                _vx = 0; _vy = 0; _vz = 0; _vV = 0
                _aPrevX = 0; _aPrevY = 0; _aPrevZ = 0; _aPrevV = 0
                _atRest = true
            } else if (_atRest && stillMs >= REST_MS_REF) {
                // Slow correction (thermal drift of the offset)
                const k = 0.02
                _gx += k * dx
                _gy += k * dy
                _gz += k * dz
                _updateFactor()
            }
            if (_zupt && _atRest && stillMs >= REST_MS_ZUPT) {
                _vx = 0; _vy = 0; _vz = 0; _vV = 0
            }
        } else {
            // No longer still. An isolated noise spike does not reset the
            // stillness counter (grace), but while it lasts there is no rest:
            // no ZUPT, no reference correction, no frozen velocity.
            _atRest = false
            if (_still) {
                if (_notStillSinceMs === 0) _notStillSinceMs = nowMs
                if (nowMs - _notStillSinceMs >= REST_GRACE_MS) {
                    _still = false
                    _notStillSinceMs = 0
                }
            }
        }

        // 6) Velocity integration (trapezoid, real dt, m/s²)
        if (_lastTimeUs !== 0) {
            let dtUs = tUs - _lastTimeUs
            const nominal = _periodMs * 1000
            if (dtUs <= 0 || dtUs > nominal * 10) dtUs = nominal
            if (dtUs < nominal / 2) dtUs = nominal / 2
            const dt = dtUs / 1000000
            const fx = lx * _factor, fy = ly * _factor, fz = lz * _factor
            const fV = -(lx * _gx + ly * _gy + lz * _gz) / _gMag * _factor
            const freeze = _atRest && _zupt && (nowMs - _stillSinceMs) >= REST_MS_ZUPT
            // With the provisional reference (the board has not been seen still
            // yet) integrating would only accumulate badly subtracted gravity
            if (_refSettled && !freeze) {
                _vx += (fx + _aPrevX) * 0.5 * dt
                _vy += (fy + _aPrevY) * 0.5 * dt
                _vz += (fz + _aPrevZ) * 0.5 * dt
                _vV += (fV + _aPrevV) * 0.5 * dt
            }
            _aPrevX = fx; _aPrevY = fy; _aPrevZ = fz; _aPrevV = fV
        }
        _lastTimeUs = tUs
    }

    function _setReference(gx: number, gy: number, gz: number, settled: boolean): void {
        _gx = gx; _gy = gy; _gz = gz
        _gRefValid = true
        _refSettled = settled
        _updateFactor()
    }

    function _updateFactor(): void {
        _gMag = Math.sqrt(_gx * _gx + _gy * _gy + _gz * _gz)
        if (_gMag < 700 || _gMag > 1400) {
            // Implausible reference (movement or saturated range): use nominal
            _factor = _gLocal / COUNTS_PER_G
            if (_gMag < 1) _gMag = COUNTS_PER_G
        } else {
            _factor = _gLocal / _gMag
        }
    }

    function _round2(v: number): number {
        return Math.round(v * 100) / 100
    }

    function _linearMean(): number[] {
        const n = _bN > 0 ? _bN : 1
        return [_sLx / n, _sLy / n, _sLz / n]
    }

    function _rawMean(): number[] {
        const n = _bN > 0 ? _bN : 1
        return [_sAx / n, _sAy / n, _sAz / n]
    }

    function _component(v: number[], axis: FbAccelerationAxis): number {
        switch (axis) {
            case FbAccelerationAxis.X: return v[0]
            case FbAccelerationAxis.Y: return v[1]
            case FbAccelerationAxis.Z: return v[2]
            case FbAccelerationAxis.Magnitude:
                return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
            case FbAccelerationAxis.Vertical:
                return -(v[0] * _gx + v[1] * _gy + v[2] * _gz) / _gMag
            default: return 0
        }
    }

    // =========================================================================
    // STEP 1: START
    // =========================================================================

    /**
     * Starts the precision accelerometer: high resolution (12 bits),
     * 200 samples per second, background measurement and automatic
     * calibration at rest. Place it in "on start" with the board still.
     * (The measurement blocks start it on their own if you forget.)
     *
     * Example: [on start] → [start precision accelerometer]
     *          [forever] → [send to fisicabit.com time and (vertical acceleration) every 50 ms]
     */
    //% block="start precision accelerometer"
    //% blockId=fisicabit_cin_iniciar
    //% group="1. Start (in on start)"
    //% weight=100
    export function start(): void {
        _ensureStarted()
        calibrateAtRest()
    }

    // =========================================================================
    // STEP 2: MEASURE
    // =========================================================================

    /**
     * LINEAR acceleration of the body relative to the ground, in m/s²
     * (without gravity). At rest it reads 0.00. "Vertical" is positive
     * upwards and works with the board tilted; "magnitude" is |a|.
     * Average of the last 10 samples (50 ms) to reduce noise.
     *
     * Example: elevator starting upwards → vertical ≈ +1 m/s².
     * @param axis Axis: vertical, X, Y, Z or magnitude
     */
    //% block="acceleration (m/s²) %axis"
    //% blockId=fisicabit_cin_accel_lineal
    //% group="2. Measure"
    //% weight=100
    //% axis.defl=FbAccelerationAxis.Vertical
    export function linearAcceleration(axis: FbAccelerationAxis): number {
        _ensureStarted()
        let v = _component(_linearMean(), axis) * _factor
        if (v < DEADBAND_MS2 && v > -DEADBAND_MS2) v = 0
        return _round2(v)
    }

    /**
     * Instantaneous velocity in m/s, integrating the acceleration of EVERY
     * sensor sample in the background (no need to call it continuously).
     * It resets to 0 on its own when the board is still, so the drift does
     * not accumulate. Keep the board orientation fixed while it moves.
     *
     * Example: cart on a rail: [send to fisicabit.com time and (instantaneous velocity X) every 50 ms]
     * @param axis Axis: vertical, X, Y, Z or magnitude
     */
    //% block="instantaneous velocity (m/s) %axis"
    //% blockId=fisicabit_cin_velocidad
    //% group="2. Measure"
    //% weight=95
    //% axis.defl=FbAccelerationAxis.Vertical
    export function instantaneousVelocity(axis: FbAccelerationAxis): number {
        _ensureStarted()
        switch (axis) {
            case FbAccelerationAxis.X: return _round2(_vx)
            case FbAccelerationAxis.Y: return _round2(_vy)
            case FbAccelerationAxis.Z: return _round2(_vz)
            case FbAccelerationAxis.Magnitude:
                return _round2(Math.sqrt(_vx * _vx + _vy * _vy + _vz * _vz))
            case FbAccelerationAxis.Vertical: return _round2(_vV)
            default: return 0
        }
    }

    /**
     * Sets the velocity to 0 on all axes. Use it when starting each
     * measurement with the body still (for example when pressing button A).
     */
    //% block="reset velocity to 0"
    //% blockId=fisicabit_cin_reset
    //% group="2. Measure"
    //% weight=90
    export function resetVelocity(): void {
        _vx = 0; _vy = 0; _vz = 0; _vV = 0
        _aPrevX = 0; _aPrevY = 0; _aPrevZ = 0; _aPrevV = 0
    }

    /**
     * True when the board is at rest: constant readings for 0.2 s and
     * linear acceleration ≈ 0. With that the module sets the velocity
     * to 0 and corrects the gravity reference.
     */
    //% block="at rest?"
    //% blockId=fisicabit_cin_reposo
    //% group="2. Measure"
    //% weight=85
    export function isAtRest(): boolean {
        _ensureStarted()
        return _atRest
    }

    /**
     * PROPER acceleration (the one the sensor "feels"), in m/s², WITHOUT
     * subtracting gravity: at rest it is ≈9.81 upwards, in free fall ≈0.
     * @param axis Axis: vertical, X, Y, Z or magnitude
     */
    //% block="proper acceleration (m/s²) %axis"
    //% blockId=fisicabit_cin_accel_propia
    //% group="2. Measure"
    //% weight=80
    //% axis.defl=FbAccelerationAxis.Magnitude
    export function properAcceleration(axis: FbAccelerationAxis): number {
        _ensureStarted()
        return _round2(_component(_rawMean(), axis) * _factor)
    }

    /**
     * True if the body is in free fall: the proper acceleration is below
     * the threshold (300 mg ≈ 3 m/s² by default).
     * @param thresholdMg Threshold in milli-g, eg: 300
     */
    //% block="free fall? (below %thresholdMg mg)"
    //% blockId=fisicabit_cin_caida_libre
    //% group="2. Measure"
    //% weight=75
    //% thresholdMg.min=50 thresholdMg.max=800 thresholdMg.defl=300
    export function isFreeFall(thresholdMg: number): boolean {
        _ensureStarted()
        const m = _rawMean()
        const mag = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2])
        return mag < thresholdMg * COUNTS_PER_G / 1000
    }

    /**
     * Pitch of the board in degrees: forward/backward tilt.
     */
    //% block="pitch (°)"
    //% blockId=fisicabit_cin_pitch
    //% group="2. Measure"
    //% weight=70
    export function pitch(): number {
        _ensureStarted()
        const m = _rawMean()
        const yz = Math.sqrt(m[1] * m[1] + m[2] * m[2])
        return Math.round(Math.atan2(-m[0], yz) * 180 / Math.PI * 10) / 10
    }

    /**
     * Roll of the board in degrees: left/right tilt.
     */
    //% block="roll (°)"
    //% blockId=fisicabit_cin_roll
    //% group="2. Measure"
    //% weight=69
    export function roll(): number {
        _ensureStarted()
        const m = _rawMean()
        return Math.round(Math.atan2(m[1], m[2]) * 180 / Math.PI * 10) / 10
    }

    // =========================================================================
    // STEP 3: SEND TO fisicabit.com — velocity and acceleration at intervals
    // =========================================================================

    function _send(channel: FbChannel, values: number[], ms: number): void {
        // Bluetooth is provided by the optional fisicabit-bluetooth extension;
        // without it the data goes over USB serial.
        fisicabitData.channelSend(channel, values, ms)
    }

    /**
     * Sends to fisicabit.com the time and the VELOCITY (m/s) every X ms,
     * via USB or Bluetooth. Place it inside "forever". Ideal for uniformly
     * accelerated motion: on the page, the velocity-time graph is a
     * straight line and its slope is the acceleration.
     * Line sent: time,velocity. On fisicabit.com: 1 variable,
     * "Micro:bit sends timestamp" enabled. Over Bluetooth, put
     * "start Bluetooth for fisicabit.com" in "on start" first.
     *
     * Example: cart on an inclined plane, board fixed to the cart:
     *   [forever] → [send velocity X via Bluetooth every 100 ms]
     * @param axis Axis of the movement: X, Y, Z, vertical or magnitude
     * @param channel USB or Bluetooth
     * @param ms Time between sends in ms (100 = 10 per second), eg: 100
     */
    //% block="send velocity %axis via %channel every %ms ms"
    //% blockId=fisicabit_cin_enviar_v
    //% group="3. Send to fisicabit.com"
    //% weight=100
    //% axis.defl=FbAccelerationAxis.X
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function sendVelocity(axis: FbAccelerationAxis, channel: FbChannel, ms: number): void {
        _send(channel, [instantaneousVelocity(axis)], ms)
    }

    /**
     * Sends to fisicabit.com the time, the VELOCITY (m/s) and the
     * ACCELERATION (m/s²) every X ms, via USB or Bluetooth. Place it inside
     * "forever". Lets you compare on the same graph the slope of v(t)
     * with the measured acceleration.
     * Line sent: time,velocity,acceleration. On fisicabit.com: 2
     * variables, "Micro:bit sends timestamp" enabled.
     * @param axis Axis of the movement: X, Y, Z, vertical or magnitude
     * @param channel USB or Bluetooth
     * @param ms Time between sends in ms, eg: 100
     */
    //% block="send velocity and acceleration %axis via %channel every %ms ms"
    //% blockId=fisicabit_cin_enviar_va
    //% group="3. Send to fisicabit.com"
    //% weight=95
    //% axis.defl=FbAccelerationAxis.X
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function sendVelocityAcceleration(axis: FbAccelerationAxis, channel: FbChannel, ms: number): void {
        _send(channel, [instantaneousVelocity(axis), linearAcceleration(axis)], ms)
    }

    /**
     * Sends to fisicabit.com the time and the ACCELERATION (m/s²) every X ms,
     * via USB or Bluetooth. Place it inside "forever".
     * Line sent: time,acceleration. On fisicabit.com: 1 variable,
     * "Micro:bit sends timestamp" enabled.
     * @param axis Axis: vertical, X, Y, Z or magnitude
     * @param channel USB or Bluetooth
     * @param ms Time between sends in ms, eg: 100
     */
    //% block="send acceleration %axis via %channel every %ms ms"
    //% blockId=fisicabit_cin_enviar_a
    //% group="3. Send to fisicabit.com"
    //% weight=90
    //% axis.defl=FbAccelerationAxis.Vertical
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function sendAcceleration(axis: FbAccelerationAxis, channel: FbChannel, ms: number): void {
        _send(channel, [linearAcceleration(axis)], ms)
    }

    // =========================================================================
    // STEP 4: OPTIONAL
    // =========================================================================

    /**
     * Quick calibration: with the board STILL for 1 second, measures
     * gravity, sets the rest reference (linear acceleration = 0) and the
     * real scale of the sensor, and sets the velocity to 0. It runs on its
     * own at start; repeat it if the board orientation was changed.
     *
     * Example: [on button A pressed] → [calibrate at rest (1 s)]
     */
    //% block="calibrate at rest (hold still 1 s)"
    //% blockId=fisicabit_cin_calibrar
    //% group="4. Optional"
    //% weight=100
    export function calibrateAtRest(): void {
        _ensureStarted()
        let sx = 0, sy = 0, sz = 0, n = 0
        const t0 = control.millis()
        while (control.millis() - t0 < 1000) {
            sx += _ax; sy += _ay; sz += _az; n++
            basic.pause(_periodMs)
        }
        if (n > 0) _setReference(sx / n, sy / n, sz / n, true)
        resetVelocity()
        _still = true
        _stillSinceMs = control.millis()
        _atRest = true
    }

    /**
     * (Compatibility) Calibration at rest averaging N samples.
     * @param samples Number of samples, eg: 200
     */
    //% block="calibrate accelerometer at rest (%samples samples)"
    //% blockId=fisicabit_cin_calibrar_n
    //% group="4. Optional"
    //% weight=99
    //% samples.min=50 samples.max=500 samples.defl=200
    //% deprecated=true
    export function calibrateAccelerometer(samples: number): void {
        calibrateAtRest()
    }

    /**
     * Sampling rate of the sensor. 200 Hz by default. 400 Hz for very
     * brief impacts and collisions; 100 Hz if the program does many other
     * things at the same time.
     * @param rate Sampling rate
     */
    //% block="set accelerometer sampling %rate"
    //% blockId=fisicabit_cin_tasa
    //% group="4. Optional"
    //% weight=90
    //% rate.defl=FbAccelerometerRate.Hz200
    export function setRate(rate: FbAccelerometerRate): void {
        _periodMs = rate
        if (_started) _configureHardware()
    }

    /**
     * Smoothing of the acceleration reading: how many samples are
     * averaged. More samples = less noise but more delay
     * (10 samples = 50 ms at 200 Hz). It does not affect the velocity,
     * which integrates every sample without averaging.
     * @param smoothing Smoothing level
     */
    //% block="set acceleration smoothing %smoothing"
    //% blockId=fisicabit_cin_suavizado
    //% group="4. Optional"
    //% weight=85
    //% smoothing.defl=FbAccelerometerSmoothing.Medium
    export function setSmoothing(smoothing: FbAccelerometerSmoothing): void {
        let n = smoothing
        if (n < 1) n = 1
        if (n > MAX_WINDOW) n = MAX_WINDOW
        _window = n
        _resetBuffers()
    }

    /**
     * Accelerometer range. ±2 g (default) gives the best resolution;
     * use ±4 g or ±8 g only if the measurement saturates (impacts, collisions).
     * @param range Measurement range
     */
    //% block="set accelerometer range %range"
    //% blockId=fisicabit_cin_rango
    //% group="4. Optional"
    //% weight=80
    //% range.defl=FbAccelerometerRange.Range2G
    export function setAccelerometerRange(range: FbAccelerometerRange): void {
        _rangeG = range
        if (_started) {
            _configureHardware()
            _gRefValid = false
            _refSettled = false
        }
    }

    /**
     * Keeps the gravity reference fixed (it is not corrected on its own at
     * rest). Enable it if the experiment has long pauses with the board
     * tilted relative to the calibration position.
     * @param fixed true = fixed reference, false = corrected automatically (default)
     */
    //% block="keep gravity reference fixed %fixed"
    //% blockId=fisicabit_cin_ref_fija
    //% group="4. Optional"
    //% weight=75
    //% fixed.shadow=toggleOnOff
    //% fixed.defl=false
    export function setFixedReference(fixed: boolean): void {
        _fixedRef = fixed
    }

    /**
     * Automatic zeroing of the velocity when the board is still (enabled
     * by default). Disable it only for very smooth movements at constant
     * velocity (air track) where the sensor cannot tell "still" from
     * "sliding without vibration".
     * @param enable true = set v = 0 at rest (default)
     */
    //% block="auto-zero velocity at rest %enable"
    //% blockId=fisicabit_cin_zupt
    //% group="4. Optional"
    //% weight=70
    //% enable.shadow=toggleOnOff
    //% enable.defl=true
    export function setVelocityAutoZero(enable: boolean): void {
        _zupt = enable
    }

    /**
     * Local gravity value used to convert to m/s²
     * (9.80665 by default; Montevideo ≈ 9.797).
     * @param g Local gravity in m/s², eg: 9.80665
     */
    //% block="set local gravity %g m/s²"
    //% blockId=fisicabit_cin_g_local
    //% group="4. Optional"
    //% weight=65
    //% g.min=9.7 g.max=9.9 g.defl=9.80665
    export function setLocalGravity(g: number): void {
        if (g > 9 && g < 11) _gLocal = g
        _updateFactor()
    }

    /**
     * Gravity measured by the sensor at rest, in chip counts (≈1024 per g).
     * Useful to verify the calibration: with the board still it should
     * give a stable value close to 1024.
     */
    //% block="measured gravity (counts, ≈1024)"
    //% blockId=fisicabit_cin_mod_gravedad
    //% group="4. Optional"
    //% weight=60
    export function estimatedGravityMagnitude(): number {
        _ensureStarted()
        return Math.round(_gMag)
    }

    /**
     * Sensor status: 1 = high resolution active (micro:bit v2),
     * 0 = normal mode, -1 = sensor not recognized or simulator.
     */
    //% block="high-resolution mode status"
    //% blockId=fisicabit_cin_estado_hr
    //% group="4. Optional"
    //% weight=55
    export function highResolutionStatus(): number {
        _ensureStarted()
        return _hr
    }

    // =========================================================================
    // ADVANCED
    // =========================================================================

    function _showStep6(step: number): void {
        if (step === 0) basic.showIcon(IconNames.Square)
        else if (step === 1) basic.showIcon(IconNames.SmallSquare)
        else if (step === 2) basic.showLeds(`
            . . # . .
            . # # # .
            # . # . #
            . . # . .
            . . # . .`)
        else if (step === 3) basic.showLeds(`
            . . # . .
            . . # . .
            # . # . #
            . # # # .
            . . # . .`)
        else if (step === 4) basic.showLeds(`
            . . # . .
            . # . . .
            # # # # #
            . # . . .
            . . # . .`)
        else basic.showLeds(`
            . . # . .
            . . . # .
            # # # # #
            . . . # .
            . . # . .`)
    }

    /**
     * Factory-style 6-position calibration (offset and scale of each
     * axis). The display shows an arrow: lay the board with that side
     * facing UP, still, and press A. Six times. At the end it shows ✓.
     * Corrects the zero-g error of the chip (up to ±80 mg) and the sensitivity.
     */
    //% block="calibrate 6 positions (press A at each)"
    //% blockId=fisicabit_cin_cal6
    //% group="Advanced"
    //% weight=100
    //% advanced=true
    export function calibrate6Positions(): void {
        _ensureStarted()
        // Display per step: square = display up, small square = display
        // down, arrows = logo up / logo down / left edge up / right edge up
        let px = 0, nx = 0, py = 0, ny = 0, pz = 0, nz = 0
        let okx = 0, oky = 0, okz = 0
        for (let step = 0; step < 6; step++) {
            _showStep6(step)
            while (input.buttonIsPressed(Button.A)) basic.pause(20)
            while (!input.buttonIsPressed(Button.A)) basic.pause(20)
            basic.clearScreen()
            basic.pause(300)
            let sx = 0, sy = 0, sz = 0, n = 0
            const t0 = control.millis()
            while (control.millis() - t0 < 1000) {
                sx += input.acceleration(Dimension.X)
                sy += input.acceleration(Dimension.Y)
                sz += input.acceleration(Dimension.Z)
                n++
                basic.pause(_periodMs)
            }
            const mx = sx / n, my = sy / n, mz = sz / n
            const ax = Math.abs(mx), ay = Math.abs(my), az = Math.abs(mz)
            // The dominant axis defines which face is up
            if (ax >= ay && ax >= az) { if (mx > 0) { px = mx; okx |= 1 } else { nx = mx; okx |= 2 } }
            else if (ay >= ax && ay >= az) { if (my > 0) { py = my; oky |= 1 } else { ny = my; oky |= 2 } }
            else { if (mz > 0) { pz = mz; okz |= 1 } else { nz = mz; okz |= 2 } }
            basic.showIcon(IconNames.Yes)
            basic.pause(400)
        }
        if (okx === 3 && oky === 3 && okz === 3) {
            _offX = (px + nx) / 2; _scaleX = COUNTS_PER_G / ((px - nx) / 2)
            _offY = (py + ny) / 2; _scaleY = COUNTS_PER_G / ((py - ny) / 2)
            _offZ = (pz + nz) / 2; _scaleZ = COUNTS_PER_G / ((pz - nz) / 2)
            _cal6 = true
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
        }
        basic.pause(800)
        basic.clearScreen()
        _gRefValid = false
        _refSettled = false
        resetVelocity()
    }

    /**
     * Loads a saved 6-position calibration (see "send calibration via
     * serial").
     * @param ox Offset of the X axis, in counts
     * @param oy Offset of the Y axis, in counts
     * @param oz Offset of the Z axis, in counts
     * @param sx Scale factor of the X axis, eg: 1
     * @param sy Scale factor of the Y axis, eg: 1
     * @param sz Scale factor of the Z axis, eg: 1
     */
    //% block="set calibration offX %ox offY %oy offZ %oz scaleX %sx scaleY %sy scaleZ %sz"
    //% blockId=fisicabit_cin_cal_manual
    //% group="Advanced"
    //% weight=95
    //% advanced=true
    //% sx.defl=1 sy.defl=1 sz.defl=1
    export function manualCalibration(ox: number, oy: number, oz: number, sx: number, sy: number, sz: number): void {
        _offX = ox; _offY = oy; _offZ = oz
        _scaleX = sx > 0 ? sx : 1; _scaleY = sy > 0 ? sy : 1; _scaleZ = sz > 0 ? sz : 1
        _cal6 = true
        _gRefValid = false
        _refSettled = false
    }

    /**
     * Sends the current calibration over USB as one line
     * "FB_CAL,offX,offY,offZ,scX,scY,scZ" so it can be written down and
     * loaded again with "set calibration".
     */
    //% block="send calibration via serial"
    //% blockId=fisicabit_cin_enviar_cal
    //% group="Advanced"
    //% weight=90
    //% advanced=true
    export function sendCalibrationSerial(): void {
        serial.writeLine("FB_CAL," + _offX + "," + _offY + "," + _offZ + "," + _scaleX + "," + _scaleY + "," + _scaleZ)
    }

    /**
     * Enables or disables the chip's high-resolution mode (enabled by
     * default). Only for diagnostics.
     * @param enable true = 12 bits (default), false = 10 bits
     */
    //% block="use high-resolution mode %enable"
    //% blockId=fisicabit_cin_hr
    //% group="Advanced"
    //% weight=85
    //% advanced=true
    //% enable.shadow=toggleOnOff
    //% enable.defl=true
    export function setHighResolution(enable: boolean): void {
        _highRes = enable
        if (_started) _configureHardware()
    }

    /**
     * Raw sensor acceleration in counts (≈1024 per g), averaged, without
     * calibration or gravity subtraction. For diagnostics.
     * @param axis Axis X, Y or Z
     */
    //% block="raw acceleration (counts) %axis"
    //% blockId=fisicabit_cin_cruda
    //% group="Advanced"
    //% weight=80
    //% advanced=true
    //% axis.defl=FbAccelerationAxis.Z
    export function rawAcceleration(axis: FbAccelerationAxis): number {
        _ensureStarted()
        const m = _rawMean()
        return Math.round(_component(m, axis) * 10) / 10
    }

    /**
     * Number of sensor samples processed per second (diagnostics: it
     * should match the configured rate).
     */
    //% block="samples per second"
    //% blockId=fisicabit_cin_sps
    //% group="Advanced"
    //% weight=75
    //% advanced=true
    export function samplesPerSecond(): number {
        _ensureStarted()
        const before = _samples
        basic.pause(500)
        return (_samples - before) * 2
    }

    /**
     * Converts milli-g (mg) to m/s² using the local gravity.
     * @param mg Value in mg
     */
    //% block="convert %mg mg → m/s²"
    //% blockId=fisicabit_cin_mg_a_ms2
    //% group="Advanced"
    //% weight=70
    //% advanced=true
    export function convertMgToMs2(mg: number): number {
        return _round2(mg * _gLocal / 1000)
    }

    // ── Per-axis shortcuts (compatibility with earlier projects) ──────────
    /**
     * Linear acceleration on the X axis in m/s² (shortcut).
     */
    //% block="acceleration X (m/s²)"
    //% blockId=fisicabit_cin_accel_x
    //% group="Advanced" weight=40 advanced=true
    export function accelerationX(): number { return linearAcceleration(FbAccelerationAxis.X) }
    /**
     * Linear acceleration on the Y axis in m/s² (shortcut).
     */
    //% block="acceleration Y (m/s²)"
    //% blockId=fisicabit_cin_accel_y
    //% group="Advanced" weight=39 advanced=true
    export function accelerationY(): number { return linearAcceleration(FbAccelerationAxis.Y) }
    /**
     * Linear acceleration on the Z axis in m/s² (shortcut).
     */
    //% block="acceleration Z (m/s²)"
    //% blockId=fisicabit_cin_accel_z
    //% group="Advanced" weight=38 advanced=true
    export function accelerationZ(): number { return linearAcceleration(FbAccelerationAxis.Z) }
    /**
     * Vertical linear acceleration in m/s², positive upwards (shortcut).
     */
    //% block="vertical acceleration (m/s²)"
    //% blockId=fisicabit_cin_accel_vert
    //% group="Advanced" weight=37 advanced=true
    export function verticalAcceleration(): number { return linearAcceleration(FbAccelerationAxis.Vertical) }
    /**
     * Magnitude of the linear acceleration in m/s² (shortcut).
     */
    //% block="acceleration magnitude (m/s²)"
    //% blockId=fisicabit_cin_accel_mag
    //% group="Advanced" weight=36 advanced=true
    export function accelerationMagnitude(): number { return linearAcceleration(FbAccelerationAxis.Magnitude) }

    // ── Earlier blocks (obsolete): kept so old projects still compile ─────
    /**
     * (Obsolete) Updates the gravity estimate; now the same as "calibrate at rest".
     */
    //% block="update gravity estimate"
    //% blockId=fisicabit_cin_actualizar_gravedad
    //% group="Advanced" weight=10 deprecated=true
    export function updateGravity(): void { calibrateAtRest() }
    /**
     * (Obsolete) Formerly set the gravity low-pass filter coefficient; it has no effect now.
     * @param alpha Filter coefficient (ignored)
     */
    //% block="set gravity filter α to %alpha"
    //% blockId=fisicabit_cin_fijar_alfa
    //% group="Advanced" weight=9 deprecated=true
    export function setGravityAlpha(alpha: number): void { }
    /**
     * (Obsolete) Lets the gravity reference be corrected again automatically at rest.
     */
    //% block="unlock gravity tracking"
    //% blockId=fisicabit_cin_unlock
    //% group="Advanced" weight=8 deprecated=true
    export function unlockGravity(): void { _fixedRef = false }
    /**
     * (Obsolete) Starts the built-in compass calibration (rotate the micro:bit).
     */
    //% block="calibrate magnetometer (rotate micro:bit)"
    //% blockId=fisicabit_cin_cal_mag
    //% group="Advanced" weight=7 deprecated=true
    export function calibrateMagnetometer(): void { input.calibrateCompass() }
    /**
     * (Obsolete) Compass heading in degrees, from the built-in magnetometer.
     */
    //% block="heading (°)"
    //% blockId=fisicabit_cin_heading
    //% group="Advanced" weight=6 deprecated=true
    export function heading(): number { return input.compassHeading() }
    /**
     * (Obsolete) Whether the magnetometer is calibrated; always true now.
     */
    //% block="magnetometer calibrated?"
    //% blockId=fisicabit_cin_mag_calibrado
    //% group="Advanced" weight=5 deprecated=true
    export function magnetometerCalibrated(): boolean { return true }
    /**
     * (Obsolete) Formerly enabled accelerometer + magnetometer fusion; it has no effect now.
     */
    //% block="enable dual mode (accelerometer + magnetometer)"
    //% blockId=fisicabit_cin_dual
    //% group="Advanced" weight=4 deprecated=true
    export function enableDualMode(): void { }
    /**
     * (Obsolete) Whether a magnetic disturbance was detected; always false now.
     */
    //% block="magnetic disturbance detected?"
    //% blockId=fisicabit_cin_mag_disturbed
    //% group="Advanced" weight=3 deprecated=true
    export function magnetometerDisturbed(): boolean { return false }
}
