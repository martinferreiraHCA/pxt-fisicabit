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
// EJEMPLO 2: MUESTREO SERIAL — ACELERÓMETRO CON TIEMPO
// =============================================================================
// Envía tiempo + aceleración X por puerto serie (USB) cada 100ms.
// Misma lógica que los bloques BT: un bloque, cualquier valor.
//
// EN BLOQUES:
//   ┌──────────────────────────────────────────────────────────┐
//   │ para siempre                                             │
//   │   ┌──────────────────────────────────────────────────┐   │
//   │   │ Serial muestrear [tiempo serial (ms)] y [acel X]│   │
//   │   │                  cada [100] ms                    │   │
//   │   └──────────────────────────────────────────────────┘   │
//   └──────────────────────────────────────────────────────────┘
//
// SALIDA SERIE (CSV):  0,15  →  100,-8  →  200,23  →  ...
//
// CONCEPTOS:
//   - Muestreo serial con la misma lógica que BT
//   - "tiempo serial (ms)" es una variable más (empieza en 0)
//   - El usuario decide qué datos enviar
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    FisicaBit.serialMuestrear2(
        FisicaBit.tiempoSerial(),
        input.acceleration(Dimension.X),
        100
    )
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

    // Enviar tiempo + distancia por serie para graficar
    FisicaBit.serialMuestrear2(
        FisicaBit.tiempoSerial(),
        distancia,
        500
    )
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

    // Enviar tiempo + lectura cruda + porcentaje por serie
    FisicaBit.serialMuestrear3(
        FisicaBit.tiempoSerial(),
        lectura,
        porcentaje,
        200
    )
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
    let estado = 0
    if (luz < 200) {
        basic.showIcon(IconNames.No)        // Oscuro
        estado = 0
    } else if (luz < 600) {
        basic.showIcon(IconNames.SmallHeart) // Normal
        estado = 1
    } else {
        basic.showIcon(IconNames.Heart)      // Brillante
        estado = 2
    }

    // Enviar tiempo + luz + estado por serie
    FisicaBit.serialMuestrear3(
        FisicaBit.tiempoSerial(),
        luz,
        estado,
        500
    )
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
    let estadoPIR = FisicaBit.leerSensorDigital(8)  // P8

    if (estadoPIR == 1 && !movimientoDetectado) {
        movimientoDetectado = true
        basic.showIcon(IconNames.Surprised)
    } else if (estadoPIR == 0 && movimientoDetectado) {
        movimientoDetectado = false
        basic.showIcon(IconNames.Happy)
    }

    // Enviar tiempo + estado del PIR por serie
    FisicaBit.serialMuestrear2(
        FisicaBit.tiempoSerial(),
        estadoPIR,
        100
    )
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
    FisicaBit.serialMuestrear3(standard, nativo, promedio, 200)
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

    // Enviar tiempo + lectura cruda + temperatura por serie
    FisicaBit.serialMuestrear3(
        FisicaBit.tiempoSerial(),
        lecturaNTC,
        tempAprox,
        1000
    )
})
*/


// =============================================================================
// EJEMPLO 9: BARRERA ÓPTICA FC-33 — MEDIR VELOCIDAD (DIGITAL)
// =============================================================================
// Usa dos módulos FC-33 para medir el tiempo de tránsito de un objeto
// y calcular su velocidad.
//
// SENSOR FC-33:
//   Módulo de ranura con LED IR + fototransistor + comparador LM393.
//   El objeto pasa por la ranura de ~10mm y corta el haz infrarrojo.
//   Salida digital: HIGH (libre) → LOW (haz cortado).
//   Tiene potenciómetro físico para ajustar la sensibilidad.
//
// CABLEADO:
//   ┌─────────────────────────────────────────────────┐
//   │                                                  │
//   │  FC-33 #1 (Barrera A):                          │
//   │    VCC → 3V                                      │
//   │    GND → GND                                     │
//   │    OUT → P1                                      │
//   │                                                  │
//   │  FC-33 #2 (Barrera B):                          │
//   │    VCC → 3V                                      │
//   │    GND → GND                                     │
//   │    OUT → P2                                      │
//   │                                                  │
//   │  MONTAJE FÍSICO (rampa de prueba):              │
//   │                                                  │
//   │   ╔══════════════════════════════╗               │
//   │   ║  ●──────────────────────►   ║  ← bolita     │
//   │   ║  ↑                      ↑   ║               │
//   │   ║ FC-33#1              FC-33#2 ║               │
//   │   ║ (P1)                 (P2)   ║               │
//   │   ║         ◄─ 100mm ─►        ║               │
//   │   ╚══════════════════════════════╝               │
//   │         rampa inclinada                          │
//   └─────────────────────────────────────────────────┘
//
// CONCEPTOS:
//   - Barrera óptica digital (FC-33)
//   - Medición de tiempo de tránsito
//   - Cálculo de velocidad: v = d / t
//   - Lectura serie para análisis
// =============================================================================

