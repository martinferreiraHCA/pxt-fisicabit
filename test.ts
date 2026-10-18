// =============================================================================
// test.ts — Functional test suite for the FisicaBit extension
// =============================================================================
//
// HOW TO RUN
//   1. Open this repository as a project in MakeCode for micro:bit (Import →
//      Import URL, or `pxt serve` in the repository). test.ts is listed under
//      "testFiles" in pxt.json, so it compiles with the extension and runs
//      automatically in the simulator.
//   2. Open the serial console ("Show console Simulator"). Every test prints
//      one machine-readable line:
//          TEST <n> <name>: PASS | FAIL(<details>) | SKIP(<reason>)
//   3. Hardware: download the .hex to a micro:bit V2 and open a serial terminal
//      at 115200 baud (fisicabit.com, "Show console Device" or any terminal).
//
// WHAT THE DISPLAY SHOWS
//   - At start the pure-logic tests (1-4) run automatically; the display then
//     shows the number of the selected test.
//   - Button A: select the next test (wraps around).
//   - Button B: run the selected test. Tick (✓) = PASS, cross (✗) = FAIL,
//     small square = SKIP; then the test number is shown again.
//   - Button A+B: print a summary on serial (one line per test plus the
//     PASS/FAIL/SKIP/not-run counts) and scroll "P:<passed>" "F:<failed>".
//
// PASS / FAIL CRITERIA
//   - Tests 1-4 are pure logic (unit conversions, CSV formatting, acoustics,
//     suggested pins) compared against exact expected values. FAIL = the
//     extension no longer computes the documented formula.
//   - Tests 5-8 and 17 use only the micro:bit (internal sensors, unconnected
//     pins, USB, accelerometer, microphone). PASS = values in their
//     documented ranges and no crash. Keep the board still in test 8.
//   - Tests 9-16 need an external sensor on the pins named in the test. With
//     the sensor: PASS when the reading is plausible. Without it: SKIP(<reason>)
//     and never a crash or hang — a FAIL or a simulator error with no sensor
//     connected is a regression. In the simulator the DS18B20 and HX711
//     fallbacks return synthetic readings (25 °C, mid-scale raw) → PASS.
//   - An exception stops the program: the simulator shows the error and no
//     further TEST lines appear. That counts as FAIL.
//
// Every namespace of the extension is exercised at least once (see TEST_NAMES).
// =============================================================================

const TEST_NAMES = [
    "fisicabit conversions", "fisicabitData format+Sampler", "fisicabitSound acoustics math",
    "fisicabitToF suggested pins", "fisicabit internal+analog sensors", "fisicabit photogate helpers",
    "fisicabitSerial USB sending", "fisicabitKinematics accelerometer",
    "fisicabitUltrasonic HC-SR04 P8/P12", "fisicabitToF laser SDA P20 SCL P19", "fisicabitDS18B20 probe P0",
    "fisicabitMAX6675 SCK P13 CS P16 SO P14", "fisicabitDHT11 DATA P16", "fisicabitBME280 I2C 0x76",
    "fisicabitHX711 DOUT P0 SCK P1", "fisicabitColorimeter TCS230", "fisicabitSound+AudioNative mic"
]
const TEST_COUNT = TEST_NAMES.length
const ST_NOT_RUN = -1, ST_PASS = 0, ST_FAIL = 1, ST_SKIP = 2

let results: number[] = []
for (let i = 0; i < TEST_COUNT; i++) results.push(ST_NOT_RUN)
let selected = 0, loopCount = 0
let failures = "", skipReason = ""

// ── Assertion helpers: they accumulate failure details in `failures` ─────────
function expectEq(label: string, got: number, want: number): void { if (got != want) failures += label + "=" + got + " want " + want + "; " }
function expectNear(label: string, got: number, want: number, tol: number): void { if (!(Math.abs(got - want) <= tol)) failures += label + "=" + got + " want " + want + "±" + tol + "; " }
function expectStr(label: string, got: string, want: string): void { if (got != want) failures += label + "='" + got + "' want '" + want + "'; " }
function expectTrue(label: string, cond: boolean): void { if (!cond) failures += label + "; " }
function skip(reason: string): number { skipReason = reason; return ST_SKIP }
function verdict(): number { return failures.length == 0 ? ST_PASS : ST_FAIL }

