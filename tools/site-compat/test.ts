// =============================================================================
// test.ts — Test program of the fisicabit-usb package generated for fisicabit.com
// =============================================================================
// Runs in the simulator when this repository is opened as a project. It uses
// the sample program the site injects (legacy names) and the new blocks.
// Expected: "TEST 1: PASS" and "TEST 2: PASS" on the serial console, then one
// CSV line every 100 ms. Without a sensor the ultrasonic test reports SKIP.
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

basic.forever(function () {
    FisicaBitSerial.enviar1(FisicaBitSerial.leerSensorInterno(TipoSensorInterno.AcelerometroX), 100)
})
