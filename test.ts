// =============================================================================
// test.ts — Pruebas funcionales de la extensión FisicaBit
// =============================================================================
// CÓMO PROBAR:
//   1. Importar esta extensión en MakeCode
//   2. Este archivo se ejecuta automáticamente en el simulador
//   3. Para probar en hardware, descargar el .hex a un micro:bit
//
// CRITERIOS DE ÉXITO:
//   - Todo el código compila sin errores en MakeCode
//   - El simulador corre sin lanzar excepciones
//   - El botón A muestra la temperatura (número en los LED)
//   - El botón B muestra la conversión a Fahrenheit (número en los LED)
//
// NOTA: Sólo la Prueba 1 corre por defecto. Descomentar las demás de a una.
// =============================================================================


// =============================================================================
// PRUEBA 1: SENSORES INTERNOS + CONVERSIÓN DE TEMPERATURA
// =============================================================================
// ÉXITO: Al apretar A se muestra un número (Celsius), al apretar B Fahrenheit.
//        Sin errores en el simulador.
// FALLA: Excepción o nada en la pantalla.
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
// PRUEBA 2: LECTURA DE SENSOR ANALÓGICO + MAPEO DE VALORES
// =============================================================================
// HARDWARE: Potenciómetro en P0 (izquierda→GND, centro→P0, derecha→3V)
// ÉXITO: Muestra 0-100% en los LED al girar el potenciómetro. Salen datos CSV por serial.
// FALLA: Excepción o valores fuera del rango 0-100.
// =============================================================================

/*
basic.forever(() => {
    let reading = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
    let percent = FisicaBit.mapearValor(reading, 0, 1023, 0, 100)
    FisicaBit.mostrarEnLED("%", percent)
    FisicaBitSerial.enviar1(reading)
})
*/


// =============================================================================
// PRUEBA 3: SENSOR ULTRASÓNICO (HC-SR04)
// =============================================================================
// HARDWARE: HC-SR04 TRIG→P1, ECHO→P2, VCC→3V, GND→GND
// ÉXITO: Muestra la distancia en cm en los LED. Valores razonables (2-300 cm).
// FALLA: Siempre 0, valores negativos o excepción.
// =============================================================================

/*
basic.forever(() => {
    let dist = FisicaBit.medirDistanciaUltrasonido(
        DigitalPin.P1, DigitalPin.P2, UnidadDistancia.Centimetros
    )
    FisicaBit.mostrarEnLED("d", dist)
    FisicaBitSerial.enviar1(dist)
})
*/


// =============================================================================
// PRUEBA 4: SENSOR DIGITAL (PIR)
// =============================================================================
// HARDWARE: PIR OUT→P8, VCC→3V, GND→GND (esperar 30 s de calibración)
// ÉXITO: Cara de sorpresa al detectar movimiento, cara feliz en reposo.
// FALLA: Excepción o la cara no cambia al haber movimiento.
// =============================================================================

/*
basic.forever(() => {
    let pir = FisicaBit.leerSensorDigital(8)
    if (pir == 1) {
        basic.showIcon(IconNames.Surprised)
    } else {
        basic.showIcon(IconNames.Happy)
    }
    FisicaBitSerial.enviar1(pir)
})
*/


// =============================================================================
// PRUEBA 5: BARRERA ÓPTICA — DIGITAL (FC-33)
// =============================================================================
// HARDWARE: FC-33 #1 OUT→P1, FC-33 #2 OUT→P2, ambos VCC→3V, GND→GND
// ÉXITO: Apretar A, pasar un objeto por las barreras, muestra el tiempo en ms.
//        Devuelve -1 si vence el timeout (10 s). Valor positivo en ms si funciona.
// FALLA: Excepción, siempre devuelve 0 o tiempos incorrectos.
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
// PRUEBA 6: BARRERA ÓPTICA — C++ NATIVO (alta precisión)
// =============================================================================
// HARDWARE: Igual que la Prueba 5
// ÉXITO: Apretar A, pasar un objeto, muestra el tiempo. Devuelve microsegundos (>0).
//        En el simulador usa la versión TypeScript (devuelve ms*1000).
// FALLA: Devuelve 0 al pasar el objeto, o excepción.
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
// PRUEBA 7: LECTURA ADC EN C++ NATIVO
// =============================================================================
// HARDWARE: Potenciómetro en P0
// ÉXITO: Muestra tres lecturas por serial: estándar (0-1023),
//        nativa 12 bits (0-4095), promediada (0-4095). Todas > 0 al girar el pote.
//        En el simulador la nativa usa analogRead como respaldo.
// FALLA: La nativa siempre devuelve 0 o excepción.
// =============================================================================

