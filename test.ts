// =============================================================================
// test.ts — Functional tests for the FisicaBit extension
// =============================================================================
// HOW TO TEST:
//   1. Import this extension in MakeCode
//   2. This file runs automatically in the simulator
//   3. For hardware tests, download the .hex to a micro:bit
//
// PASS CRITERIA:
//   - All code compiles without errors in MakeCode
//   - The simulator runs without throwing exceptions
//   - Button A shows temperature reading (number on LED)
//   - Button B shows Fahrenheit conversion (number on LED)
//
// NOTE: Only Test 1 runs by default. Uncomment other tests one at a time.
// =============================================================================


// =============================================================================
// TEST 1: INTERNAL SENSORS + TEMPERATURE CONVERSION
// =============================================================================
// PASS: Pressing A shows a number (Celsius), pressing B shows Fahrenheit.
//       No simulator errors.
// FAIL: Exception thrown or no display output.
// =============================================================================

let currentUnit = UnidadTemperatura.Celsius

input.onButtonPressed(Button.A, () => {
    let temp = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
    FisicaBit.mostrarEnLED("C", temp)
})

input.onButtonPressed(Button.B, () => {
    let tempC = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
    let tempF = FisicaBit.convertirTemperatura(
        tempC,
        UnidadTemperatura.Celsius,
        UnidadTemperatura.Fahrenheit
    )
    FisicaBit.mostrarEnLED("F", tempF)
})


// =============================================================================
// TEST 2: ANALOG SENSOR READING + VALUE MAPPING
// =============================================================================
// HARDWARE: Potentiometer on P0 (left→GND, center→P0, right→3V)
// PASS: Shows 0-100% on LED as you turn the pot. Serial outputs CSV data.
// FAIL: Exception or values outside 0-100 range.
// =============================================================================

/*
basic.forever(() => {
    let reading = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
    let percent = FisicaBit.mapearValor(reading, 0, 1023, 0, 100)
    FisicaBit.mostrarEnLED("%", percent)
    FisicaBit.serialMuestrear2(FisicaBit.tiempoSerial(), reading, 200)
})
*/


// =============================================================================
// TEST 3: ULTRASONIC SENSOR (HC-SR04)
// =============================================================================
// HARDWARE: HC-SR04 TRIG→P1, ECHO→P2, VCC→3V, GND→GND
// PASS: Shows distance in cm on LED. Reasonable values (2-300cm).
// FAIL: Always shows 0, negative values, or exception.
// =============================================================================

/*
basic.forever(() => {
    let dist = FisicaBit.medirDistanciaUltrasonido(
        DigitalPin.P1, DigitalPin.P2, UnidadDistancia.Centimetros
    )
    FisicaBit.mostrarEnLED("d", dist)
    FisicaBit.serialMuestrear2(FisicaBit.tiempoSerial(), dist, 500)
})
*/


// =============================================================================
// TEST 4: DIGITAL SENSOR (PIR)
// =============================================================================
// HARDWARE: PIR OUT→P8, VCC→3V, GND→GND (wait 30s for calibration)
// PASS: Shows surprised face on motion, happy face when still.
// FAIL: Exception or no face change when motion detected.
// =============================================================================

/*
basic.forever(() => {
    let pir = FisicaBit.leerSensorDigital(8)
    if (pir == 1) {
        basic.showIcon(IconNames.Surprised)
    } else {
        basic.showIcon(IconNames.Happy)
    }
    FisicaBit.serialMuestrear2(FisicaBit.tiempoSerial(), pir, 100)
})
*/


// =============================================================================
// TEST 5: OPTICAL BARRIER — DIGITAL (FC-33)
// =============================================================================
// HARDWARE: FC-33 #1 OUT→P1, FC-33 #2 OUT→P2, both VCC→3V, GND→GND
// PASS: Press A, pass object through barriers, shows time in ms.
//       Returns -1 on timeout (10s). Positive ms value on success.
// FAIL: Exception, always returns 0, or incorrect timing.
// =============================================================================

/*
input.onButtonPressed(Button.A, () => {
    basic.showString("?")
    let timeMs = FisicaBit.medirTiempoBarrera(
        PinAnalogico.P1, PinAnalogico.P2,
        ModoBarrera.Digital, 10000
    )
    if (timeMs < 0) {
        basic.showIcon(IconNames.No)
    } else {
        basic.showNumber(timeMs)
        serial.writeValue("time_ms", timeMs)
    }
    basic.pause(2000)
    basic.showIcon(IconNames.Target)
})
*/