/*  ── Descomentar para usar ──

// Distancia entre barreras en mm (medir con regla)
let DISTANCIA_MM = 100  // 10 cm

basic.showIcon(IconNames.Target)  // Indicar "listo para medir"

input.onButtonPressed(Button.A, () => {
    basic.showString("?")  // Indicar "esperando objeto..."

    // Medir tiempo entre barrera A (P1) y barrera B (P2)
    // Modo Digital = para FC-33
    // Timeout = 10 segundos
    let tiempoMs = FisicaBit.medirTiempoBarrera(
        PinAnalogico.P1,
        PinAnalogico.P2,
        ModoBarrera.Digital,
        10000
    )

    if (tiempoMs < 0) {
        // Timeout — no pasó ningún objeto
        basic.showIcon(IconNames.No)
    } else {
        // Calcular velocidad (×100 para 2 decimales)
        // tiempoMs está en ms, convertir a μs para calcularVelocidad
        let velocidad100 = FisicaBit.calcularVelocidad(tiempoMs * 1000, DISTANCIA_MM)

        // Mostrar: parte entera de la velocidad
        basic.showNumber(Math.idiv(velocidad100, 100))

        // Log detallado por serie
        serial.writeValue("tiempo_ms", tiempoMs)
        serial.writeValue("velocidad_x100", velocidad100)
        serial.writeValue("distancia_mm", DISTANCIA_MM)
    }

    basic.pause(2000)
    basic.showIcon(IconNames.Target)  // Listo de nuevo
})
*/


// =============================================================================
// EJEMPLO 10: BARRERA ÓPTICA IR DIY — CON CALIBRACIÓN ANALÓGICA
// =============================================================================
// Usa dos pares de LED IR emisor + fototransistor receptor.
// La señal es ANALÓGICA → el umbral se ajusta por software.
//
// CABLEADO DE CADA PAR IR:
//   ┌────────────────────────────────────────────────────┐
//   │                                                     │
//   │  EMISOR (LED infrarrojo):                          │
//   │  3V ─── R(100Ω) ─── LED IR(+) ─── LED IR(-) ─── GND│
//   │                                                     │
//   │  RECEPTOR (Fototransistor):                        │
//   │  3V ─── Fototransistor(C) ───┬─── Pin (señal)     │
//   │                               │                     │
//   │                          R(10KΩ)                    │
//   │                               │                     │
//   │                              GND                    │
//   │                                                     │
//   │  Par #1 → señal en P1 (barrera A)                  │
//   │  Par #2 → señal en P2 (barrera B)                  │
//   │                                                     │
//   │  VISTA SUPERIOR:                                    │
//   │                                                     │
//   │  [TX]   [TX]        ← LEDs IR emisores             │
//   │   ↓      ↓                                          │
//   │   │  ●───┼──►       ← objeto pasando                │
//   │   ↓      ↓                                          │
//   │  [RX]   [RX]        ← Fototransistores             │
//   │  (P1)   (P2)                                        │
//   │                                                     │
//   │  Señal en P1 y P2 (valores típicos):               │
//   │    Sin objeto: ~800-950 (mucha luz IR llega al RX) │
//   │    Con objeto: ~50-200  (objeto bloquea la luz)    │
//   │    Umbral recomendado: ~400-500 (punto medio)      │
//   │                                                     │
//   └────────────────────────────────────────────────────┘
//
// CONCEPTOS:
//   - Barrera analógica con umbral software
//   - Calibración interactiva
//   - Ajuste de trigger en tiempo real
//   - LED IR emisor + fototransistor receptor
// =============================================================================