// ── TEST 1: fisicabit conversions (exact values) ─────────────────────────────
function test1(): number {
    expectEq("100C->F", fisicabit.convertTemperature(100, FbTemperatureUnit.Celsius, FbTemperatureUnit.Fahrenheit), 212)
    expectEq("212F->C", fisicabit.convertTemperature(212, FbTemperatureUnit.Fahrenheit, FbTemperatureUnit.Celsius), 100)
    expectEq("0C->K", fisicabit.convertTemperature(0, FbTemperatureUnit.Celsius, FbTemperatureUnit.Kelvin), 273)
    expectEq("300K->C", fisicabit.convertTemperature(300, FbTemperatureUnit.Kelvin, FbTemperatureUnit.Celsius), 27)
    expectEq("-40C->F", fisicabit.convertTemperature(-40, FbTemperatureUnit.Celsius, FbTemperatureUnit.Fahrenheit), -40)
    // convertTime returns ms×100 and s×100 (two implied decimals)
    expectEq("us", fisicabit.convertTime(1234567, FbTimeUnit.Microseconds), 1234567)
    expectEq("ms x100", fisicabit.convertTime(1234567, FbTimeUnit.Milliseconds), 123456)
    expectEq("s x100", fisicabit.convertTime(1234567, FbTimeUnit.Seconds), 123)
    expectEq("map mid", fisicabit.mapValue(512, 0, 1023, 0, 100), 50)
    expectEq("map min", fisicabit.mapValue(0, 0, 1023, -50, 50), -50)
    expectEq("map max", fisicabit.mapValue(1023, 0, 1023, 0, 100), 100)
    // computeSpeed returns m/s×100: 100 mm in 50 ms = 2.00 m/s
    expectEq("speed 2m/s", fisicabit.computeSpeed(50000, 100), 200)
    expectEq("speed 1m/s", fisicabit.computeSpeed(1000000, 1000), 100)
    expectEq("speed t=0", fisicabit.computeSpeed(0, 100), 0)
    return verdict()
}

// ── TEST 2: fisicabitData.format and Sampler (exact values) ──────────────────
function test2(): number {
    expectStr("3.14159/2", fisicabitData.format(3.14159, 2), "3.14")
    expectStr("2.5/2", fisicabitData.format(2.5, 2), "2.5")
    expectStr("-1.25/2", fisicabitData.format(-1.25, 2), "-1.25")
    expectStr("1.10/2", fisicabitData.format(1.10, 2), "1.1")
    expectStr("int/3", fisicabitData.format(7, 3), "7")
    expectStr("1.7/0", fisicabitData.format(1.7, 0), "2")
    expectEq("MIN_PERIOD_MS", fisicabitData.MIN_PERIOD_MS, 5)
    expectEq("MAX_PERIOD_MS", fisicabitData.MAX_PERIOD_MS, 60000)
    let s = new fisicabitData.Sampler()
    expectEq("default period", s.periodMs, 100)
    s.setPeriod(1)
    expectEq("period clamp low", s.periodMs, fisicabitData.MIN_PERIOD_MS)
    s.setPeriod(999999)
    expectEq("period clamp high", s.periodMs, fisicabitData.MAX_PERIOD_MS)
    s.decimals = 1
    expectStr("line no time", s.line([1.5, 2.26], false), "1.5,2.3")
    s.resetTime()
    expectTrue("time after reset < 50 ms", s.time() >= 0 && s.time() < 50)
    let l = s.line([3], true)
    expectTrue("line with time ends in ,3", l.length >= 3 && l.substr(l.length - 2, 2) == ",3")
    return verdict()
}

