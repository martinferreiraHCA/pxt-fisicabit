// =============================================================================
// test.ts — Test program of the fisicabit-usb package generated for fisicabit.com
// =============================================================================
// Runs in the simulator when this repository is opened as a project. It uses
// the sample program the site injects (legacy names) and the new blocks.
// Expected: "TEST 1: PASS" to "TEST 3: PASS" on the serial console, then one
// CSV line every 100 ms. Without a sensor the ultrasonic and DS18B20 tests
// report SKIP.
// =============================================================================

let failures = ""
function check(label: string, ok: boolean): void { if (!ok) failures += label + "; " }
function report(n: number, name: string): void {
    serial.writeLine("TEST " + n + " " + name + ": " + (failures == "" ? "PASS" : "FAIL(" + failures + ")"))
    failures = ""
}

// TEST 1: legacy names used by fisicabit.com still compile and run
check("format", FisicaBitDatos.formatear(3.14159, 2) == "3.14")
check("internal sensor", FisicaBitSerial.leerSensorInterno(TipoSensorInterno.AcelerometroX) >= -2048)
FisicaBitSerial.fijarDecimales(1)
FisicaBitSerial.enviarSinTiempo1(1.5)
report(1, "legacy API")

// TEST 2: ultrasonic blocks never crash without a sensor
fisicabitUltrasonic.setRange(100)
const st = fisicabitUltrasonic.status(DigitalPin.P8, DigitalPin.P12)
const d = fisicabitUltrasonic.distance(DigitalPin.P8, DigitalPin.P12, FbDistanceUnit.Meters)
check("status text", st.length > 0)
check("distance >= 0", d >= 0)
serial.writeLine("  ultrasonic status=" + st + " distance=" + d + " m" + (st.indexOf("OK") == 0 ? "" : " (SKIP: no sensor)"))
report(2, "ultrasonic blocks")

// TEST 3: DS18B20 probe on P0 (4.7 kΩ between DATA and 3V). With a probe the
// reading must be valid and between -55 and 125 °C; without one the blocks
// must return at once with error code 1 and never crash.
fisicabitDS18B20.setResolution(FbDS18B20Resolution.Bits12)
if (fisicabitDS18B20.isConnected(DigitalPin.P0)) {
    const c = fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius)
    const k = fisicabitDS18B20.lastTemperature(FbTemperatureUnit.Kelvin)
    serial.writeLine("  DS18B20 temperature=" + c + " C error=" + fisicabitDS18B20.errorCode())
    check("reading valid", fisicabitDS18B20.readingValid())
    check("error code 0", fisicabitDS18B20.errorCode() == 0)
    check("range", c >= -55 && c <= 125)
    check("kelvin", Math.abs(k - (c + 273.15)) < 0.02)
} else {
    const c = fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius)
    serial.writeLine("  DS18B20 (SKIP: no probe on P0, error code " + fisicabitDS18B20.errorCode() + ")")
    check("no probe returns 0", c == 0)
    check("no probe is invalid", !fisicabitDS18B20.readingValid())
}
report(3, "DS18B20 blocks")

basic.forever(function () {
    FisicaBitSerial.enviar1(FisicaBitSerial.leerSensorInterno(TipoSensorInterno.AcelerometroX), 100)
})