/*  ── Descomentar para usar ──

// ── Paso 1: Calibración ──
// Presionar B para entrar en modo calibración
// La consola serie mostrará los valores crudos de ambas barreras

let modoCalibrar = false

input.onButtonPressed(Button.B, () => {
    modoCalibrar = !modoCalibrar
    if (modoCalibrar) {
        basic.showString("C")  // Modo calibración
    } else {
        basic.showIcon(IconNames.Target)  // Modo medición
    }
})

// Bucle de calibración: muestra valores crudos por serie
basic.forever(() => {
    if (modoCalibrar) {
        let rawA = FisicaBit.leerBarreraCrudo(PinAnalogico.P1, ModoBarrera.Analogico)
        let rawB = FisicaBit.leerBarreraCrudo(PinAnalogico.P2, ModoBarrera.Analogico)
        serial.writeValue("barrera_A_raw", rawA)
        serial.writeValue("barrera_B_raw", rawB)

        // Mostrar valor de A en el LED para referencia
        basic.showNumber(Math.idiv(rawA, 100))  // Mostrar centenas

        basic.pause(200)
    }
})

// ── Paso 2: Configurar umbrales ──
// Después de observar los valores crudos, ajustar los umbrales.
// Ejemplo: sin objeto=850, con objeto=120 → umbral=(850+120)/2=485
FisicaBit.fijarUmbralBarrera("A", 450)
FisicaBit.fijarUmbralBarrera("B", 450)

// ── Paso 3: Medir ──
let DISTANCIA_IR_MM = 80  // 8cm entre barreras

input.onButtonPressed(Button.A, () => {
    if (modoCalibrar) return  // No medir en modo calibración

    basic.showString("?")

    let tiempoMs = FisicaBit.medirTiempoBarrera(
        PinAnalogico.P1,
        PinAnalogico.P2,
        ModoBarrera.Analogico,
        10000
    )

    if (tiempoMs < 0) {
        basic.showIcon(IconNames.No)
    } else {
        let vel100 = FisicaBit.calcularVelocidad(tiempoMs * 1000, DISTANCIA_IR_MM)
        basic.showNumber(Math.idiv(vel100, 100))
        serial.writeValue("tiempo_ms", tiempoMs)
        serial.writeValue("vel_x100_ms", vel100)
    }

    basic.pause(2000)
    basic.showIcon(IconNames.Target)
})
*/


// =============================================================================
// EJEMPLO 11: BARRERA ÓPTICA NATIVA C++ — MÁXIMA PRECISIÓN
// =============================================================================
// Igual que el ejemplo 10, pero usando la función nativa C++ para
// obtener resolución de 1μs en vez de 1ms.
//
// CUÁNDO USAR ESTO vs LA VERSIÓN TYPESCRIPT:
//   - Objeto a >2 m/s → usar C++ (el error de 1ms es >2%)
//   - Barreras a <3cm de distancia → usar C++
//   - Medición de aceleración → usar C++ (necesitas alta precisión)
//   - Experimento casual / demostración → TypeScript es suficiente
//
// TABLA DE PRECISIÓN:
//   ┌──────────────┬───────────┬────────────┬────────────┐
//   │ Velocidad    │ Dist.10cm │ Tiempo     │ Error TS   │
//   ├──────────────┼───────────┼────────────┼────────────┤
//   │ 0.1 m/s      │ 10cm      │ 1000ms     │ ±0.1%     │
//   │ 0.5 m/s      │ 10cm      │ 200ms      │ ±0.5%     │
//   │ 1.0 m/s      │ 10cm      │ 100ms      │ ±1.0%     │
//   │ 2.0 m/s      │ 10cm      │ 50ms       │ ±2.0%     │
//   │ 5.0 m/s      │ 10cm      │ 20ms       │ ±5.0% ⚠  │
//   │ 10 m/s       │ 10cm      │ 10ms       │ ±10% ⚠⚠  │
//   └──────────────┴───────────┴────────────┴────────────┘
//   Con C++ nativo, el error es siempre <0.01% para estos rangos.
//
// CONCEPTOS:
//   - Función shim C++ para timing de hardware
//   - Microsegundos vs milisegundos
//   - Error relativo y cuándo importa
// =============================================================================