// ── TEST 3: fisicabitSound acoustics math (exact values) ─────────────────────
function test3(): number {
    expectStr("A4", fisicabitSound.noteName(440), "A4")
    expectStr("C4", fisicabitSound.noteName(261.63), "C4")
    expectStr("A5", fisicabitSound.noteName(880), "A5")
    expectTrue("out-of-range note non-empty", fisicabitSound.noteName(5).length > 0)
    expectEq("detune A4", fisicabitSound.detuneCents(440), 0)
    expectEq("midi 69", fisicabitSound.midiNoteFrequency(69), 440)
    expectEq("midi 57", fisicabitSound.midiNoteFrequency(57), 220)
    // c = 331.3 + 0.606·T → 343.42 m/s at 20 °C
    expectNear("c(20)", fisicabitSound.speedOfSoundInAir(20), 343.42, 0.01)
    expectNear("c(0)", fisicabitSound.speedOfSoundInAir(0), 331.3, 0.01)
    // Source approaching: v = c·(1 − f0/f) = 340·(1 − 440/460) = 14.78 m/s
    expectNear("doppler source", fisicabitSound.dopplerVelocity(440, 460, 340,
        FbDopplerVariable.SourceVelocity, FbSpeedUnit.MetersPerSecond), 14.78, 0.01)
    // Observer approaching: v = c·(f/f0 − 1) = 34.3 m/s = 123.48 km/h
    expectNear("doppler observer km/h", fisicabitSound.dopplerVelocity(1000, 1100, 343,
        FbDopplerVariable.ObserverVelocity, FbSpeedUnit.KilometersPerHour), 123.48, 0.01)
    expectNear("expected f", fisicabitSound.expectedDopplerFrequency(1000, 0, 34.3, 343), 1100, 0.01)
    expectEq("expected f at rest", fisicabitSound.expectedDopplerFrequency(440, 0, 0, 343), 440)
    return verdict()
}

// ── TEST 4: fisicabitToF suggested pins (exact strings) ──────────────────────
function test4(): number {
    expectStr("sensor 1", fisicabitToF.tofSuggestedPins(1), "SDA P20 SCL P19")
    expectStr("sensor 2", fisicabitToF.tofSuggestedPins(2), "SDA P14 SCL P13")
    expectStr("sensor 3", fisicabitToF.tofSuggestedPins(3), "SDA P16 SCL P15")
    return verdict()
}

// ── TEST 5: fisicabit internal sensors, pins, NTC formula, native ADC ────────
// No wiring. PASS: every value inside its documented range.
function test5(): number {
    let t = fisicabit.readInternalSensor(FbInternalSensor.Temperature)
    let light = fisicabit.readInternalSensor(FbInternalSensor.LightLevel)
    let az = fisicabit.readInternalSensor(FbInternalSensor.AccelerometerZ)
    let a = fisicabit.readAnalogSensor(FbAnalogPin.P0)
    let d = fisicabit.readDigitalSensor(8)
    let ntc = fisicabit.readNtcTemperature(FbAnalogPin.P1, FbTemperatureUnit.Celsius)
    let adc = fisicabit.readAdcNative(0)
    let avg = fisicabit.readAdcAveraged(0, 4)
    serial.writeLine("  temp=" + t + " light=" + light + " accZ=" + az + " P0=" + a + " P8=" + d + " ntc=" + ntc + " adc=" + adc + " avg=" + avg)
    expectTrue("temperature -40..105 C", t >= -40 && t <= 105)
    expectTrue("light 0..255", light >= 0 && light <= 255)
    expectTrue("accel Z -2048..2048 mg", az >= -2048 && az <= 2048)
    expectTrue("analog P0 0..1023", a >= 0 && a <= 1023)
    expectTrue("digital P8 0/1", d == 0 || d == 1)
    expectTrue("NTC result is a finite number", ntc == ntc && ntc > -300 && ntc < 1000)
    expectTrue("native ADC 0..4095", adc >= 0 && adc <= 4095)
    expectTrue("averaged ADC 0..4095", avg >= 0 && avg <= 4095)
    expectTrue("pulse >= 0", fisicabit.measurePulseNative(8, true, 1000) >= 0)
    return verdict()
}