/*
basic.forever(() => {
    let standard = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
    let native12 = FisicaBit.leerADCNativo(0)
    let averaged = FisicaBit.leerADCPromedio(0, 16)
    FisicaBitSerial.enviar3(standard, native12, averaged)
})
*/


// =============================================================================
// PRUEBA 8: ENVÍO POR USB A fisicabit.com (un bloque + frecuencia de muestreo)
// =============================================================================
// ÉXITO: Abrir fisicabit.com, conectar por USB. Llegan líneas CSV con el
//        tiempo del micro:bit primero: "0,23,120", "100,23,121", ... a 10 Hz.
//        El tiempo arranca en 0 y avanza ~100 ms por línea.
// FALLA: Sin salida serial, CSV malformado o intervalo de muestreo incorrecto.
// =============================================================================

/*
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
basic.forever(() => {
    FisicaBitSerial.enviar2(input.temperature(), input.lightLevel())
})
*/


// =============================================================================
// PRUEBA 8b: BUCLE DE MUESTREO RÁPIDO POR USB (50 Hz, sin retardo de forever)
// =============================================================================
// ÉXITO: fisicabit.com muestra ~50 Hz con pasos estables de 20 ms.
// FALLA: Frecuencia muy por debajo de 50 Hz o tiempos irregulares.
// =============================================================================

/*
FisicaBitSerial.bucleMuestreo(FrecuenciaMuestreo.Hz50, () => {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
*/


// =============================================================================
// PRUEBA 9: ENVÍO POR BLUETOOTH A fisicabit.com
// =============================================================================
// ÉXITO: Los LED muestran la diana mientras espera y el corazón cuando
//        fisicabit.com se conecta (Chrome/Edge, Web Bluetooth). Llegan datos CSV
//        a 10 Hz con el tiempo arrancando en 0 en cada conexión. No se envía nada
//        desconectado; los datos vuelven solos al reconectar.
// FALLA: No se anuncia por BLE, no llegan datos o excepción.
// NOTA: Bluetooth y Radio no pueden convivir en el mismo programa.
// =============================================================================

/*
FisicaBitBT.inicioRapido()
FisicaBitBT.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
basic.forever(() => {
    FisicaBitBT.enviar2(input.temperature(), input.lightLevel())
})
*/


// =============================================================================
// PRUEBA 10: CELDA DE CARGA HX711 — MEDICIÓN DE MASA Y FUERZA
// =============================================================================
// HARDWARE: Módulo HX711 DOUT→P0, SCK→P1, VCC→3V/5V, GND→GND
//           Celda de carga conectada al HX711 (E+, E-, A+, A-)
// ÉXITO: Inicializar (~2 s) muestra ✓. Apretar A → tara (~2 s) muestra ✓.
//        Apretar A+B → calibrar con 100 g (~2 s).
//        El bucle muestra masa y fuerza por serial continuamente.
//        Tras la tara, valores cerca de 0 g / 0 N. Tras calibrar, exactos.
// FALLA: Excepción, ✗ al iniciar, sin salida serial o valores aleatorios/derivando.
// =============================================================================

/*
// al iniciar: inicializar + tara automática
FisicaBitHX711.hx711Inicializar(DigitalPin.P0, DigitalPin.P1)
FisicaBitHX711.hx711Tarar()

// Botón A: volver a tarar (quitar todo el peso antes)
input.onButtonPressed(Button.A, () => {
    basic.showString("T")
    FisicaBitHX711.hx711Tarar()
    basic.showIcon(IconNames.Yes)
    basic.pause(500)
    basic.clearScreen()
})

// Botón A+B: calibrar con 100 g (poner el peso y después apretar)
input.onButtonPressed(Button.AB, () => {
    basic.showString("C")
    FisicaBitHX711.hx711Calibrar(100)
    basic.showIcon(IconNames.Yes)
    serial.writeValue("cal_factor", FisicaBitHX711.hx711GetFactor())
    basic.pause(500)
    basic.clearScreen()
})

// Bucle para siempre: medición continua no bloqueante
basic.forever(() => {
    let masa = FisicaBitHX711.hx711Masa(UnidadMasa.Gramos)
    let fuerza = FisicaBitHX711.hx711Fuerza(9.81)
    serial.writeValue("mass_g", masa)
    serial.writeValue("force_N", fuerza)
})
*/