/*  ── Descomentar para usar ──

let DIST_PREC_MM = 100  // 10cm entre barreras

// Configurar umbrales (solo afecta modo analógico)
let umbA = 450
let umbB = 450

input.onButtonPressed(Button.A, () => {
    basic.showString("?")

    // ── Medición con C++ nativo (1μs de resolución) ──
    let tiempoUs = FisicaBit.medirTiempoBarreraNativo(
        1,                      // pinA = P1
        2,                      // pinB = P2
        ModoBarrera.Digital,    // Cambiar a .Analogico para IR DIY
        umbA,                   // Umbral A (ignorado en digital)
        umbB,                   // Umbral B (ignorado en digital)
        5000000                 // Timeout: 5 segundos (5,000,000 μs)
    )

    if (tiempoUs == 0) {
        basic.showIcon(IconNames.No)  // Timeout
    } else {
        // Calcular velocidad con precisión de μs
        let vel100 = FisicaBit.calcularVelocidad(tiempoUs, DIST_PREC_MM)

        // Convertir tiempo a ms para mostrar
        let tiempoMs100 = FisicaBit.convertirTiempo(tiempoUs, UnidadTiempo.Milisegundos)

        basic.showNumber(Math.idiv(vel100, 100))

        // Log detallado
        serial.writeValue("tiempo_us", tiempoUs)
        serial.writeValue("tiempo_ms_x100", tiempoMs100)
        serial.writeValue("velocidad_x100", vel100)
        serial.writeValue("distancia_mm", DIST_PREC_MM)
    }

    basic.pause(2000)
    basic.showIcon(IconNames.Target)
})
*/


// =============================================================================
// EJEMPLO 12: CAÍDA LIBRE — MEDIR g CON BARRERAS ÓPTICAS
// =============================================================================
// Experimento clásico de física: dejar caer un objeto y medir la
// aceleración de la gravedad (g ≈ 9.81 m/s²).
//
// MONTAJE:
//   ┌───────────────────────────────────────┐
//   │            ◯ ← soltar bolita aquí     │
//   │            │                          │
//   │            │ caída libre              │
//   │            ▼                          │
//   │   ═══[FC-33 A]═══  ← Barrera A (P1)  │
//   │            │                          │
//   │            │  d (medir con regla)     │
//   │            │                          │
//   │            ▼                          │
//   │   ═══[FC-33 B]═══  ← Barrera B (P2)  │
//   │                                       │
//   └───────────────────────────────────────┘
//
// FÍSICA:
//   En caída libre desde reposo:
//     d = ½ · g · t²
//     g = 2d / t²
//
//   Pero si el objeto ya tiene velocidad al pasar por A:
//     v_A = d_prev / t_prev  (si hay barrera previa)
//     v_B = d / t
//     a = (v_B - v_A) / t   ← aceleración media
//
//   Simplificación (si soltamos desde A):
//     g = 2 × distancia / tiempo²
//
// EJEMPLO NUMÉRICO:
//   d = 0.5m (50cm), t = 0.3194s
//   g = 2 × 0.5 / 0.3194² = 9.79 m/s² ✓
//
// CONCEPTOS:
//   - Caída libre y gravedad
//   - v = d/t, g = 2d/t²
//   - Precisión de medición
// =============================================================================

/*  ── Descomentar para usar ──

let CAIDA_DIST_MM = 500  // 50cm entre barreras (ajustar según montaje)

input.onButtonPressed(Button.A, () => {
    basic.showString("G")

    // Usar versión C++ para máxima precisión
    let tUs = FisicaBit.medirTiempoBarreraNativo(
        1, 2,                   // P1 → P2
        ModoBarrera.Digital,    // FC-33
        0, 0,                   // umbrales (no aplica)
        10000000                // 10s timeout
    )

    if (tUs == 0) {
        basic.showIcon(IconNames.No)
        return
    }

    // g = 2d / t²
    // Cuidado con overflow: trabajar en unidades consistentes
    // d en metros = CAIDA_DIST_MM / 1000
    // t en segundos = tUs / 1000000
    // g = 2 × (CAIDA_DIST_MM/1000) / (tUs/1000000)²
    // g = 2 × CAIDA_DIST_MM × 1000000000 / (1000 × tUs × tUs)
    // g × 100 = 2 × CAIDA_DIST_MM × 100000000 / (tUs × tUs / 1000)
    // Simplificando para evitar overflow:
    let tMs = Math.idiv(tUs, 1000)   // tiempo en ms
    let g100 = 0
    if (tMs > 0) {
        // g×100 = 2 × dist_mm × 1000 / (tMs × tMs)
        g100 = Math.idiv(2 * CAIDA_DIST_MM * 1000, tMs * tMs)
    }

    // Mostrar g (parte entera)
    basic.showNumber(Math.idiv(g100, 100))

    // Log
    serial.writeValue("tiempo_us", tUs)
    serial.writeValue("tiempo_ms", tMs)
    serial.writeValue("g_x100", g100)
    serial.writeValue("dist_mm", CAIDA_DIST_MM)
})
*/