// ── TEST 6: fisicabit photogate helpers with a 200 ms timeout ────────────────
// No wiring: with no object crossing, every call must return its timeout value
// (-1 or 0) within about twice the timeout. With FC-33 gates on P1/P2 a
// crossing returns a positive time instead (also accepted).
function test6(): number {
    fisicabit.setGateThreshold("A", 512)
    let raw = fisicabit.readGateRaw(FbAnalogPin.P1, FbGateMode.Analog)
    expectTrue("raw 0..1023", raw >= 0 && raw <= 1023)
    let active = fisicabit.gateActivated(FbAnalogPin.P1, FbGateMode.Digital)
    expectTrue("activated is boolean", active == true || active == false)
    let t0 = control.millis()
    let ms = fisicabit.measureGateTime(FbAnalogPin.P1, FbAnalogPin.P2, FbGateMode.Digital, 200)
    expectTrue("gate time -1 or >=0", ms == -1 || ms >= 0)
    expectTrue("returned within 2x timeout", control.millis() - t0 < 700)
    t0 = control.millis()
    let us = fisicabit.measureGateTimeNative(1, 2, FbGateMode.Digital, 512, 512, 200000)
    expectTrue("native gate time >= 0", us >= 0)
    expectTrue("native returned within 2x timeout", control.millis() - t0 < 700)
    let block = fisicabit.measureBlockTime(FbAnalogPin.P1, FbGateMode.Digital, 200)
    expectTrue("block time -1 or >=0", block == -1 || block >= 0)
    return verdict()
}

// ── TEST 7: fisicabitSerial CSV lines over USB ───────────────────────────────
// PASS: no crash, sampleLoop body ran. On the console, lines "t,v..." appear
// between the TEST lines (time in ms first, values with 1 decimal).
function test7(): number {
    fisicabitSerial.setDecimals(1)
    fisicabitSerial.setRate(FbSampleRate.Hz100)
    fisicabitSerial.setInterval(10)
    fisicabitSerial.sendTimestamp(true)
    fisicabitSerial.resetTime()
    fisicabitSerial.send1(1.25, 10)
    fisicabitSerial.send2(1, 2, 10)
    fisicabitSerial.send3(1, 2, 3, 10)
    fisicabitSerial.send4(1, 2, 3, 4, 10)
    fisicabitSerial.sendWithoutTime1(5)
    fisicabitSerial.sendWithoutTime2(5, 6)
    fisicabitSerial.sendWithoutTime3(5, 6, 7)
    fisicabitSerial.sendWithoutTime4(5, 6, 7, 8)
    fisicabitSerial.sendLine("# free text line")
    let t = fisicabitSerial.time()
    expectTrue("serial time 0..2000 ms", t >= 0 && t < 2000)
    fisicabitSerial.sampleLoop(50, () => { loopCount += 1 })   // background loop, tiny body
    basic.pause(200)
    expectTrue("sampleLoop ran", loopCount > 0)
    fisicabitSerial.setDecimals(2)
    return verdict()
}

// ── TEST 8: fisicabitKinematics precision accelerometer (keep the board still)
// PASS: after calibration at rest, |a| < 2 m/s², |v| < 0.5 m/s, at rest, valid
// pitch/roll, 1000 mg = 9.81 m/s². Takes ~2 s.
function test8(): number {
    fisicabitKinematics.setRate(FbAccelerometerRate.Hz200)
    fisicabitKinematics.setSmoothing(FbAccelerometerSmoothing.Medium)
    fisicabitKinematics.start()
    fisicabitKinematics.calibrateAtRest()
    let a = fisicabitKinematics.linearAcceleration(FbAccelerationAxis.Vertical)
    let v = fisicabitKinematics.instantaneousVelocity(FbAccelerationAxis.Vertical)
    let rest = fisicabitKinematics.isAtRest()
    let p = fisicabitKinematics.pitch()
    let r = fisicabitKinematics.roll()
    serial.writeLine("  a=" + a + " v=" + v + " rest=" + rest + " pitch=" + p + " roll=" + r)
    expectTrue("|a vertical| < 2 m/s2", Math.abs(a) < 2)
    expectTrue("|v| < 0.5 m/s", Math.abs(v) < 0.5)
    expectTrue("at rest", rest)
    expectTrue("pitch -90..90", p >= -90 && p <= 90)
    expectTrue("roll -180..180", r >= -180 && r <= 180)
    expectNear("1000 mg -> 9.81 m/s2", fisicabitKinematics.convertMgToMs2(1000), 9.81, 0.05)
    return verdict()
}

