// =============================================================================
// test.ts — Ejemplos de uso de la extensión FisicaBit
// =============================================================================
// Este archivo sirve como:
//   1. Tests funcionales de la extensión
//   2. Ejemplos de referencia para estudiantes
//   3. Plantillas copy-paste para proyectos FisicaBit
//
// CÓMO EJECUTAR:
//   - En MakeCode: se ejecuta automáticamente en el simulador al editar
//   - En hardware: descargar el .hex y flashear al micro:bit
//
// NOTA: Descomentar solo UN ejemplo a la vez para probar en el micro:bit,
//       ya que basic.forever() solo debe usarse una vez por programa.
// =============================================================================


// =============================================================================
// EJEMPLO 1: ESTACIÓN METEOROLÓGICA BÁSICA
// =============================================================================
// Muestra la temperatura interna del micro:bit en la pantalla LED.
// Presionar botón A para ver en Celsius, botón B para Fahrenheit.
//
// CONCEPTOS:
//   - Lectura de sensor interno
//   - Conversión de unidades
//   - Eventos de botón
//   - Mostrar datos en LED
// =============================================================================

let unidadActual = UnidadTemperatura.Celsius

input.onButtonPressed(Button.A, () => {
    // Botón A → mostrar en Celsius
    unidadActual = UnidadTemperatura.Celsius
    let temp = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
    FisicaBit.mostrarEnLED("C", temp)
})

input.onButtonPressed(Button.B, () => {
    // Botón B → mostrar en Fahrenheit
    unidadActual = UnidadTemperatura.Fahrenheit
    let tempC = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
    let tempF = FisicaBit.convertirTemperatura(
        tempC,
        UnidadTemperatura.Celsius,
        UnidadTemperatura.Fahrenheit
    )
    FisicaBit.mostrarEnLED("F", tempF)
})


// =============================================================================
// EJEMPLO 2: MONITOR DE SENSORES POR SERIE (USB)
// =============================================================================
// Envía lecturas de todos los sensores internos por el puerto serie.
// Ideal para análisis en tiempo real con la consola de MakeCode
// o cualquier terminal serie (115200 baudios).
//
// FORMATO DE SALIDA (CSV):
//   temperatura:23
//   acelerometro_x:15
//   acelerometro_y:-8
//   acelerometro_z:-1024
//   luz:128
//   brujula:270
//
// CONCEPTOS:
//   - Lectura de múltiples sensores
//   - Comunicación serie
//   - Logging de datos
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    FisicaBit.enviarPorSerie("temperatura",
        FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura))
    FisicaBit.enviarPorSerie("acel_x",
        FisicaBit.leerSensorInterno(TipoSensorInterno.AcelerometroX))
    FisicaBit.enviarPorSerie("acel_y",
        FisicaBit.leerSensorInterno(TipoSensorInterno.AcelerometroY))
    FisicaBit.enviarPorSerie("acel_z",
        FisicaBit.leerSensorInterno(TipoSensorInterno.AcelerometroZ))
    FisicaBit.enviarPorSerie("luz",
        FisicaBit.leerSensorInterno(TipoSensorInterno.NivelLuz))
    FisicaBit.enviarPorSerie("brujula",
        FisicaBit.leerSensorInterno(TipoSensorInterno.Brujula))

    FisicaBit.esperar(1000)  // Una lectura por segundo
})
*/


// =============================================================================
// EJEMPLO 3: SENSOR ULTRASÓNICO — MEDIDOR DE DISTANCIA
// =============================================================================
// Mide distancia con HC-SR04 y muestra en la pantalla LED.
// También envía datos por serie para graficar.
//
// CABLEADO:
//   HC-SR04 TRIG → micro:bit P1
//   HC-SR04 ECHO → micro:bit P2
//   HC-SR04 VCC  → micro:bit 3V
//   HC-SR04 GND  → micro:bit GND
//
// CONCEPTOS:
//   - Sensor ultrasónico
//   - Medición de distancia
//   - Visualización en LED y serie
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    let distancia = FisicaBit.medirDistanciaUltrasonido(
        DigitalPin.P1,
        DigitalPin.P2,
        UnidadDistancia.Centimetros
    )

    // Mostrar en LED
    FisicaBit.mostrarEnLED("d", distancia)

    // Enviar por serie para graficar
    FisicaBit.enviarPorSerie("distancia_cm", distancia)

    FisicaBit.esperar(500)
})
*/


// =============================================================================
// EJEMPLO 4: POTENCIÓMETRO — CONTROL ANALÓGICO
// =============================================================================
// Lee un potenciómetro en P0 y mapea su valor a un rango útil.
//
// CABLEADO:
//   Potenciómetro pin izquierdo  → GND
//   Potenciómetro pin central    → P0 (señal)
//   Potenciómetro pin derecho    → 3V
//
// CONCEPTOS:
//   - Lectura analógica (ADC)
//   - Mapeo de valores
//   - Control de LED con sensor
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    // Leer potenciómetro (0-1023)
    let lectura = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)

    // Mapear a porcentaje (0-100)
    let porcentaje = FisicaBit.mapearValor(lectura, 0, 1023, 0, 100)

    // Mapear a brillo de LED (0-255)
    let brillo = FisicaBit.mapearValor(lectura, 0, 1023, 0, 255)
    led.setBrightness(brillo)

    // Mostrar porcentaje
    FisicaBit.mostrarEnLED("%", porcentaje)

    // Log por serie
    FisicaBit.enviarPorSerie("potenciometro_raw", lectura)
    FisicaBit.enviarPorSerie("potenciometro_pct", porcentaje)

    FisicaBit.esperar(200)
})
*/