// =============================================================================
// EJEMPLO 13: BLUETOOTH — MUESTREO CON TIEMPO Y ACELERÓMETRO
// =============================================================================
// Envía tiempo + aceleración X por Bluetooth cada 100ms.
// El bloque "tiempo (ms)" es un reporter que empieza en 0.
// El usuario lo arrastra a un slot como cualquier otro valor.
//
// EN BLOQUES:
//   ┌──────────────────────────────────────────────────────┐
//   │ para siempre                                         │
//   │   ┌──────────────────────────────────────────────┐   │
//   │   │ BT muestrear [tiempo (ms)] y [acel X]       │   │
//   │   │              cada [100] ms                    │   │
//   │   └──────────────────────────────────────────────┘   │
//   └──────────────────────────────────────────────────────┘
//
// SALIDA BT (CSV):  0,15  →  100,-8  →  200,23  →  ...
//
// CONCEPTOS:
//   - "tiempo (ms)" es una variable más, no se agrega sola
//   - El tiempo comienza en 0 (no usa runningTime directo)
//   - El usuario decide qué datos enviar y en qué orden
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    FisicaBitBT.muestrear2(
        FisicaBitBT.tiempo(),
        input.acceleration(Dimension.X),
        100
    )
})
*/


// =============================================================================
// EJEMPLO 14: BLUETOOTH — MUESTREO SIN TIEMPO (SOLO VALOR)
// =============================================================================
// Si no necesitás timestamp, mandás solo el valor.
//
// EN BLOQUES:
//   ┌──────────────────────────────────────────────┐
//   │ para siempre                                 │
//   │   ┌────────────────────────────────────────┐ │
//   │   │ BT muestrear [temperatura]             │ │
//   │   │              cada [1000] ms             │ │
//   │   └────────────────────────────────────────┘ │
//   └──────────────────────────────────────────────┘
//
// SALIDA BT:  23  →  24  →  23  →  ...
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    FisicaBitBT.muestrear1(
        input.temperature(),
        1000
    )
})
*/


// =============================================================================
// EJEMPLO 15: BLUETOOTH — TIEMPO + 2 EJES DEL ACELERÓMETRO
// =============================================================================
// Envía tiempo, aceleración X y aceleración Y.
// Usa muestrear3 porque son 3 valores: tiempo + X + Y.
//
// SALIDA BT (CSV):  0,15,-8  →  50,23,-12  →  ...
// =============================================================================

/*  ── Descomentar para usar ──
basic.forever(() => {
    FisicaBitBT.muestrear3(
        FisicaBitBT.tiempo(),
        input.acceleration(Dimension.X),
        input.acceleration(Dimension.Y),
        50
    )
})
*/


// =============================================================================
// EJEMPLO 16: BLUETOOTH — VARIABLE CALCULADA + INDICADOR DE CONEXIÓN
// =============================================================================
// Demuestra que se puede enviar CUALQUIER valor calculado.
// Aquí enviamos tiempo + temperatura en Fahrenheit.
// =============================================================================

/*  ── Descomentar para usar ──
FisicaBitBT.configurarIndicadorConexion()

basic.forever(() => {
    let tempC = input.temperature()
    let tempF = tempC * 9 / 5 + 32
    FisicaBitBT.muestrear2(
        FisicaBitBT.tiempo(),
        tempF,
        1000
    )
})
*/