// ── TEST 9: fisicabitUltrasonic HC-SR04 / HY-SRF05 on TRIG P8, ECHO P12 ─────
// PASS: status starts with "OK" and distance 2..600 cm.
// SKIP: status "NO ECHO" / "ECHO HIGH" (no sensor or miswired).
function test9(): number {
    fisicabitUltrasonic.setRange(300)
    fisicabitUltrasonic.setAirTemperature(20)
    fisicabitUltrasonic.setFilter(FbUltrasonicFilter.Light)
    let status = fisicabitUltrasonic.status(DigitalPin.P8, DigitalPin.P12)
    let cm = fisicabitUltrasonic.distance(DigitalPin.P8, DigitalPin.P12, FbDistanceUnit.Centimeters)
    serial.writeLine("  status='" + status + "' distance=" + cm + " cm valid=" + fisicabitUltrasonic.echoValid())
    if (status.substr(0, 2) != "OK") return skip(status)
    expectTrue("distance 2..600 cm", cm >= 2 && cm <= 600)
    return verdict()
}

// ── TEST 10: fisicabitToF laser sensor on SDA P20, SCL P19 ───────────────────
// PASS: sensor found, module name not "none", distance 0..4000 mm. SKIP: no sensor.
function test10(): number {
    let found = fisicabitToF.tofSensorFound(DigitalPin.P20, DigitalPin.P19)
    let module = fisicabitToF.tofDetectedModule(DigitalPin.P20, DigitalPin.P19)
    let mm = fisicabitToF.tofDistance(FbToFModel.Auto, DigitalPin.P20, DigitalPin.P19, FbDistanceUnit.Millimeters)
    serial.writeLine("  found=" + found + " module='" + module + "' distance=" + mm + " mm")
    if (!found) return skip("no ToF sensor (" + module + ")")
    expectTrue("module detected", module != "none")
    expectTrue("distance 0..4000 mm", mm >= 0 && mm <= 4000)
    return verdict()
}

// ── TEST 11: fisicabitDS18B20 probe on P0 (4.7 kΩ pull-up) ───────────────────
// PASS: connected, -55..125 °C, valid, error code 0. SKIP: probe not connected.
function test11(): number {
    fisicabitDS18B20.setResolution(FbDS18B20Resolution.Bits12)
    if (!fisicabitDS18B20.isConnected(DigitalPin.P0)) return skip("no DS18B20, error code " + fisicabitDS18B20.errorCode())
    let c = fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius)
    serial.writeLine("  temperature=" + c + " C error=" + fisicabitDS18B20.errorCode())
    expectTrue("temperature -55..125 C", c >= -55 && c <= 125)
    expectTrue("reading valid", fisicabitDS18B20.readingValid())
    expectEq("error code", fisicabitDS18B20.errorCode(), 0)
    return verdict()
}

// ── TEST 12: fisicabitMAX6675 thermocouple, SCK P13, CS P16, SO P14 ──────────
// PASS: connected, -20..1024 °C, error code 0. SKIP: module not connected.
function test12(): number {
    if (!fisicabitMAX6675.isConnected(DigitalPin.P13, DigitalPin.P16, DigitalPin.P14)) {
        return skip("no MAX6675, error code " + fisicabitMAX6675.errorCode() + " raw " + fisicabitMAX6675.rawValue())
    }
    let c = fisicabitMAX6675.temperature(DigitalPin.P13, DigitalPin.P16, DigitalPin.P14, FbTemperatureUnit.Celsius)
    serial.writeLine("  temperature=" + c + " C error=" + fisicabitMAX6675.errorCode())
    expectTrue("temperature -20..1024 C", c >= -20 && c <= 1024)
    expectEq("error code", fisicabitMAX6675.errorCode(), 0)
    return verdict()
}

