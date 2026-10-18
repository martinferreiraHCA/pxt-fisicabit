// =============================================================================
// tests/native-check.ts — native (C++) link check for the FisicaBit extension
// =============================================================================
// This file is NOT part of the extension (it is not listed in pxt.json).
//
// WHY: MakeCode only emits the C++ functions that a program actually uses, and
// a native function may take at most 4 parameters. A broken `//% shim=` name,
// a signature mismatch between shims.cpp / nativeShims.ts / the TypeScript
// declaration, or a 5-parameter shim is therefore only detected when a program
// calls every native module. This program calls at least one block of every
// module that has native code: ultrasonic sampler, ToF sampler and software
// I2C, DS18B20 OneWire, HX711, native photogate timer, native ADC/pulse, the
// internal-microphone audio shim, the TCS3200 period measurement and the
// accelerometer configuration used by the kinematics module.
//
// HOW TO USE
//   1. Create a new MakeCode micro:bit project and add this extension
//      (Extensions → paste the repository URL).
//   2. Replace main.ts with the content of this file.
//   3. Download (compile for hardware). PASS: the .hex builds with no error.
//      FAIL: the compiler reports a missing shim, a signature mismatch or a
//      native function with too many parameters.
//   4. Optional: flash the .hex to a micro:bit V2 with none of the sensors
//      connected; the program must run (serial lines keep coming) without
//      a crash — every native function must handle missing hardware.
//      With `pxt` installed locally: `pxt build` in a project that depends on
//      the extension must exit with code 0.
// =============================================================================

fisicabitKinematics.start()                                        // accelConfigure / accelEnsureHighRes
fisicabitToF.tofStartPrecision(FbToFModel.TOF200C, DigitalPin.P20, DigitalPin.P19, DigitalPin.P8)
fisicabitHX711.hx711Init(DigitalPin.P0, DigitalPin.P1)             // hx711ReadRawNative
fisicabitColorimeter.tcsInit()
fisicabitColorimeter.tcsSetTimeout(50)

basic.forever(function () {
    fisicabitSerial.send3(
        fisicabitUltrasonic.distance(DigitalPin.P8, DigitalPin.P12, FbDistanceUnit.Centimeters),   // usStart/usSeq/usDist...
        fisicabitToF.tofDistance(FbToFModel.TOF400C, DigitalPin.P14, DigitalPin.P13, FbDistanceUnit.Centimeters), // swi2c*/tof*
        fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius),                     // ds18b20Read
        100)
    fisicabitUltrasonic.sendDistanceSRF05(DigitalPin.P1, DigitalPin.P2, FbDistanceUnit.Centimeters, FbChannel.USB)
    fisicabitToF.tofSendDistance(FbToFModel.Auto, DigitalPin.P20, DigitalPin.P19, FbDistanceUnit.Millimeters, FbChannel.Bluetooth)
    fisicabitKinematics.sendVelocityAcceleration(FbAccelerationAxis.Magnitude, FbChannel.USB, 100)
    basic.showString(fisicabitUltrasonic.status(DigitalPin.P8, DigitalPin.P12))                    // usStats/usEcho
    fisicabitUltrasonic.calibrate(DigitalPin.P8, DigitalPin.P12, 300)
    fisicabitToF.tofCalibrateOffset(DigitalPin.P20, DigitalPin.P19, 100)
    fisicabitSerial.send4(
        fisicabit.measureGateTimeNative(1, 2, FbGateMode.Digital, 512, 512, 500000),              // gateNative
        fisicabit.readAdcNative(0) + fisicabit.readAdcAveraged(0, 8) + fisicabit.measurePulseNative(8, true, 1000),
        fisicabitHX711.hx711Raw(),
        fisicabitColorimeter.tcsReadChannel(FbTCS230Channel.Red) + fisicabitColorimeter.tcsReadAveraged(FbTCS230Channel.Clear, 3), // tcs3200ReadPeriodUs / tcs3200ReadBurstUs
        100)
    fisicabitSerial.send2(
        fisicabitSound.detectFrequency(),                                                            // audioInternalDetectFrequency
        fisicabitDS18B20.errorCode() + fisicabitDS18B20.errorCode(),                                 // ds18b20Error
        100)
    basic.showNumber(fisicabitToF.tofActualSampleRate(DigitalPin.P20, DigitalPin.P19) + fisicabitUltrasonic.actualSampleRate(DigitalPin.P8, DigitalPin.P12))
})