// =============================================================================
// EJEMPLO 5: SENSOR DE LUZ (LDR) — MEDIDOR DE LUMINOSIDAD
// =============================================================================
// Lee un fotoresistor (LDR) y determina el nivel de iluminación.
//
// CABLEADO (divisor de voltaje):
//   3V ──┤ LDR ├──┬── P1 (señal)
//                  │
//                  ├── Resistencia 10KΩ ──┤ GND
//
// NOTA: Sin la resistencia de 10KΩ, el valor no sería útil.
// El divisor de voltaje convierte la resistencia variable del LDR
// en un voltaje variable que el ADC puede leer.
//
// CONCEPTOS:
//   - Divisor de voltaje
//   - Sensor resistivo
//   - Umbrales de decisión
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    let luz = FisicaBit.leerSensorAnalogico(PinAnalogico.P1)

    // Clasificar nivel de luz con umbrales
    if (luz < 200) {
        basic.showIcon(IconNames.No)        // Oscuro
        FisicaBit.enviarPorSerie("estado", 0)
    } else if (luz < 600) {
        basic.showIcon(IconNames.SmallHeart) // Normal
        FisicaBit.enviarPorSerie("estado", 1)
    } else {
        basic.showIcon(IconNames.Heart)      // Brillante
        FisicaBit.enviarPorSerie("estado", 2)
    }

    FisicaBit.enviarPorSerie("luz_raw", luz)
    FisicaBit.esperar(500)
})
*/


// =============================================================================
// EJEMPLO 6: DETECTOR DE MOVIMIENTO (PIR)
// =============================================================================
// Usa un sensor PIR en P8 para detectar movimiento.
// Muestra una alarma visual y envía alerta por serie.
//
// CABLEADO:
//   PIR OUT → P8
//   PIR VCC → 3V
//   PIR GND → GND
//
// NOTA: Los sensores PIR necesitan ~30s para calibrarse al encender.
//
// CONCEPTOS:
//   - Sensor digital (HIGH/LOW)
//   - Detección de eventos
//   - Alarma visual
// =============================================================================

/*  ── Descomentar para usar ──
let movimientoDetectado = false

basic.forever(() => {
    let estado = FisicaBit.leerSensorDigital(8)  // P8

    if (estado == 1 && !movimientoDetectado) {
        // ¡Movimiento detectado! (flanco ascendente)
        movimientoDetectado = true
        basic.showIcon(IconNames.Surprised)
        FisicaBit.enviarPorSerie("movimiento", 1)
    } else if (estado == 0 && movimientoDetectado) {
        // Movimiento terminó (flanco descendente)
        movimientoDetectado = false
        basic.showIcon(IconNames.Happy)
        FisicaBit.enviarPorSerie("movimiento", 0)
    }

    FisicaBit.esperar(100)
})
*/


// =============================================================================
// EJEMPLO 7: LECTURA NATIVA C++ (AVANZADO)
// =============================================================================
// Usa las funciones nativas C++ para lectura de alta resolución.
// Solo funciona en hardware real (en simulador usa fallback TS).
//
// CONCEPTOS:
//   - Funciones shim (puente TS↔C++)
//   - ADC de 12 bits vs 10 bits
//   - Sobremuestreo para reducir ruido
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    // Lectura estándar MakeCode (10 bits: 0-1023)
    let standard = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)

    // Lectura nativa C++ (12 bits: 0-4095) — ¡4x más resolución!
    let nativo = FisicaBit.leerADCNativo(0)

    // Lectura promediada (16 muestras, reduce ruido)
    let promedio = FisicaBit.leerADCPromedio(0, 16)

    // Enviar las tres lecturas por serie para comparar
    FisicaBit.enviarPorSerie("adc_standard_10bit", standard)
    FisicaBit.enviarPorSerie("adc_nativo_12bit", nativo)
    FisicaBit.enviarPorSerie("adc_promedio_16x", promedio)

    FisicaBit.esperar(200)
})
*/


// =============================================================================
// EJEMPLO 8: SENSOR NTC — TERMÓMETRO ANALÓGICO
// =============================================================================
// Convierte la lectura de un termistor NTC a temperatura.
//
// CABLEADO (divisor de voltaje):
//   3V ──┤ NTC (10KΩ @25°C) ├──┬── P2 (señal)
//                               │
//                               ├── Resistencia 10KΩ ──┤ GND
//
// FÓRMULA SIMPLIFICADA (Steinhart-Hart simplificada):
//   La relación no es lineal, pero para rangos pequeños (0-50°C)
//   una aproximación lineal con mapearValor() es razonable.
//   Para mayor precisión, usar la ecuación completa en C++.
//
// CONCEPTOS:
//   - Termistor NTC
//   - Aproximación lineal vs ecuación real
//   - Calibración de sensores
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    let lecturaNTC = FisicaBit.leerSensorAnalogico(PinAnalogico.P2)

    // Aproximación lineal simple (válida para 0-50°C aprox.)
    // Estos valores dependen del NTC específico — calibrar con
    // un termómetro de referencia
    let tempAprox = FisicaBit.mapearValor(lecturaNTC, 300, 800, 50, 0)

    FisicaBit.mostrarEnLED("T", tempAprox)
    FisicaBit.enviarPorSerie("ntc_raw", lecturaNTC)
    FisicaBit.enviarPorSerie("ntc_temp", tempAprox)

    FisicaBit.esperar(1000)
})
*/