// ── TEST 13: fisicabitDHT11, DATA on P16 ─────────────────────────────────────
// PASS: valid reading, humidity 0..100 %, temperature 0..50 °C. SKIP: no sensor.
function test13(): number {
    fisicabitDHT11.dht11Read(DigitalPin.P16)
    if (!fisicabitDHT11.dht11Valid()) return skip("no DHT11 reading (checksum/timeout)")
    let h = fisicabitDHT11.dht11LastHumidity()
    let c = fisicabitDHT11.dht11LastTemperature(FbTemperatureUnit.Celsius)
    serial.writeLine("  humidity=" + h + " % temperature=" + c + " C")
    expectTrue("humidity 0..100", h >= 0 && h <= 100)
    expectTrue("temperature 0..50 C", c >= 0 && c <= 50)
    return verdict()
}

// ── TEST 14: fisicabitBME280 on I2C (SCL P19, SDA P20) at 0x76 ───────────────
// PASS: chip found, -40..85 °C, 300..1100 hPa. SKIP: chip ID not found.
function test14(): number {
    fisicabitBME280.bme280Init(FbBME280Address.Addr76)
    if (!fisicabitBME280.bme280Connected()) return skip("no BME280 at 0x76")
    let c = fisicabitBME280.bme280Temperature(FbTemperatureUnit.Celsius)
    let hpa = fisicabitBME280.bme280Pressure(FbPressureUnit.hPa)
    serial.writeLine("  temperature=" + c + " C pressure=" + hpa + " hPa humidity=" + fisicabitBME280.bme280Humidity() + " %")
    expectTrue("temperature -40..85 C", c >= -40 && c <= 85)
    expectTrue("pressure 300..1100 hPa", hpa >= 300 && hpa <= 1100)
    return verdict()
}

// ── TEST 15: fisicabitHX711 load cell, DOUT P0, SCK P1 (~2-3 s) ──────────────
// PASS: connected and 24-bit raw value 1..16777215. SKIP: no data on DOUT.
function test15(): number {
    fisicabitHX711.hx711Init(DigitalPin.P0, DigitalPin.P1)
    if (!fisicabitHX711.hx711Connected()) return skip("no HX711 data (DOUT stays high)")
    let raw = fisicabitHX711.hx711Raw()
    serial.writeLine("  raw=" + raw + " calibrated=" + fisicabitHX711.hx711Calibrated())
    expectTrue("raw 1..16777215", raw > 0 && raw < 16777216)
    return verdict()
}

// ── TEST 16: fisicabitColorimeter TCS230 (S0 P13 S1 P14 S2 P15 S3 P9 OUT P1) ─
// PASS: a period 1..50000 µs measured on OUT with a 50 ms timeout.
// SKIP: in the simulator (the native period shim has no simulator
// implementation) or when OUT carries no signal (timeout → 0).
function test16(): number {
    fisicabitColorimeter.tcsInit()
    fisicabitColorimeter.tcsSetScaling(FbTCS230Scaling.Scale20)
    fisicabitColorimeter.tcsSetSamples(1)
    fisicabitColorimeter.tcsSetTimeout(50)
    expectEq("last value before any read", fisicabitColorimeter.tcsValue(FbTCS230Channel.Red), 0)
    // In the simulator the period shim returns 0 (no signal) and the test is skipped below.
    let period = fisicabitColorimeter.tcsReadChannel(FbTCS230Channel.Red)
    serial.writeLine("  red period=" + period + " us")
    if (period == 0) return skip("no signal on OUT (timeout)")
    expectTrue("period 1..50000 us", period > 0 && period <= 50000)
    return verdict()
}