// =============================================================================
// TEST 6: OPTICAL BARRIER — NATIVE C++ (high precision)
// =============================================================================
// HARDWARE: Same as Test 5
// PASS: Press A, pass object, shows time. Returns microseconds (>0).
//       In simulator, falls back to TypeScript version (returns ms*1000).
// FAIL: Returns 0 when object passes, or exception.
// =============================================================================

/*
input.onButtonPressed(Button.A, () => {
    basic.showString("?")
    let timeUs = FisicaBit.medirTiempoBarreraNativo(
        1, 2, ModoBarrera.Digital, 0, 0, 5000000
    )
    if (timeUs == 0) {
        basic.showIcon(IconNames.No)
    } else {
        let vel100 = FisicaBit.calcularVelocidad(timeUs, 100)
        basic.showNumber(Math.idiv(vel100, 100))
        serial.writeValue("time_us", timeUs)
        serial.writeValue("vel_x100", vel100)
    }
    basic.pause(2000)
    basic.showIcon(IconNames.Target)
})
*/


// =============================================================================
// TEST 7: NATIVE C++ ADC READING
// =============================================================================
// HARDWARE: Potentiometer on P0
// PASS: Shows three readings via serial: standard (0-1023),
//       native 12-bit (0-4095), averaged (0-4095). All > 0 when pot turned.
//       In simulator, native returns analogRead fallback.
// FAIL: Native always returns 0 or exception.
// =============================================================================

/*
basic.forever(() => {
    let standard = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
    let native12 = FisicaBit.leerADCNativo(0)
    let averaged = FisicaBit.leerADCPromedio(0, 16)
    FisicaBit.serialMuestrear3(standard, native12, averaged, 200)
})
*/


// =============================================================================
// TEST 8: SERIAL SAMPLING (all variants)
// =============================================================================
// PASS: Serial output shows CSV lines at the specified rate.
//       1-value: "23\n", 2-value: "0,23\n", 3-value: "0,23,512\n"
// FAIL: No serial output or malformed CSV.
// =============================================================================

/*
basic.forever(() => {
    FisicaBit.serialMuestrear3(
        FisicaBit.tiempoSerial(),
        input.temperature(),
        input.lightLevel(),
        500
    )
})
*/


// =============================================================================
// TEST 9: BLUETOOTH UART SAMPLING
// =============================================================================
// PASS: Connects via Web Bluetooth in Chrome. Receives CSV data.
//       Connection indicator shows heart on connect, X on disconnect.
// FAIL: No BLE advertisement, no data received, or exception.
// NOTE: Bluetooth disables USB serial. Cannot run with serial tests.
// =============================================================================

/*
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()
basic.forever(() => {
    FisicaBitBT.muestrear2(
        FisicaBitBT.tiempo(),
        input.temperature(),
        1000
    )
})
*/


// =============================================================================
// TEST 10: HX711 LOAD CELL — MASS AND FORCE MEASUREMENT
// =============================================================================
// HARDWARE: HX711 module DOUT→P0, SCK→P1, VCC→3V/5V, GND→GND
//           Load cell connected to HX711 (E+, E-, A+, A-)
// PASS: Initialize (~2s) shows ✓. Press A → tare (~2s) shows ✓.
//       Press A+B → calibrate with 100g (~2s).
//       Forever loop shows mass & force on serial continuously.
//       After tare, values near 0g / 0N. After calibration, accurate.
// FAIL: Exception, ✗ on init, no serial output, or random/drifting values.
// =============================================================================

/*
// on start: initialize + auto-tare
FisicaBitHX711.hx711Inicializar(DigitalPin.P0, DigitalPin.P1)
FisicaBitHX711.hx711Tarar()

// Button A: re-tare (remove all weight first)
input.onButtonPressed(Button.A, () => {
    basic.showString("T")
    FisicaBitHX711.hx711Tarar()
    basic.showIcon(IconNames.Yes)
    basic.pause(500)
    basic.clearScreen()
})

// Button A+B: calibrate with 100g (place weight, then press)
input.onButtonPressed(Button.AB, () => {
    basic.showString("C")
    FisicaBitHX711.hx711Calibrar(100)
    basic.showIcon(IconNames.Yes)
    serial.writeValue("cal_factor", FisicaBitHX711.hx711GetFactor())
    basic.pause(500)
    basic.clearScreen()
})

// Forever loop: non-blocking continuous measurement
basic.forever(() => {
    let masa = FisicaBitHX711.hx711Masa(UnidadMasa.Gramos)
    let fuerza = FisicaBitHX711.hx711Fuerza(9.81)
    serial.writeValue("mass_g", masa)
    serial.writeValue("force_N", fuerza)
})
*/