// ── TEST 17: fisicabitSound + fisicabitAudioNative, internal V2 microphone ───
// PASS: window captured, RMS 0..512, frequency 0..5000 Hz, non-empty note,
// 64-sample buffer. Simulator: the frequency shim returns a 440 Hz test tone.
function test17(): number {
    fisicabitSound.setSource(FbMicrophoneSource.InternalV2)
    fisicabitSound.setWindow(FbAudioSampleRate.F8kHz, FbAudioBufferSize.N64)
    fisicabitSound.setFrequencyRange(60, 4500)
    let captured = fisicabitSound.captureWindow()
    let rms = fisicabitSound.rmsAmplitude()
    let level = fisicabitSound.internalSoundLevelV2()
    let f = fisicabitSound.detectFrequency()
    let note = fisicabitSound.detectNote()
    serial.writeLine("  captured=" + captured + " rms=" + rms + " level=" + level + " f=" + f + " Hz note=" + note)
    expectTrue("window captured", captured)
    expectTrue("rms 0..512", rms >= 0 && rms <= 512)
    expectTrue("level 0..255", level >= 0 && level <= 255)
    expectTrue("frequency 0..5000 Hz", f >= 0 && f <= 5000)
    expectTrue("note name non-empty", note.length > 0)
    let dc = fisicabitAudioNative.audioSampleInternal(64)
    expectEq("buffer length", fisicabitAudioNative.audioBufferLength(), 64)
    expectTrue("dc offset 0..255", dc >= 0 && dc <= 255)
    expectTrue("audio rms >= 0", fisicabitAudioNative.audioRms() >= 0)
    expectTrue("peak-to-peak >= 0", fisicabitAudioNative.audioPeakToPeak() >= 0)
    return verdict()
}

// ── Runner, menu and summary ─────────────────────────────────────────────────
const TESTS: (() => number)[] = [
    test1, test2, test3, test4, test5, test6, test7, test8,
    test9, test10, test11, test12, test13, test14, test15, test16, test17
]

function statusText(st: number): string {
    if (st == ST_PASS) return "PASS"
    if (st == ST_FAIL) return "FAIL(" + failures + ")"
    return st == ST_SKIP ? "SKIP(" + skipReason + ")" : "NOT RUN"
}
function showSelected(): void { basic.showNumber(selected + 1) }

function runTest(i: number): void {
    failures = ""; skipReason = ""
    serial.writeLine("TEST " + (i + 1) + " " + TEST_NAMES[i] + ": running")
    let st = TESTS[i]()
    results[i] = st
    serial.writeLine("TEST " + (i + 1) + " " + TEST_NAMES[i] + ": " + statusText(st))
    if (st == ST_PASS) basic.showIcon(IconNames.Yes)
    else if (st == ST_FAIL) basic.showIcon(IconNames.No)
    else basic.showIcon(IconNames.SmallSquare)
    basic.pause(800)
    showSelected()
}

function printSummary(): void {
    let pass = 0, fail = 0, skipped = 0, notRun = 0
    serial.writeLine("SUMMARY")
    for (let i = 0; i < TEST_COUNT; i++) {
        let r = results[i]
        let txt = "NOT RUN"
        if (r == ST_PASS) { pass++; txt = "PASS" }
        else if (r == ST_FAIL) { fail++; txt = "FAIL" }
        else if (r == ST_SKIP) { skipped++; txt = "SKIP" }
        else notRun++
        serial.writeLine("  " + (i + 1) + " " + TEST_NAMES[i] + ": " + txt)
    }
    serial.writeLine("SUMMARY pass=" + pass + " fail=" + fail + " skip=" + skipped + " notrun=" + notRun)
    fisicabit.showOnLeds("P", pass)
    fisicabit.showOnLeds("F", fail)
    showSelected()
}

input.onButtonPressed(Button.A, () => { selected = (selected + 1) % TEST_COUNT; showSelected() })
input.onButtonPressed(Button.B, () => { runTest(selected) })
input.onButtonPressed(Button.AB, () => { printSummary() })

// On start: run the pure-logic tests (1-4), then show the menu
serial.writeLine("FisicaBit test suite, hardware version " + control.hardwareVersion() + ", " + TEST_COUNT + " tests")
for (let i = 0; i < 4; i++) runTest(i)
showSelected()
