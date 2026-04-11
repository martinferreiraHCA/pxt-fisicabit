// =============================================================================
//  fisicabit.ts — Extensión principal MakeCode para micro:bit
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Plantilla de extensión para lectura de sensores internos
//               y externos con ejemplos de integración C++ y ASM.
//
//  ARQUITECTURA DE UNA EXTENSIÓN MAKECODE:
//  ────────────────────────────────────────
//  ┌─────────────────────────────────────────────────────────┐
//  │  MakeCode Editor (Bloques / TypeScript)                 │
//  │    └─► fisicabit.ts  ← ESTE ARCHIVO                    │
//  │          Define los bloques visuales y la lógica TS     │
//  ├─────────────────────────────────────────────────────────┤
//  │  Capa de Shims (puente TS ↔ C++)                       │
//  │    └─► shims.d.ts    ← Declaraciones TypeScript        │
//  │    └─► shims.cpp     ← Implementación nativa C++       │
//  │          Acceso directo al hardware del nRF52833        │
//  ├─────────────────────────────────────────────────────────┤
//  │  Capa de Ensamblador (optimización máxima)              │
//  │    └─► asm_sensors.S ← Rutinas críticas en ARM ASM     │
//  │          Lectura ultrarrápida de ADC, timing preciso    │
//  └─────────────────────────────────────────────────────────┘
//
//  CÓMO FUNCIONAN LOS BLOQUES MAKECODE:
//  ─────────────────────────────────────
//  Las anotaciones //% controlan cómo se muestran los bloques:
//    //% block="texto"         → Texto que aparece en el bloque
//    //% blockId=id            → Identificador único del bloque
//    //% weight=N              → Orden (mayor = más arriba)
//    //% color=#RRGGBB         → Color del bloque
//    //% group="nombre"        → Agrupa bloques en subcategorías
//    //% advanced=true         → Muestra en sección "avanzado"
//    //% pin.defl=AnalogPin.P0 → Valor por defecto del parámetro
//
//  CONVENCIÓN DE NOMBRES:
//  ──────────────────────
//  - Namespace: nombre que aparece en la toolbox de MakeCode
//  - Funciones: camelCase, descriptivas y en español para FisicaBit
//  - Constantes: MAYUSCULAS_CON_GUION
//  - Enums: PascalCase (definidos en enums.d.ts)
// =============================================================================


// =============================================================================
// NAMESPACE PRINCIPAL — "FisicaBit" aparecerá en la toolbox de MakeCode
// =============================================================================
//% weight=100
//% color=#E64322
//% icon="\uf0e7"
//% block="FisicaBit Sensors"
//% groups="['Internal Sensors', 'External Sensors', 'Optical Barrier', 'Conversions', 'Native C++', 'Utilities']"
namespace FisicaBit {

    // =========================================================================
    // GRUPO 1: SENSORES INTERNOS (ya integrados en la placa micro:bit)
    // =========================================================================
    // El micro:bit tiene estos sensores integrados:
    //   - Temperatura: termistor en el chip nRF52 (±4°C de precisión)
    //   - Acelerómetro: LSM303AGR (v2), mide aceleración en 3 ejes
    //   - Magnetómetro: LSM303AGR (v2), brújula digital
    //   - Sensor de luz: usa la matriz LED como fotodetector
    //   - Micrófono: solo micro:bit v2, sensor MEMS
    // =========================================================================

    /**
     * Lee un sensor interno del micro:bit y devuelve su valor numérico.
     *
     * EJEMPLO DE USO EN BLOQUES:
     *   [FisicaBit: leer sensor interno (Temperatura)] → muestra 23
     *
     * EJEMPLO EN TYPESCRIPT:
     *   let temp = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
     *   basic.showNumber(temp)
     *
     * @param sensor El tipo de sensor interno a leer (ver enum TipoSensorInterno)
     * @returns Valor numérico del sensor (la unidad depende del sensor)
     */
    //% block="read internal sensor %sensor"
    //% blockId=fisicabit_leer_sensor_interno
    //% group="Internal Sensors"
    //% weight=100
    //% sensor.defl=TipoSensorInterno.Temperatura
    export function leerSensorInterno(sensor: TipoSensorInterno): number {
        switch (sensor) {
            // ── Temperatura ──────────────────────────────────────────
            // Lee el termistor integrado en el chip nRF52833.
            // Precisión: ±4°C (no es un termómetro de laboratorio)
            // Rango: -40°C a +105°C
            // Nota: mide la temperatura del CHIP, no del ambiente.
            //       Puede estar 2-4°C por encima de la temp. real.
            case TipoSensorInterno.Temperatura:
                return input.temperature()

            // ── Acelerómetro (3 ejes) ────────────────────────────────
            // Mide la aceleración en mili-g (1g = 1000 mili-g)
            // Rango: ±2g por defecto (configurable a ±4g, ±8g)
            // Ejes: X = izquierda/derecha
            //       Y = adelante/atrás
            //       Z = arriba/abajo (en reposo ≈ -1024 por gravedad)
            case TipoSensorInterno.AcelerometroX:
                return input.acceleration(Dimension.X)
            case TipoSensorInterno.AcelerometroY:
                return input.acceleration(Dimension.Y)
            case TipoSensorInterno.AcelerometroZ:
                return input.acceleration(Dimension.Z)

            // ── Nivel de Luz ─────────────────────────────────────────
            // Usa los LEDs de la matriz 5x5 como fotodetectores
            // Rango: 0 (oscuridad total) a 255 (luz intensa)
            // Truco: los LEDs pueden detectar fotones cuando están
            //        en modo "reverso". MakeCode lo hace automáticamente.
            case TipoSensorInterno.NivelLuz:
                return input.lightLevel()

            // ── Brújula (heading) ────────────────────────────────────
            // Devuelve la dirección en grados (0-359)
            // 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste
            // IMPORTANTE: requiere calibración la primera vez
            //             (aparece el juego "TILT TO FILL SCREEN")
            case TipoSensorInterno.Brujula:
                return input.compassHeading()

            // ── Nivel de Sonido (solo micro:bit v2) ──────────────────
            // Micrófono MEMS integrado en micro:bit v2
            // Rango: 0 (silencio) a 255 (sonido fuerte)
            // Nota: en micro:bit v1 devuelve 0 siempre
            case TipoSensorInterno.NivelSonido:
                return input.soundLevel()

            // ── Fuerza G (magnitud total) ────────────────────────────
            // Calcula: √(x² + y² + z²) usando los 3 ejes
            // En reposo ≈ 1024 (≈1g de gravedad)
            // Útil para detectar caídas, golpes, vibración
            case TipoSensorInterno.FuerzaG:
                return input.acceleration(Dimension.Strength)

            default:
                return 0
        }
    }


    // NOTE: All acceleration-related code (constants, state, filters and
    // blocks) lives in the FisicaBitCinematica namespace below — this
    // keeps the orange "FisicaBit Sensors" category focused on raw
    // sensor reads and moves the derived kinematic magnitudes (a⃗, v⃗)
    // to their own blue category.

    // =========================================================================
    // GRUPO 2: SENSORES EXTERNOS (conectados a los pines GPIO)
    // =========================================================================
    //
    // MAPA DE PINES DEL MICRO:BIT (borde inferior):
    // ┌──────────────────────────────────────────────────┐
    // │  Pin   │ Tipo       │ Notas                      │
    // ├──────────────────────────────────────────────────┤
    // │  P0    │ Analógico  │ Táctil (v2), DAC           │
    // │  P1    │ Analógico  │ Táctil                     │
    // │  P2    │ Analógico  │ Táctil                     │
    // │  P3-P4 │ Digital    │ Columnas LED (compartido)  │
    // │  P5-P11│ Digital    │ Filas/Col LED (compartido)  │
    // │  P8    │ Digital    │ Libre, sin conflicto        │
    // │  P12   │ Digital    │ Libre, sin conflicto        │
    // │  P13   │ Digital    │ SPI (SCK)                   │
    // │  P14   │ Digital    │ SPI (MISO)                  │
    // │  P15   │ Digital    │ SPI (MOSI)                  │
    // │  P16   │ Digital    │ Libre, sin conflicto        │
    // │  P19   │ I2C        │ SCL (compartido)            │
    // │  P20   │ I2C        │ SDA (compartido)            │
    // └──────────────────────────────────────────────────┘
    //
    // PINES RECOMENDADOS PARA SENSORES EXTERNOS:
    //   - Analógicos: P0, P1, P2 (los únicos con ADC)
    //   - Digitales libres: P8, P12, P16
    //   - I2C: P19+P20 (bus compartido con sensores internos)
    // =========================================================================

    /**
     * Lee un sensor analógico conectado a un pin.
     *
     * CABLEADO:
     *   Sensor → Pin analógico (P0, P1 o P2)
     *   VCC    → 3V del micro:bit
     *   GND    → GND del micro:bit
     *
     * EJEMPLO — Potenciómetro en P0:
     *   ┌─────────────────┐
     *   │  Potenciómetro   │
     *   │  ┌───┐          │
     *   │  │   │──── P0   │  (señal analógica)
     *   │  │   │──── 3V   │  (alimentación)
     *   │  │   │──── GND  │  (tierra)
     *   │  └───┘          │
     *   └─────────────────┘
     *
     * @param pin Pin analógico donde está conectado el sensor
     * @returns Valor entre 0 y 1023 (resolución ADC de 10 bits)
     */
    //% block="read analog sensor on %pin"
    //% blockId=fisicabit_leer_analogico
    //% group="External Sensors"
    //% weight=90
    //% pin.defl=PinAnalogico.P0
    export function leerSensorAnalogico(pin: PinAnalogico): number {
        // El ADC del nRF52833 es de 12 bits internamente,
        // pero MakeCode lo escala a 10 bits (0-1023) por compatibilidad
        switch (pin) {
            case PinAnalogico.P0: return pins.analogReadPin(AnalogPin.P0)
            case PinAnalogico.P1: return pins.analogReadPin(AnalogPin.P1)
            case PinAnalogico.P2: return pins.analogReadPin(AnalogPin.P2)
            default: return 0
        }
    }


    /**
     * Lee un sensor digital (HIGH/LOW) conectado a un pin.
     *
     * Útil para sensores como:
     *   - PIR (movimiento): HIGH = movimiento detectado
     *   - Interruptores/botones: HIGH/LOW según estado
     *   - Sensor infrarrojo: HIGH = obstáculo detectado
     *
     * CABLEADO — Sensor PIR en P8:
     *   ┌─────────────────┐
     *   │  Sensor PIR      │
     *   │  ┌───────┐      │
     *   │  │  OUT  │──── P8   (señal digital)
     *   │  │  VCC  │──── 3V   (alimentación)
     *   │  │  GND  │──── GND  (tierra)
     *   │  └───────┘      │
     *   └─────────────────┘
     *
     * @param pin Número del pin digital (ej: 8 para P8, 12 para P12)
     * @returns 0 (LOW) o 1 (HIGH)
     */
    //% block="read digital sensor on P%pin"
    //% blockId=fisicabit_leer_digital
    //% group="External Sensors"
    //% weight=85
    //% pin.defl=8
    export function leerSensorDigital(pin: number): number {
        return pins.digitalReadPin(pin as any)
    }


    // =========================================================================
    // GRUPO 2b: SENSOR DE TEMPERATURA NTC 10K 3950
    // =========================================================================
    //
    // CÓMO FUNCIONA:
    //   El NTC (Negative Temperature Coefficient) es una resistencia cuyo
    //   valor DISMINUYE al aumentar la temperatura. A 25°C vale 10kΩ.
    //
    //   Se conecta en un divisor de tensión con una resistencia fija de
    //   10kΩ. El micro:bit lee el voltaje en el punto medio y calcula
    //   la temperatura usando la ecuación Beta (Steinhart-Hart simplificada):
    //
    //     1/T = 1/T₀ + (1/β) × ln(R_ntc / R₀)
    //
    //   donde T₀ = 298.15 K (25°C), R₀ = 10000 Ω, β = 3950
    //
    // CABLEADO:
    //   ┌─────────────────────────────────────────────┐
    //   │                                             │
    //   │  3V ─── [10kΩ fijo] ───┬─── Pin analógico   │
    //   │                        │    (P0, P1 o P2)   │
    //   │                   [NTC 10kΩ]                │
    //   │                        │                    │
    //   │                       GND                   │
    //   │                                             │
    //   └─────────────────────────────────────────────┘
    //
    //   ⚠ El NTC tiene 2 cables (sin polaridad), no importa cuál
    //     va a GND y cuál al punto medio del divisor.
    //
    // PRECISIÓN:
    //   El ADC de 10 bits (0-1023) da ~0.15°C de resolución en el
    //   rango 0-50°C. Suficiente para experimentos de física.
    // =========================================================================

    /**
     * Lee la temperatura de un sensor NTC 10K 3950 conectado a un pin
     * analógico con una resistencia fija de 10kΩ como divisor de tensión.
     *
     * Devuelve la temperatura con 1 decimal de precisión.
     *
     * @param pin Pin analógico donde está conectado el NTC
     * @param unidad Unidad de temperatura deseada
     * @returns Temperatura medida (con 1 decimal)
     */
    //% block="NTC 10K temperature on %pin in %unidad"
    //% blockId=fisicabit_ntc_10k
    //% group="External Sensors"
    //% weight=88
    //% pin.defl=PinAnalogico.P0
    //% unidad.defl=UnidadTemperatura.Celsius
    export function leerTemperaturaNTC(pin: PinAnalogico, unidad: UnidadTemperatura): number {
        let lectura: number
        switch (pin) {
            case PinAnalogico.P0: lectura = pins.analogReadPin(AnalogPin.P0); break
            case PinAnalogico.P1: lectura = pins.analogReadPin(AnalogPin.P1); break
            case PinAnalogico.P2: lectura = pins.analogReadPin(AnalogPin.P2); break
            default: lectura = 0
        }

        // Proteger contra lecturas extremas (divisor de tensión saturado)
        if (lectura <= 0) lectura = 1
        if (lectura >= 1023) lectura = 1022

        // Divisor de tensión: R_ntc = R_fija × lectura / (1023 - lectura)
        let rNtc = 10000.0 * lectura / (1023 - lectura)

        // Ecuación Beta: 1/T = 1/T₀ + (1/β) × ln(R_ntc / R₀)
        // T₀ = 298.15 K (25°C), β = 3950, R₀ = 10000 Ω
        let invT = 1.0 / 298.15 + (1.0 / 3950) * Math.log(rNtc / 10000)
        let tempC = 1.0 / invT - 273.15

        // Convertir a la unidad solicitada (1 decimal de precisión)
        switch (unidad) {
            case UnidadTemperatura.Celsius:
                return Math.round(tempC * 10) / 10
            case UnidadTemperatura.Fahrenheit:
                return Math.round((tempC * 9 / 5 + 32) * 10) / 10
            case UnidadTemperatura.Kelvin:
                return Math.round((tempC + 273.15) * 10) / 10
            default:
                return Math.round(tempC * 10) / 10
        }
    }


    // =========================================================================
    // GRUPO 4: BARRERA ÓPTICA — Medición de tiempo entre dos sensores
    // =========================================================================
    //
    // ¿QUÉ ES UNA BARRERA ÓPTICA?
    // ────────────────────────────
    // Un par emisor-receptor de luz (normalmente infrarroja) que detecta
    // cuándo un objeto interrumpe el haz de luz. Usamos DOS barreras
    // separadas una distancia conocida para medir:
    //
    //   - TIEMPO DE TRÁNSITO: cuánto tarda el objeto en ir de A a B
    //   - VELOCIDAD: distancia / tiempo (si conocemos la separación)
    //   - ACELERACIÓN: comparando velocidades en tramos consecutivos
    //
    // MONTAJE TÍPICO (vista lateral):
    //
    //   Barrera A                    Barrera B
    //   ┌──┐                        ┌──┐
    //   │IR│   ───objeto──►         │IR│
    //   │TX│        ●               │TX│
    //   └──┘    ┌───┴───┐           └──┘
    //   ┌──┐    │ rampa  │          ┌──┐
    //   │IR│    └────────┘          │IR│
    //   │RX│                        │RX│
    //   └──┘                        └──┘
    //    P1                          P2
    //   (pin A)     distancia      (pin B)
    //           ◄──────────────►
    //              (conocida)
    //
    //
    // SENSOR FC-33 (módulo de ranura):
    // ─────────────────────────────────
    //   ┌─────────────────────────┐
    //   │  FC-33                  │
    //   │  ┌───┐    ┌───┐        │  El LED IR y el fototransistor
    //   │  │LED│    │FOT│        │  están en una ranura de ~10mm.
    //   │  │ IR│    │OTR│        │  El objeto pasa por la ranura
    //   │  │   │    │   │        │  y corta el haz.
    //   │  └─┬─┘    └─┬─┘        │
    //   │    └──┬──┬──┘          │
    //   │       │  │  │          │  Pines:
    //   │      VCC GND OUT       │  - VCC: 3.3V-5V
    //   └─────────────────────────┘  - GND: tierra
    //                                - OUT: LOW cuando se corta el haz
    //   ⚠ El FC-33 tiene un comparador LM393 con potenciómetro
    //     de ajuste de sensibilidad en la placa. El umbral se
    //     ajusta con un destornillador, NO por software.
    //
    //   Señal del FC-33:
    //   HIGH ─────┐         ┌─────── HIGH (haz libre)
    //             │         │
    //   LOW       └─────────┘         (haz cortado = objeto presente)
    //             ↑         ↑
    //          objeto    objeto
    //          entra     sale
    //
    //
    // MONTAJE DIY CON LED IR + FOTOTRANSISTOR:
    // ──────────────────────────────────────────
    //
    //   EMISOR (LED IR):
    //   3V ──── R(100Ω) ──── LED IR ánodo(+) ──── cátodo(-) ──── GND
    //
    //   RECEPTOR (Fototransistor):
    //   3V ──── Fototransistor(C) ────┬──── P1 (señal analógica)
    //                                 │
    //                            R(10KΩ)
    //                                 │
    //                                GND
    //
    //   Sin objeto (haz libre):   P1 ≈ 800-1023 (mucha luz → alta tensión)
    //   Con objeto (haz cortado): P1 ≈ 0-200   (poca luz → baja tensión)
    //
    //   Señal analógica del montaje DIY:
    //   1023 ─────┐         ┌─────── (haz libre, mucha luz)
    //             │         │
    //             │  ~200   │
    //             └─────────┘         (haz cortado, poca luz)
    //              ↑         ↑
    //           objeto    objeto
    //           entra     sale
    //
    //   VENTAJA: el umbral se ajusta POR SOFTWARE → ideal para
    //   experimentar y calibrar desde MakeCode sin tocar el hardware.
    //
    //
    // PRECISIÓN DE TIMING:
    // ────────────────────
    // La medición de tiempo usa las funciones nativas C++ (shims.cpp)
    // con el TIMER3 del nRF52833 configurado a 1MHz (1 tick = 1μs).
    //
    //   TypeScript puro:  ~1ms de resolución (usa scheduler)
    //   C++ con TIMER:    ~1μs de resolución (acceso directo)
    //
    // Para un objeto a 1 m/s pasando por barreras a 10cm:
    //   Tiempo real: 100,000 μs = 100 ms
    //   Error TS:    ±1ms = ±1% → aceptable
    //   Error C++:   ±1μs = ±0.001% → excelente
    //
    // Para un objeto a 5 m/s (caída libre ~1.3m):
    //   Tiempo real: 20,000 μs = 20 ms
    //   Error TS:    ±1ms = ±5% → problemático
    //   Error C++:   ±1μs = ±0.005% → excelente
    //
    // CONCLUSIÓN: Para experimentos de física con objetos rápidos,
    // usar SIEMPRE las funciones nativas C++ (grupo "Nativo C++").
    // =========================================================================

    // ── Variables internas para el estado de la barrera ──
    let _barreraUmbralA = 512   // Umbral analógico barrera A (0-1023)
    let _barreraUmbralB = 512   // Umbral analógico barrera B (0-1023)
    let _barreraTiempoInicio = 0 // Timestamp de activación de barrera A
    let _barreraTiempoFin = 0    // Timestamp de activación de barrera B
    let _barreraActiva = false   // ¿Está esperando el paso por barrera B?


    /**
     * Ajusta el umbral de disparo (trigger) para una barrera analógica.
     *
     * Solo aplica cuando usas modo Analógico (LED IR DIY).
     * En modo Digital (FC-33), el umbral se ajusta con el potenciómetro
     * físico que tiene el módulo.
     *
     * CÓMO CALIBRAR:
     *   1. Sin objeto en la barrera → anotar valor (ej: 850)
     *   2. Con objeto bloqueando  → anotar valor (ej: 120)
     *   3. Umbral = punto medio = (850 + 120) / 2 = 485
     *   4. Usar este bloque para fijar el umbral a 485
     *
     * CONSEJO: Usa "enviar por serie" para ver los valores crudos
     *          y encontrar el umbral ideal para tu montaje.
     *
     * @param barrera Cuál barrera configurar ("A" = primera, "B" = segunda)
     * @param umbral Valor de 0 a 1023 que separa "haz libre" de "haz cortado"
     */
    //% block="set barrier %barrera threshold to %umbral"
    //% blockId=fisicabit_barrera_umbral
    //% group="Optical Barrier"
    //% weight=99
    //% umbral.min=0 umbral.max=1023 umbral.defl=512
    //% barrera.defl="A"
    export function fijarUmbralBarrera(barrera: string, umbral: number): void {
        if (barrera === "A" || barrera === "a") {
            _barreraUmbralA = umbral
        } else {
            _barreraUmbralB = umbral
        }
    }


    /**
     * Lee el valor crudo de una barrera óptica (para calibración).
     *
     * Usa este bloque para ver qué valores produce tu sensor
     * y así encontrar el umbral correcto.
     *
     * EJEMPLO DE CALIBRACIÓN:
     *   basic.forever(() => {
     *       let valorA = FisicaBit.leerBarreraCrudo(PinAnalogico.P1, ModoBarrera.Analogico)
     *       FisicaBit.enviarPorSerie("barrera_A_raw", valorA)
     *       FisicaBit.esperar(100)
     *   })
     *
     * @param pin Pin donde está conectada la barrera
     * @param modo Digital (FC-33) o Analógico (IR DIY)
     * @returns Valor crudo: Digital → 0 o 1, Analógico → 0 a 1023
     */
    //% block="read barrier raw pin %pin mode %modo"
    //% blockId=fisicabit_barrera_crudo
    //% group="Optical Barrier"
    //% weight=98
    //% pin.defl=PinAnalogico.P1
    //% modo.defl=ModoBarrera.Analogico
    export function leerBarreraCrudo(pin: PinAnalogico, modo: ModoBarrera): number {
        if (modo === ModoBarrera.Digital) {
            return pins.digitalReadPin(pin as number as DigitalPin)
        } else {
            return pins.analogReadPin(pin as number as AnalogPin)
        }
    }


    /**
     * Comprueba si una barrera óptica está activada (objeto presente).
     *
     * En modo DIGITAL (FC-33):
     *   - Devuelve true cuando OUT = LOW (haz cortado)
     *   - El FC-33 pone su salida a LOW cuando un objeto corta el haz
     *
     * En modo ANALÓGICO (IR DIY):
     *   - Devuelve true cuando la lectura < umbral configurado
     *   - Menos luz = menos voltaje = objeto bloqueando
     *
     * @param pin Pin de la barrera
     * @param modo Digital o Analógico
     * @returns true si hay un objeto cortando el haz
     */
    //% block="barrier triggered on %pin mode %modo"
    //% blockId=fisicabit_barrera_activada
    //% group="Optical Barrier"
    //% weight=97
    //% pin.defl=PinAnalogico.P1
    //% modo.defl=ModoBarrera.Digital
    export function barreraActivada(pin: PinAnalogico, modo: ModoBarrera): boolean {
        if (modo === ModoBarrera.Digital) {
            // FC-33: salida LOW = objeto presente
            return pins.digitalReadPin(pin as number as DigitalPin) === 0
        } else {
            // IR DIY: lectura analógica por debajo del umbral = objeto presente
            let valor = pins.analogReadPin(pin as number as AnalogPin)
            let umbral = (pin === PinAnalogico.P1) ? _barreraUmbralA :
                         (pin === PinAnalogico.P2) ? _barreraUmbralB :
                         _barreraUmbralA
            return valor < umbral
        }
    }


    /**
     * Mide el tiempo que tarda un objeto en pasar de la barrera A a la B.
     * VERSIÓN TYPESCRIPT — resolución ~1ms (usa control.millis).
     *
     * FUNCIONAMIENTO:
     *   1. Espera a que la barrera A se active (objeto entra)
     *   2. Captura el timestamp de inicio
     *   3. Espera a que la barrera B se active (objeto llega)
     *   4. Captura el timestamp de fin
     *   5. Devuelve la diferencia: fin - inicio
     *
     * LIMITACIONES:
     *   - Resolución de ~1ms (suficiente para objetos lentos)
     *   - Para objetos rápidos (>2 m/s), usar medirTiempoBarreraNativo()
     *   - Se bloquea hasta que ambas barreras se activen (o timeout)
     *
     * CABLEADO FC-33 (dos módulos):
     *   FC-33 #1 OUT → P1 (barrera A)
     *   FC-33 #2 OUT → P2 (barrera B)
     *   Ambos VCC → 3V, GND → GND
     *
     * CABLEADO IR DIY (dos pares emisor/receptor):
     *   Receptor #1 → P1 (barrera A, analógico)
     *   Receptor #2 → P2 (barrera B, analógico)
     *
     * @param pinA Pin de la barrera A (primera que se activa)
     * @param pinB Pin de la barrera B (segunda que se activa)
     * @param modo Digital (FC-33) o Analógico (IR DIY)
     * @param timeoutMs Timeout máximo en milisegundos (0 = sin timeout)
     * @returns Tiempo entre barreras en milisegundos, -1 si timeout
     */
    //% block="measure time barrier A %pinA → B %pinB mode %modo timeout %timeoutMs ms"
    //% blockId=fisicabit_barrera_tiempo
    //% group="Optical Barrier"
    //% weight=95
    //% pinA.defl=PinAnalogico.P1
    //% pinB.defl=PinAnalogico.P2
    //% modo.defl=ModoBarrera.Digital
    //% timeoutMs.defl=10000
    export function medirTiempoBarrera(
        pinA: PinAnalogico,
        pinB: PinAnalogico,
        modo: ModoBarrera,
        timeoutMs: number
    ): number {
        let inicio = control.millis()

        // ── Fase 1: Esperar a que barrera A esté LIBRE ──
        // (asegurarnos de que no hay objeto antes de empezar)
        while (barreraActivada(pinA, modo)) {
            if (timeoutMs > 0 && (control.millis() - inicio) > timeoutMs) {
                return -1
            }
            // Pequeña pausa para no saturar el bus
            control.waitMicros(50)
        }

        // ── Fase 2: Esperar a que barrera A se ACTIVE ──
        // (el objeto llega a la primera barrera)
        while (!barreraActivada(pinA, modo)) {
            if (timeoutMs > 0 && (control.millis() - inicio) > timeoutMs) {
                return -1
            }
            control.waitMicros(50)
        }

        // ── Capturar tiempo de inicio ──
        let t0 = control.millis()

        // ── Fase 3: Esperar a que barrera B se ACTIVE ──
        // (el objeto llega a la segunda barrera)
        while (!barreraActivada(pinB, modo)) {
            if (timeoutMs > 0 && (control.millis() - t0) > timeoutMs) {
                return -1
            }
            control.waitMicros(50)
        }

        // ── Capturar tiempo de fin ──
        let t1 = control.millis()

        // ── Guardar para consulta posterior ──
        _barreraTiempoInicio = t0
        _barreraTiempoFin = t1
        _barreraActiva = false

        return t1 - t0
    }


    /**
     * Mide el tiempo entre dos barreras usando C++ nativo.
     * VERSIÓN DE ALTA PRECISIÓN — resolución de 1μs.
     *
     * Usa el TIMER3 del nRF52833 a 1MHz para timing preciso.
     * En el simulador usa la versión TypeScript como fallback.
     *
     * CUÁNDO USAR ESTA VERSIÓN:
     *   - Objetos en caída libre (>1 m/s)
     *   - Medición de aceleración (necesitas alta precisión)
     *   - Distancias cortas entre barreras (<5cm)
     *   - Cualquier experimento donde ±1ms sea demasiado error
     *
     * @param pinA Número del pin de barrera A (ej: 1 para P1)
     * @param pinB Número del pin de barrera B (ej: 2 para P2)
     * @param modo Digital (0) o Analógico (1)
     * @param umbralA Umbral analógico barrera A (ignorado en digital)
     * @param umbralB Umbral analógico barrera B (ignorado en digital)
     * @param timeoutUs Timeout en microsegundos
     * @returns Tiempo en microsegundos, 0 si timeout
     */
    //% block="[C++] barrier time A P%pinA → B P%pinB mode %modo threshA %umbralA threshB %umbralB timeout %timeoutUs μs"
    //% blockId=fisicabit_barrera_nativo
    //% group="Optical Barrier"
    //% weight=93
    //% pinA.defl=1 pinB.defl=2
    //% modo.defl=ModoBarrera.Digital
    //% umbralA.defl=512 umbralB.defl=512
    //% timeoutUs.defl=5000000
    //% shim=fisicabit_native::medirTiempoBarreraNativo
    export function medirTiempoBarreraNativo(
        pinA: number,
        pinB: number,
        modo: ModoBarrera,
        umbralA: number,
        umbralB: number,
        timeoutUs: number
    ): number {
        // ── Fallback para simulador ──
        // En hardware real se ejecuta el C++ de shims.cpp
        let t = medirTiempoBarrera(
            pinA as PinAnalogico,
            pinB as PinAnalogico,
            modo,
            Math.idiv(timeoutUs, 1000)
        )
        return t >= 0 ? t * 1000 : 0  // Convertir ms→μs
    }


    /**
     * Calcula la velocidad de un objeto a partir del tiempo entre barreras.
     *
     * FÓRMULA: velocidad = distancia / tiempo
     *
     * EJEMPLO — Caída libre:
     *   Barreras separadas 10cm (0.1m)
     *   Tiempo medido: 50ms = 0.05s
     *   Velocidad: 0.1 / 0.05 = 2.0 m/s
     *
     * @param tiempoUs Tiempo entre barreras en microsegundos
     * @param distanciaMm Distancia entre barreras en milímetros
     * @returns Velocidad en m/s (multiplicada por 100 para 2 decimales)
     */
    //% block="velocity with time %tiempoUs μs distance %distanciaMm mm (×100 m/s)"
    //% blockId=fisicabit_barrera_velocidad
    //% group="Optical Barrier"
    //% weight=91
    //% tiempoUs.defl=50000 distanciaMm.defl=100
    export function calcularVelocidad(tiempoUs: number, distanciaMm: number): number {
        // velocidad (m/s) = distancia(mm) / tiempo(μs) × 1000
        //                  = distancia(mm) * 1000 / tiempo(μs)
        // Multiplicamos por 100 para tener 2 decimales como entero
        // Ejemplo: 2.35 m/s → devuelve 235
        if (tiempoUs <= 0) return 0
        return Math.idiv(distanciaMm * 100000, tiempoUs)
    }


    /**
     * Convierte un tiempo en microsegundos a la unidad deseada.
     *
     * @param tiempoUs Tiempo en microsegundos
     * @param unidad Unidad de salida deseada
     * @returns Tiempo en la unidad seleccionada (×100 para 2 decimales en ms y s)
     */
    //% block="convert %tiempoUs μs to %unidad"
    //% blockId=fisicabit_barrera_convertir_tiempo
    //% group="Optical Barrier"
    //% weight=89
    //% unidad.defl=UnidadTiempo.Milisegundos
    export function convertirTiempo(tiempoUs: number, unidad: UnidadTiempo): number {
        switch (unidad) {
            case UnidadTiempo.Microsegundos:
                return tiempoUs
            case UnidadTiempo.Milisegundos:
                // Devuelve ms × 100 para 2 decimales → 12345μs = 1234 (12.34ms)
                return Math.idiv(tiempoUs, 10)
            case UnidadTiempo.Segundos:
                // Devuelve s × 100 para 2 decimales → 1234567μs = 123 (1.23s)
                return Math.idiv(tiempoUs, 10000)
            default:
                return tiempoUs
        }
    }


    /**
     * Mide cuánto tiempo un objeto bloquea UNA sola barrera.
     * Útil para medir el ancho/longitud de un objeto en movimiento.
     *
     * Si conoces la velocidad del objeto:
     *   longitud = velocidad × tiempo_de_bloqueo
     *
     * @param pin Pin de la barrera
     * @param modo Digital o Analógico
     * @param timeoutMs Timeout en milisegundos
     * @returns Tiempo de bloqueo en milisegundos, -1 si timeout
     */
    //% block="blocking time on %pin mode %modo timeout %timeoutMs ms"
    //% blockId=fisicabit_barrera_bloqueo
    //% group="Optical Barrier"
    //% weight=87
    //% pin.defl=PinAnalogico.P1
    //% modo.defl=ModoBarrera.Digital
    //% timeoutMs.defl=10000
    export function medirTiempoBloqueo(
        pin: PinAnalogico,
        modo: ModoBarrera,
        timeoutMs: number
    ): number {
        let inicio = control.millis()

        // Esperar a que la barrera esté libre
        while (barreraActivada(pin, modo)) {
            if (timeoutMs > 0 && (control.millis() - inicio) > timeoutMs) return -1
            control.waitMicros(50)
        }

        // Esperar a que el objeto entre (bloquee la barrera)
        while (!barreraActivada(pin, modo)) {
            if (timeoutMs > 0 && (control.millis() - inicio) > timeoutMs) return -1
            control.waitMicros(50)
        }
        let t0 = control.millis()

        // Esperar a que el objeto salga (deje de bloquear)
        while (barreraActivada(pin, modo)) {
            if (timeoutMs > 0 && (control.millis() - t0) > timeoutMs) return -1
            control.waitMicros(50)
        }
        let t1 = control.millis()

        return t1 - t0
    }


    // =========================================================================
    // GRUPO 5: CONVERSIONES DE UNIDADES
    // =========================================================================

    /**
     * Convierte temperatura entre Celsius, Fahrenheit y Kelvin.
     *
     * Fórmulas:
     *   °F = °C × 9/5 + 32
     *   K  = °C + 273.15
     *
     * @param valor Temperatura a convertir
     * @param de Unidad de origen
     * @param a Unidad de destino
     * @returns Temperatura convertida
     */
    //% block="convert %valor from %de to %a"
    //% blockId=fisicabit_convertir_temp
    //% group="Conversions"
    //% weight=70
    export function convertirTemperatura(
        valor: number,
        de: UnidadTemperatura,
        a: UnidadTemperatura
    ): number {
        // Primero convertimos todo a Celsius como base
        let celsius = valor
        if (de === UnidadTemperatura.Fahrenheit) {
            celsius = (valor - 32) * 5 / 9
        } else if (de === UnidadTemperatura.Kelvin) {
            celsius = valor - 273
        }

        // Luego convertimos de Celsius a la unidad destino
        switch (a) {
            case UnidadTemperatura.Celsius:
                return Math.round(celsius)
            case UnidadTemperatura.Fahrenheit:
                return Math.round(celsius * 9 / 5 + 32)
            case UnidadTemperatura.Kelvin:
                return Math.round(celsius + 273)
            default:
                return Math.round(celsius)
        }
    }


    /**
     * Mapea un valor analógico (0-1023) a un rango personalizado.
     *
     * Útil para convertir lecturas crudas del ADC a unidades físicas.
     * Usa la fórmula: resultado = (valor - entradaMin) × (salidaMax - salidaMin)
     *                              / (entradaMax - entradaMin) + salidaMin
     *
     * EJEMPLO — Convertir lectura de NTC a temperatura:
     *   let lectura = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
     *   let tempC = FisicaBit.mapearValor(lectura, 0, 1023, -10, 50)
     *
     * @param valor Valor de entrada a mapear
     * @param entradaMin Mínimo del rango de entrada
     * @param entradaMax Máximo del rango de entrada
     * @param salidaMin Mínimo del rango de salida
     * @param salidaMax Máximo del rango de salida
     * @returns Valor mapeado al nuevo rango
     */
    //% block="map %valor from (%entradaMin — %entradaMax) to (%salidaMin — %salidaMax)"
    //% blockId=fisicabit_mapear
    //% group="Conversions"
    //% weight=65
    export function mapearValor(
        valor: number,
        entradaMin: number,
        entradaMax: number,
        salidaMin: number,
        salidaMax: number
    ): number {
        return Math.round(
            (valor - entradaMin) * (salidaMax - salidaMin)
            / (entradaMax - entradaMin)
            + salidaMin
        )
    }


    // =========================================================================
    // GRUPO 5: FUNCIONES NATIVAS C++ (via shims)
    // =========================================================================
    // Estas funciones llaman a código C++ compilado directamente.
    // Son más rápidas que TypeScript para operaciones de bajo nivel.
    //
    // CÓMO FUNCIONA EL PUENTE TS ↔ C++:
    //   1. Se declara la función en shims.d.ts con //% shim=nombre
    //   2. Se implementa en shims.cpp con el mismo nombre
    //   3. MakeCode genera el puente automáticamente al compilar
    //
    // Ver shims.cpp y shims.d.ts para las implementaciones.
    // =========================================================================

    /**
     * Lee el ADC del nRF52 directamente usando código C++ nativo.
     * Esto bypasea la capa de abstracción de MakeCode y es más rápido.
     *
     * Implementación: ver shims.cpp → leerADCNativo()
     *
     * @param canal Canal ADC (0-7, corresponde a los pines analógicos)
     * @returns Valor crudo del ADC de 12 bits (0-4095)
     */
    //% block="[C++] read native ADC channel %canal"
    //% blockId=fisicabit_adc_nativo
    //% group="Native C++"
    //% weight=50
    //% shim=fisicabit_native::leerADCNativo
    export function leerADCNativo(canal: number): number {
        // Este cuerpo solo se ejecuta en el simulador.
        // En hardware real, se ejecuta el código C++ de shims.cpp
        return pins.analogReadPin(AnalogPin.P0)
    }

    /**
     * Mide un pulso con precisión de microsegundos usando C++ nativo.
     * Ideal para sensores que requieren timing preciso (DHT11, OneWire).
     *
     * @param pin Número del pin digital
     * @param nivelAlto true para medir pulso HIGH, false para LOW
     * @param timeoutUs Timeout en microsegundos
     * @returns Duración del pulso en microsegundos
     */
    //% block="[C++] measure pulse pin P%pin level %nivelAlto timeout %timeoutUs μs"
    //% blockId=fisicabit_pulso_nativo
    //% group="Native C++"
    //% weight=45
    //% shim=fisicabit_native::medirPulsoNativo
    export function medirPulsoNativo(pin: number, nivelAlto: boolean, timeoutUs: number): number {
        // Fallback para simulador
        return 0
    }

    /**
     * Lee múltiples muestras del ADC rápidamente (burst mode) con C++.
     * Devuelve el promedio de N lecturas para reducir ruido.
     *
     * @param canal Canal ADC
     * @param muestras Número de muestras a promediar (1-64)
     * @returns Promedio de las lecturas (0-4095)
     */
    //% block="[C++] read ADC average channel %canal samples %muestras"
    //% blockId=fisicabit_adc_promedio
    //% group="Native C++"
    //% weight=40
    //% shim=fisicabit_native::leerADCPromedio
    export function leerADCPromedio(canal: number, muestras: number): number {
        // Fallback para simulador: promediar en TS
        let suma = 0
        for (let i = 0; i < muestras; i++) {
            suma += pins.analogReadPin(AnalogPin.P0)
        }
        return Math.idiv(suma, muestras)
    }


    // =========================================================================
    // GRUPO 7: UTILIDADES
    // =========================================================================

    /**
     * Muestra el valor de un sensor en la pantalla LED con scroll.
     * Formato: "ETIQUETA: VALOR"
     *
     * @param etiqueta Texto descriptivo (ej: "Temp")
     * @param valor Valor numérico a mostrar
     */
    //% block="show on LED %etiqueta : %valor"
    //% blockId=fisicabit_mostrar_led
    //% group="Utilities"
    //% weight=30
    export function mostrarEnLED(etiqueta: string, valor: number): void {
        basic.showString(etiqueta + ":" + Math.round(valor))
    }
}


// =============================================================================
// NAMESPACE SECUNDARIO — "FisicaBit Kinematics"
// =============================================================================
//  Categoría independiente en la toolbox de MakeCode, con COLOR DISTINTO
//  al del namespace principal "FisicaBit Sensors" (#E64322, naranja) para
//  que los bloques de magnitudes CINEMÁTICAS derivadas (aceleración total
//  y velocidad instantánea) se distingan visualmente de los bloques que
//  sólo leen sensores.
//
//  Se usa un namespace aparte (y no un `group=` dentro de FisicaBit) porque
//  en PXT el color de un bloque lo fija el namespace al que pertenece: la
//  ÚNICA forma limpia de que un bloque tenga otro color es ponerlo en otro
//  namespace.
// =============================================================================
//% weight=99
//% color=#1E88E5
//% icon="\uf1b2"
//% block="FisicaBit Kinematics"
//% groups="['Acceleration', 'Orientation', 'Calibration & gravity', 'Instantaneous velocity']"
namespace FisicaBitCinematica {

    // =========================================================================
    // GRUPO A: ACELERACIÓN EN m/s² — ALGORITMO AVANZADO
    // =========================================================================
    //
    //  TEORÍA DEL SENSOR (LSM303AGR en micro:bit v2 / MMA8653FC en v1):
    //  ─────────────────────────────────────────────────────────────────
    //  El chip es un MEMS capacitivo de 3 ejes. Dentro del die de silicio
    //  hay una masa de prueba suspendida por muelles microscópicos.
    //  Cuando el sistema acelera, la masa se desplaza respecto a electrodos
    //  fijos y cambia la capacidad del condensador diferencial. Un ASIC
    //  interno convierte ese desbalance capacitivo a un número digital
    //  de 10 bits (escala ±2 g por defecto) que MakeCode expone en
    //  miligravedades (1 g = 1000 mg ≈ 1024 en la API por redondeo).
    //
    //  PUNTO CRÍTICO — QUÉ MIDE REALMENTE EL ACELERÓMETRO:
    //  ─────────────────────────────────────────────────────
    //  NO mide "aceleración" en el sentido newtoniano (dv/dt). Mide
    //  ACELERACIÓN PROPIA (proper acceleration): la aceleración sentida
    //  por un observador en reposo relativo al sensor. Es la suma
    //  vectorial de todas las fuerzas NO gravitatorias por unidad de masa.
    //
    //  Consecuencia: en reposo sobre el suelo el sensor NO mide 0. Mide
    //  +1 g apuntando hacia ARRIBA, porque la normal del suelo ejerce
    //  una fuerza igual y opuesta al peso. En caída libre mide 0 (no hay
    //  normal), aunque el cuerpo está acelerando a 9,81 m/s² hacia abajo.
    //
    //       a_propia  =  a_coordenada  +  (−g⃗)
    //  ⇒    a_coordenada  =  a_propia  −  (−g⃗)  =  a_propia  +  g⃗
    //
    //  ALGORITMO IMPLEMENTADO — "Gravity Tracking + Bias Cancellation":
    //  ─────────────────────────────────────────────────────────────────
    //       g⃗_{k+1}  =  (1−α)·g⃗_k  +  α·a⃗_{raw,k}        (LPF, fc≈0,5 Hz)
    //       a⃗_lineal_k  =  a⃗_{raw,k}  −  g⃗_k  −  bias⃗   (HPF por diferencia)
    //
    //  Además, la aceleración "respecto al suelo" en la vertical real se
    //  obtiene proyectando a⃗_lineal sobre el versor −ĝ:
    //
    //       ĝ  =  g⃗ / |g⃗|
    //       a_vertical↑  =  − (a⃗_lineal · ĝ)
    //
    //  DEFENSAS CONTRA PICOS ESPURIOS EN REPOSO:
    //  ─────────────────────────────────────────
    //  (a) MEDIANA DESLIZANTE de 3 muestras sobre la lectura cruda
    //      → rechaza outliers de un solo sample (glitches I²C, EMI).
    //  (b) DEADBAND de 5 mg sobre la aceleración lineal ya calculada
    //      → absorbe el ruido gaussiano residual (≈3 mg σ) y fija la
    //      salida a EXACTAMENTE 0,00 m/s² cuando el cuerpo está quieto.
    // =========================================================================

    // ── Constantes físicas ──
    const G0 = 9.80665               // m/s² — gravedad estándar (CODATA)
    const MG_A_MS2 = 9.80665 / 1000  // factor mg → m/s²

    // ── Estado del estimador de gravedad (filtro EMA) ──
    let _gvx = 0        // componente X del vector gravedad estimado (mg)
    let _gvy = 0        // componente Y                               (mg)
    let _gvz = -1000    // componente Z (placa plana, cara arriba)     (mg)
    let _gAlpha = 0.05  // constante del pasabajos (α) — fc ≈ 0.8 Hz a 100 Hz ODR
    let _gInit = false  // ¿ya inicializamos la gravedad?
    let _gLocked = false // tras calibrar, se congela el vector gravedad

    // ── Filtro anti-pico sobre la lectura cruda del acelerómetro ────
    // El LSM303AGR tira de forma ocasional "outliers" de un solo sample
    // (10-50 mg de desviación súbita) por ruido eléctrico, jitter del
    // bus I²C, EMI de los LED, etc. La MEDIANA DESLIZANTE de las 3
    // últimas muestras por eje rechaza CUALQUIER outlier aislado sin
    // añadir apenas latencia (retardo efectivo ≤ 1 muestra ≈ 10-20 ms
    // a la ODR por defecto de 100 Hz). Se aplica ANTES del estimador
    // EMA para que los outliers tampoco contaminen la referencia.
    let _histAx: number[] = [0, 0, 0]
    let _histAy: number[] = [0, 0, 0]
    let _histAz: number[] = [0, 0, 0]
    let _histIdx = 0
    let _histInit = false

    // Zona muerta (deadband) de la aceleración LINEAL, en mg. Bajo este
    // umbral (por cada eje) la componente se clampa a 0 para que el
    // reposo dé EXACTAMENTE 0,00 m/s² en TODOS los modos (X, Y, Z,
    // Magnitud y Vertical) y no sólo en los ejes individuales.
    //
    // 10 mg ≈ 0,10 m/s² está por encima del ruido típico (~3 mg RMS
    // después del filtro de mediana), con un margen de ~3σ que cubre
    // el 99,7% de las fluctuaciones gaussianas residuales.
    //
    // IMPORTANTE: se aplica POR EJE antes de combinarlos. Aplicar la
    // deadband sólo al resultado final (Magnitud = √(lx²+ly²+lz²))
    // fallaba porque la magnitud acumula ruido de los tres ejes y
    // superaba los 5 mg con frecuencia aunque cada componente fuera
    // sub-umbral. Con deadband por eje, cada componente se fuerza a 0
    // y tanto Magnitud como Vertical dan 0 exacto garantizado en reposo.
    //
    // NO se aplica a la aceleración PROPIA (ahí el reposo vale ~1000 mg).
    const DEADBAND_LINEAL_MG = 10

    // ── Modo dual: acelerómetro + magnetómetro ──────────────────────
    // Por defecto OFF: el bloque `leerAceleracionLineal` se comporta
    // EXACTAMENTE igual que antes (EMA simple). Se activa automática-
    // mente al llamar `calibrarMagnetometro()` o manualmente con
    // `habilitarModoDual()`. Preserva retrocompatibilidad estricta:
    // todos los programas existentes siguen funcionando idénticos.
    let _dualModeEnabled = false

    // ── Calibración del magnetómetro (hard-iron + soft-iron) ───────
    let _magCalibrated = false
    let _magOffX = 0, _magOffY = 0, _magOffZ = 0   // hard-iron (μT)
    let _magScX = 1, _magScY = 1, _magScZ = 1      // soft-iron scales
    let _magNominalNorm = 0                         // |m| nominal (μT)
    let _magCalQuality = 0                          // 0-100 %

    // ── Filtro EMA del magnetómetro (μT) ───────────────────────────
    let _fmx = 0, _fmy = 0, _fmz = 0
    let _magAlpha = 0.15
    let _magFiltInit = false
    let _magDisturbed = false

    // ── Orientación estimada (radianes internamente; los bloques ──
    // reporter la exponen en grados).
    let _estPitch = 0, _estRoll = 0, _estYaw = 0

    // ── Gravedad trigonométrica proyectada al marco sensor (mg) ────
    let _gTrigX = 0, _gTrigY = 0, _gTrigZ = -1000

    // ── LPF adaptativo de gravedad (mg) ────────────────────────────
    // α grande (0,05) en reposo para converger rápido, y α muy pequeña
    // (0,001) durante movimiento para que aceleraciones sostenidas no
    // sean absorbidas por el filtro.
    let _gLpfX = 0, _gLpfY = 0, _gLpfZ = -1000
    let _gLpfInit = false
    const _gLpfAlphaMax = 0.05
    const _gLpfAlphaMin = 0.001
    const _motionThresholdMg = 150

    /**
     * Mediana de tres valores sin ordenar: identidad
     *   mediana(a,b,c) = a + b + c − max(a,b,c) − min(a,b,c).
     */
    function _median3(a: number, b: number, c: number): number {
        const mn = Math.min(a, Math.min(b, c))
        const mx = Math.max(a, Math.max(b, c))
        return a + b + c - mn - mx
    }

    /**
     * Lee el acelerómetro crudo, empuja la muestra a la ventana
     * deslizante de 3 y devuelve [ax, ay, az] en mg YA filtrados por
     * mediana. La primera llamada rellena la ventana con la muestra
     * inicial para evitar un pico de arranque.
     */
    function _leerAcelRawFiltrado(): number[] {
        const rx = input.acceleration(Dimension.X)
        const ry = input.acceleration(Dimension.Y)
        const rz = input.acceleration(Dimension.Z)

        if (!_histInit) {
            _histAx = [rx, rx, rx]
            _histAy = [ry, ry, ry]
            _histAz = [rz, rz, rz]
            _histInit = true
        } else {
            _histAx[_histIdx] = rx
            _histAy[_histIdx] = ry
            _histAz[_histIdx] = rz
            _histIdx = (_histIdx + 1) % 3
        }

        return [
            _median3(_histAx[0], _histAx[1], _histAx[2]),
            _median3(_histAy[0], _histAy[1], _histAy[2]),
            _median3(_histAz[0], _histAz[1], _histAz[2])
        ]
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS DEL MODO DUAL (magnetómetro + orientación + LPF dual)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Lee el magnetómetro crudo, aplica hard-iron (offset) + soft-iron
     * (escala) y un filtro EMA. Devuelve [mx, my, mz] en μT.
     *
     * Robustez: si el sensor devuelve 0 en los 3 ejes (no disponible),
     * preserva el último estado para no contaminar con ceros. Si no hay
     * calibración cargada, _magOff*=0 y _magSc*=1 hacen la calibración
     * identidad (aunque el yaw no tendrá sentido sin calibrar).
     */
    function _leerMagFiltrado(): number[] {
        const rx = input.magneticForce(Dimension.X)
        const ry = input.magneticForce(Dimension.Y)
        const rz = input.magneticForce(Dimension.Z)

        // Sensor no disponible → mantener filtro
        if (rx === 0 && ry === 0 && rz === 0 && _magFiltInit) {
            return [_fmx, _fmy, _fmz]
        }

        // Aplicar calibración (identidad si no se calibró)
        const cx = (rx - _magOffX) * _magScX
        const cy = (ry - _magOffY) * _magScY
        const cz = (rz - _magOffZ) * _magScZ

        if (!_magFiltInit) {
            _fmx = cx; _fmy = cy; _fmz = cz
            _magFiltInit = true
        } else {
            _fmx = _magAlpha * cx + (1 - _magAlpha) * _fmx
            _fmy = _magAlpha * cy + (1 - _magAlpha) * _fmy
            _fmz = _magAlpha * cz + (1 - _magAlpha) * _fmz
        }

        // Detección de perturbación: |m_cal| se desvía >25% del nominal
        if (_magCalibrated && _magNominalNorm > 0) {
            const normM = Math.sqrt(_fmx * _fmx + _fmy * _fmy + _fmz * _fmz)
            const devAbs = normM - _magNominalNorm
            const dev = (devAbs < 0 ? -devAbs : devAbs) / _magNominalNorm
            _magDisturbed = dev > 0.25
        }

        return [_fmx, _fmy, _fmz]
    }

    /**
     * Pitch y roll desde el acelerómetro (ST DT0058 eq. 1-2) + yaw
     * tilt-compensado desde el magnetómetro calibrado (ST DT0058
     * eq. 3-5). Actualiza _estPitch / _estRoll / _estYaw en radianes,
     * y _gTrig{X,Y,Z} en mg (gravedad proyectada al marco del sensor).
     *
     * Singularidad (NXP AN3461): cuando los ejes Y/Z se alinean con la
     * gravedad (ay²+az² < 100), el pitch se degenera — forzamos ±π/2
     * según el signo de ax. El umbral 100 mg² ≈ (10 mg)² está sobre
     * el ruido del sensor (~3 mg RMS).
     */
    function _calcularOrientacion(ax: number, ay: number, az: number): void {
        // 1) Pitch y roll desde accel
        const yz2 = ay * ay + az * az
        let pitch: number
        if (yz2 < 100) {
            pitch = ax > 0 ? -Math.PI / 2 : Math.PI / 2
        } else {
            pitch = Math.atan2(-ax, Math.sqrt(yz2))
        }
        const roll = Math.atan2(ay, az)
        _estPitch = pitch
        _estRoll = roll

        // 2) Gravedad proyectada al marco sensor
        const sinP = Math.sin(pitch), cosP = Math.cos(pitch)
        const sinR = Math.sin(roll), cosR = Math.cos(roll)
        _gTrigX = -sinP * 1000
        _gTrigY = cosP * sinR * 1000
        _gTrigZ = cosP * cosR * 1000

        // 3) Yaw (tilt-compensated heading) sólo si mag calibrado y sin
        //    perturbación detectada. Si no, _estYaw conserva el valor
        //    previo (inicial 0).
        if (_magCalibrated && !_magDisturbed) {
            const mx = _fmx, my = _fmy, mz = _fmz
            const mxp = mx * cosP + mz * sinP
            const myp = mx * sinR * sinP + my * cosR - mz * sinR * cosP
            _estYaw = Math.atan2(-myp, mxp)
        }
    }

    /**
     * LPF adaptativo de gravedad: α grande (0,05) cuando |a|≈1g para
     * converger rápido, y α muy pequeña (0,001) cuando |a|≠1g para NO
     * absorber aceleraciones sostenidas en el filtro — si integramos
     * el filtro durante un tramo acelerado, la "gravedad estimada"
     * se corrompería y la aceleración lineal saldría subestimada.
     */
    function _actualizarGravedadLPFAdaptativo(ax: number, ay: number, az: number): void {
        const norm = Math.sqrt(ax * ax + ay * ay + az * az)
        const diff = norm - 1000
        const absErr = diff < 0 ? -diff : diff
        const alpha = absErr > _motionThresholdMg ? _gLpfAlphaMin : _gLpfAlphaMax

        if (!_gLpfInit) {
            _gLpfX = ax; _gLpfY = ay; _gLpfZ = az
            _gLpfInit = true
        } else {
            _gLpfX = alpha * ax + (1 - alpha) * _gLpfX
            _gLpfY = alpha * ay + (1 - alpha) * _gLpfY
            _gLpfZ = alpha * az + (1 - alpha) * _gLpfZ
        }
    }

    /**
     * Estimación DUAL de la gravedad: combina (a) proyección trigono-
     * métrica pitch/roll — precisa y sigue rotaciones instantáneamente
     * pero se corrompe cuando |a|≠1g — con (b) LPF adaptativo, robusto
     * en movimiento pero lento a rotaciones.
     *
     * Crossfade automático según |norm_a − 1g|:
     *   - Cuerpo quieto (error <100 mg) ⇒ 100 % trigonométrico
     *   - Movimiento fuerte (error >250 mg) ⇒ 100 % LPF
     *   - En medio: interpola linealmente.
     *
     * Escribe en _gvx/_gvy/_gvz (las mismas variables que el EMA
     * simple) así `leerAceleracionLineal` no necesita cambiar nada más.
     * Validación NaN con el truco `x === x` antes de asignar.
     */
    function _actualizarGravedadDual(ax: number, ay: number, az: number): void {
        // Refrescar magnetómetro filtrado (también detecta disturbios)
        _leerMagFiltrado()

        // Pitch/roll/yaw + gravedad trigonométrica
        _calcularOrientacion(ax, ay, az)

        // LPF adaptativo
        _actualizarGravedadLPFAdaptativo(ax, ay, az)

        // Blend según cuánto se aleja |a| de 1 g
        const norm = Math.sqrt(ax * ax + ay * ay + az * az)
        const diff = norm - 1000
        const absErr = diff < 0 ? -diff : diff
        let blend = (absErr - 100) / 150
        if (blend < 0) blend = 0
        if (blend > 1) blend = 1

        const gx = (1 - blend) * _gTrigX + blend * _gLpfX
        const gy = (1 - blend) * _gTrigY + blend * _gLpfY
        const gz = (1 - blend) * _gTrigZ + blend * _gLpfZ

        // NaN-safe assignment
        if (gx === gx) _gvx = gx
        if (gy === gy) _gvy = gy
        if (gz === gz) _gvz = gz
        _gInit = true
    }

    // ─────────────────────────────────────────────────────────────────
    // BLOQUES DE CALIBRACIÓN Y GRAVEDAD
    // ─────────────────────────────────────────────────────────────────

    /**
     * Calibra el acelerómetro midiendo el vector gravedad del entorno
     * mientras el cuerpo está en REPOSO absoluto. Toma N muestras,
     * promedia y congela la referencia para que todas las lecturas
     * posteriores de "acceleration on axis" le resten exactamente ese
     * vector (en reposo ⇒ 0,00 m/s²).
     *
     * @param muestras Número de muestras a promediar (50-500). Def. 200.
     */
    //% block="calibrate accelerometer at rest (%muestras samples)"
    //% blockId=fisicabit_cin_calibrar
    //% group="Calibration & gravity"
    //% weight=100
    //% muestras.min=50 muestras.max=500 muestras.defl=200
    export function calibrarAcelerometro(muestras: number): void {
        let sx = 0, sy = 0, sz = 0
        for (let i = 0; i < muestras; i++) {
            sx += input.acceleration(Dimension.X)
            sy += input.acceleration(Dimension.Y)
            sz += input.acceleration(Dimension.Z)
            basic.pause(10) // 100 Hz de muestreo → 10 ms por muestra
        }
        _gvx = sx / muestras
        _gvy = sy / muestras
        _gvz = sz / muestras
        _gInit = true
        // Bloqueamos el EMA: referencia fija → invariante "quieto ⇒ 0"
        // y además no absorbe aceleraciones sostenidas.
        _gLocked = true
    }

    /**
     * Fuerza una actualización puntual del estimador EMA de gravedad
     * a partir de la lectura cruda actual. Si la calibración está
     * bloqueada, no hace nada.
     */
    //% block="update gravity estimate"
    //% blockId=fisicabit_cin_actualizar_gravedad
    //% group="Calibration & gravity"
    //% weight=99
    export function actualizarGravedad(): void {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)
        if (!_gInit) {
            _gvx = ax; _gvy = ay; _gvz = az
            _gInit = true
            return
        }
        if (_gLocked) return
        _gvx = (1 - _gAlpha) * _gvx + _gAlpha * ax
        _gvy = (1 - _gAlpha) * _gvy + _gAlpha * ay
        _gvz = (1 - _gAlpha) * _gvz + _gAlpha * az
    }

    /**
     * Fija la constante α del filtro pasabajos de gravedad.
     *   α = 0.01 → fc ≈ 0,16 Hz (máxima limpieza, sin rotaciones).
     *   α = 0.05 → fc ≈ 0,8 Hz  (por defecto, buen compromiso).
     *   α = 0.20 → fc ≈ 3,5 Hz  (sólo si hay rotaciones frecuentes).
     *
     * @param alfa Constante del filtro (0,001-0,5). Def. 0,05.
     */
    //% block="set gravity filter α to %alfa"
    //% blockId=fisicabit_cin_fijar_alfa
    //% group="Calibration & gravity"
    //% weight=98
    //% alfa.min=0.001 alfa.max=0.5 alfa.defl=0.05
    export function fijarAlfaGravedad(alfa: number): void {
        if (alfa < 0.001) alfa = 0.001
        if (alfa > 0.5) alfa = 0.5
        _gAlpha = alfa
    }

    /**
     * Vuelve a habilitar el seguimiento adaptativo del vector gravedad
     * (desbloquea el EMA) tras una calibración. Usar sólo si el cuerpo
     * va a cambiar de orientación durante el experimento.
     */
    //% block="unlock gravity tracking"
    //% blockId=fisicabit_cin_unlock
    //% group="Calibration & gravity"
    //% weight=97
    export function desbloquearGravedad(): void {
        _gLocked = false
    }

    /**
     * Fija el rango de medición del acelerómetro.
     *      ±2 g  →  ≈3,9 mg/bit   (por defecto)
     *      ±4 g  →  ≈7,8 mg/bit
     *      ±8 g  →  ≈15,6 mg/bit
     * Elegir el MÁS PEQUEÑO que no sature durante el experimento.
     */
    //% block="set accelerometer range %rango"
    //% blockId=fisicabit_cin_rango
    //% group="Calibration & gravity"
    //% weight=96
    //% rango.defl=RangoAcelerometro.Rango2G
    export function fijarRangoAcelerometro(rango: RangoAcelerometro): void {
        input.setAccelerometerRange(rango as any)
    }

    /**
     * Módulo del vector gravedad estimado actualmente, en mg. En reposo
     * debería valer ≈1000 mg. Diagnóstico: si no lo hace, el cuerpo se
     * está moviendo o la calibración es incorrecta.
     */
    //% block="|g estimated| (mg)"
    //% blockId=fisicabit_cin_mod_gravedad
    //% group="Calibration & gravity"
    //% weight=70
    export function moduloGravedadEstimada(): number {
        return Math.round(Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz))
    }

    /**
     * Convierte un valor de miligravedades (mg) a m/s² usando g₀ CODATA.
     * Devuelve con 2 decimales.
     */
    //% block="convert %mg mg → m/s²"
    //% blockId=fisicabit_cin_mg_a_ms2
    //% group="Calibration & gravity"
    //% weight=60
    export function convertirMgAMs2(mg: number): number {
        return Math.round(mg * MG_A_MS2 * 100) / 100
    }

    // ─────────────────────────────────────────────────────────────────
    // BLOQUES DEL MODO DUAL (acelerómetro + magnetómetro)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Calibra el magnetómetro midiendo el campo durante ~10 s mientras
     * el usuario rota el micro:bit en el aire en todas direcciones
     * (figura "8"). Calcula offsets hard-iron (centro del elipsoide)
     * y escalas soft-iron (para convertir el elipsoide en esfera),
     * valida el rango y activa automáticamente el MODO DUAL.
     *
     * PROCEDIMIENTO PARA EL AULA:
     *   1) Ejecutar este bloque. Aparece "8" en pantalla.
     *   2) Rotar lentamente el micro:bit en el aire durante ~10 s
     *      cubriendo todas las direcciones espaciales.
     *   3) Al terminar aparece ✓ (calibración válida) o ✗ (inválida).
     *
     * VALIDACIÓN: rango por eje ≥ 20 μT (si no, se descarta).
     */
    //% block="calibrate magnetometer (rotate micro:bit)"
    //% blockId=fisicabit_cin_cal_mag
    //% group="Calibration & gravity"
    //% weight=95
    export function calibrarMagnetometro(): void {
        const N = 300
        let minX = 99999, maxX = -99999
        let minY = 99999, maxY = -99999
        let minZ = 99999, maxZ = -99999

        basic.showString("8")
        basic.pause(500)

        for (let i = 0; i < N; i++) {
            const mx = input.magneticForce(Dimension.X)
            const my = input.magneticForce(Dimension.Y)
            const mz = input.magneticForce(Dimension.Z)
            if (mx < minX) minX = mx
            if (mx > maxX) maxX = mx
            if (my < minY) minY = my
            if (my > maxY) maxY = my
            if (mz < minZ) minZ = mz
            if (mz > maxZ) maxZ = mz

            // Barrido de progreso en la fila central (y=2): una LED
            // cada ~60 muestras, 5 LEDs = ~300 muestras.
            const col = Math.idiv(i, 60)
            if (col < 5) led.plot(col, 2)
            basic.pause(30)
        }
        basic.clearScreen()

        // Hard-iron: centro del elipsoide por eje
        const ox = (maxX + minX) / 2
        const oy = (maxY + minY) / 2
        const oz = (maxZ + minZ) / 2

        // Soft-iron: semi-amplitud por eje (radio del elipsoide)
        const rx = (maxX - minX) / 2
        const ry = (maxY - minY) / 2
        const rz = (maxZ - minZ) / 2

        // Validación: rango mínimo por eje
        if (rx < 20 || ry < 20 || rz < 20) {
            basic.showIcon(IconNames.No)
            basic.pause(800)
            basic.clearScreen()
            _magCalibrated = false
            _magCalQuality = 0
            serial.writeLine("#CAL:MAG:invalid range rx=" + rx + " ry=" + ry + " rz=" + rz)
            return
        }

        // Escalas para transformar elipsoide → esfera de radio avgR
        const avgR = (rx + ry + rz) / 3
        _magOffX = ox; _magOffY = oy; _magOffZ = oz
        _magScX = avgR / rx
        _magScY = avgR / ry
        _magScZ = avgR / rz
        _magNominalNorm = avgR

        // Score de calidad: uniformidad de los radios. rx=ry=rz → q=100.
        const maxR = Math.max(rx, Math.max(ry, rz))
        const minR = Math.min(rx, Math.min(ry, rz))
        const uniformity = 1 - (maxR - minR) / avgR
        let q = uniformity * 100
        if (q < 0) q = 0
        if (q > 100) q = 100
        _magCalQuality = Math.round(q)

        _magCalibrated = true
        _dualModeEnabled = true
        _magFiltInit = false     // re-inicializar filtro con cal nueva
        _gLpfInit = false        // re-inicializar LPF de gravedad

        basic.showIcon(IconNames.Yes)
        basic.pause(800)
        basic.clearScreen()
    }

    /**
     * Carga una calibración de magnetómetro pre-existente sin ejecutar
     * el procedimiento de rotación. Útil si ya calibraste una vez y
     * guardaste los valores (por ejemplo por serial con `enviarCalMag`).
     * Activa automáticamente el modo dual.
     */
    //% block="set manual magnetometer cal offX %ox offY %oy offZ %oz scX %sx scY %sy scZ %sz"
    //% blockId=fisicabit_cin_cal_mag_manual
    //% group="Calibration & gravity"
    //% weight=60
    //% advanced=true
    export function calibracionManualMag(
        ox: number, oy: number, oz: number,
        sx: number, sy: number, sz: number
    ): void {
        _magOffX = ox; _magOffY = oy; _magOffZ = oz
        _magScX = sx; _magScY = sy; _magScZ = sz
        _magCalibrated = true
        _dualModeEnabled = true
        _magFiltInit = false
        _gLpfInit = false
    }

    /**
     * ¿El magnetómetro tiene una calibración válida cargada?
     */
    //% block="magnetometer calibrated?"
    //% blockId=fisicabit_cin_mag_calibrado
    //% group="Calibration & gravity"
    //% weight=55
    export function magnetometroCalibrado(): boolean {
        return _magCalibrated
    }

    /**
     * Calidad (0-100 %) de la calibración magnética actual, basada en
     * la uniformidad de los radios del elipsoide medido.
     */
    //% block="magnetometer calibration score"
    //% blockId=fisicabit_cin_mag_calidad
    //% group="Calibration & gravity"
    //% weight=50
    export function calidadCalMag(): number {
        return _magCalQuality
    }

    /**
     * Activa manualmente el MODO DUAL (proyección trigonométrica + LPF
     * adaptativo). `calibrarMagnetometro` ya lo activa automáticamente.
     * Sin calibración del magnetómetro el modo dual sigue funcionando
     * (usa sólo pitch/roll + LPF), pero el yaw queda a 0.
     */
    //% block="enable dual mode (accelerometer + magnetometer)"
    //% blockId=fisicabit_cin_dual
    //% group="Calibration & gravity"
    //% weight=94
    export function habilitarModoDual(): void {
        _dualModeEnabled = true
        _gLpfInit = false
    }

    /**
     * Emite la calibración actual del magnetómetro por serial en
     * formato `#CAL:MAG:...`. El `#` hace que fisicabit.com lo ignore
     * como dato de medición pero queda visible en el monitor serial.
     */
    //% block="send magnetometer calibration via serial"
    //% blockId=fisicabit_cin_enviar_cal_mag
    //% group="Calibration & gravity"
    //% weight=45
    export function enviarCalMag(): void {
        serial.writeLine(
            "#CAL:MAG:ox=" + _magOffX
            + ",oy=" + _magOffY
            + ",oz=" + _magOffZ
            + ",sx=" + _magScX
            + ",sy=" + _magScY
            + ",sz=" + _magScZ
            + ",q=" + _magCalQuality
        )
    }

    // ─────────────────────────────────────────────────────────────────
    // BLOQUES DE ACELERACIÓN (en m/s²)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Devuelve la aceleración LINEAL del cuerpo respecto al suelo, en
     * METROS POR SEGUNDO AL CUADRADO (m/s²), sobre el eje elegido.
     *
     * INVARIANTE: cuerpo en reposo ⇒ 0,00 m/s² en todos los ejes.
     *
     * ALGORITMO:
     *   1. Leer cruda con mediana deslizante (anti-pico).
     *   2. Actualizar EMA de gravedad si no está bloqueada.
     *   3. Restar la referencia: a⃗_lineal = a⃗_raw − g⃗.
     *   4. Para "Vertical", proyectar sobre −ĝ (arriba = positivo).
     *      Para "Magnitud", devolver |a⃗_lineal|.
     *   5. Aplicar deadband de 5 mg (reposo → 0,00 exacto).
     *   6. Convertir mg → m/s² con g₀ CODATA y redondear a 2 decimales.
     *
     * @param eje Eje físico (X, Y, Z, Magnitud o Vertical)
     */
    //% block="acceleration on axis %eje (m/s²)"
    //% blockId=fisicabit_cin_accel_lineal
    //% group="Acceleration"
    //% weight=100
    //% eje.defl=EjeAceleracion.Vertical
    export function leerAceleracionLineal(eje: EjeAceleracion): number {
        // 1) Lectura cruda con filtro de mediana deslizante (anti-pico).
        const m = _leerAcelRawFiltrado()
        const ax = m[0]
        const ay = m[1]
        const az = m[2]

        // 2) Actualizar estimador de gravedad SÓLO si no está bloqueado.
        //    Si el usuario habilitó MODO DUAL (llamando a
        //    `calibrarMagnetometro` o `habilitarModoDual`), usamos
        //    proyección trigonométrica + LPF adaptativo con crossfade.
        //    Si no, caemos al EMA simple original — retrocompatible.
        if (_gLocked) {
            // Referencia fija tras calibración en reposo: no tocar.
        } else if (_dualModeEnabled) {
            _actualizarGravedadDual(ax, ay, az)
        } else if (!_gInit) {
            _gvx = ax; _gvy = ay; _gvz = az; _gInit = true
        } else {
            _gvx = (1 - _gAlpha) * _gvx + _gAlpha * ax
            _gvy = (1 - _gAlpha) * _gvy + _gAlpha * ay
            _gvz = (1 - _gAlpha) * _gvz + _gAlpha * az
        }

        // 3) Aceleración lineal en mg (referencia de reposo descontada).
        //    Aplicamos la deadband POR EJE ya aquí: si cada componente
        //    está bajo el umbral, la forzamos a 0 antes de combinarlas.
        //    Esto garantiza que en reposo TODOS los modos (X/Y/Z/
        //    Magnitud/Vertical) devuelvan 0 exacto — en particular la
        //    magnitud, que es √(lx²+ly²+lz²) y acumulaba ruido de los
        //    tres ejes si la deadband se aplicaba sólo al resultado.
        let lx = ax - _gvx
        let ly = ay - _gvy
        let lz = az - _gvz
        if (lx < DEADBAND_LINEAL_MG && lx > -DEADBAND_LINEAL_MG) lx = 0
        if (ly < DEADBAND_LINEAL_MG && ly > -DEADBAND_LINEAL_MG) ly = 0
        if (lz < DEADBAND_LINEAL_MG && lz > -DEADBAND_LINEAL_MG) lz = 0

        // 4) Selección de componente (aún en mg)
        let valor_mg = 0
        switch (eje) {
            case EjeAceleracion.X:
                valor_mg = lx; break
            case EjeAceleracion.Y:
                valor_mg = ly; break
            case EjeAceleracion.Z:
                valor_mg = lz; break
            case EjeAceleracion.Magnitud:
                // Si los 3 ejes fueron clampados a 0, la magnitud es 0
                // exacto — reposo garantizado.
                valor_mg = Math.sqrt(lx * lx + ly * ly + lz * lz)
                break
            case EjeAceleracion.Vertical: {
                // Proyección sobre el versor −ĝ  (arriba = positivo).
                // Con lx=ly=lz=0 (reposo) el producto escalar es 0 y
                // el vertical también.
                const modG = Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz)
                if (modG < 1) { valor_mg = 0; break }
                const dot = lx * _gvx + ly * _gvy + lz * _gvz
                valor_mg = -dot / modG
                break
            }
        }

        // 5) Segunda deadband sobre el resultado final, como cinturón
        //    y tirantes: atrapa residuales sub-mg de la proyección
        //    Vertical que no se eliminaron con la deadband por eje.
        if (valor_mg < DEADBAND_LINEAL_MG && valor_mg > -DEADBAND_LINEAL_MG) {
            return 0
        }

        // 6) Conversión mg → m/s² (2 decimales)
        return Math.round(valor_mg * MG_A_MS2 * 100) / 100
    }

    /**
     * Aceleración lineal del cuerpo sobre el eje X (izquierda/derecha),
     * en m/s². Referencia de reposo descontada. 0,00 m/s² en reposo.
     */
    //% block="acceleration X (m/s²)"
    //% blockId=fisicabit_cin_accel_x
    //% group="Acceleration"
    //% weight=95
    export function aceleracionX(): number {
        return leerAceleracionLineal(EjeAceleracion.X)
    }

    /**
     * Aceleración lineal del cuerpo sobre el eje Y (adelante/atrás),
     * en m/s². Referencia de reposo descontada. 0,00 m/s² en reposo.
     */
    //% block="acceleration Y (m/s²)"
    //% blockId=fisicabit_cin_accel_y
    //% group="Acceleration"
    //% weight=94
    export function aceleracionY(): number {
        return leerAceleracionLineal(EjeAceleracion.Y)
    }

    /**
     * Aceleración lineal del cuerpo sobre el eje Z (perpendicular a
     * la placa), en m/s². Referencia de reposo descontada. 0,00 m/s²
     * en reposo.
     */
    //% block="acceleration Z (m/s²)"
    //% blockId=fisicabit_cin_accel_z
    //% group="Acceleration"
    //% weight=93
    export function aceleracionZ(): number {
        return leerAceleracionLineal(EjeAceleracion.Z)
    }

    /**
     * Aceleración VERTICAL del cuerpo respecto al suelo, en m/s².
     * Componente de la aceleración lineal sobre −ĝ (arriba positivo).
     * Funciona aunque la placa esté inclinada. 0,00 m/s² en reposo.
     */
    //% block="vertical acceleration (m/s²)"
    //% blockId=fisicabit_cin_accel_vert
    //% group="Acceleration"
    //% weight=97
    export function aceleracionVertical(): number {
        return leerAceleracionLineal(EjeAceleracion.Vertical)
    }

    /**
     * Magnitud del vector aceleración lineal |a⃗|, en m/s². Invariante
     * frente a rotaciones de la placa. 0,00 m/s² en reposo.
     */
    //% block="acceleration magnitude (m/s²)"
    //% blockId=fisicabit_cin_accel_mag
    //% group="Acceleration"
    //% weight=92
    export function aceleracionMagnitud(): number {
        return leerAceleracionLineal(EjeAceleracion.Magnitud)
    }

    /**
     * Aceleración PROPIA (proper acceleration) del sensor, en m/s²:
     * la fuerza por unidad de masa que el soporte ejerce sobre el
     * cuerpo (N/kg), SIN restar la gravedad. En reposo sobre el suelo
     * da ≈9,81 m/s² (no 0). En caída libre da ≈0.
     *
     * @param eje Eje físico (X, Y, Z, Magnitud o Vertical)
     */
    //% block="proper acceleration on axis %eje (m/s²)"
    //% blockId=fisicabit_cin_accel_propia
    //% group="Acceleration"
    //% weight=85
    //% eje.defl=EjeAceleracion.Magnitud
    export function leerAceleracionPropia(eje: EjeAceleracion): number {
        // Lectura cruda con mediana deslizante (anti-pico). SIN deadband:
        // en reposo vale ~1000 mg (gravedad), no 0.
        const m = _leerAcelRawFiltrado()
        const ax = m[0]
        const ay = m[1]
        const az = m[2]

        let valor_mg = 0
        switch (eje) {
            case EjeAceleracion.X: valor_mg = ax; break
            case EjeAceleracion.Y: valor_mg = ay; break
            case EjeAceleracion.Z: valor_mg = az; break
            case EjeAceleracion.Magnitud:
                valor_mg = Math.sqrt(ax * ax + ay * ay + az * az); break
            case EjeAceleracion.Vertical: {
                const modG = Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz)
                if (modG < 1) { valor_mg = 0; break }
                const dot = ax * _gvx + ay * _gvy + az * _gvz
                valor_mg = -dot / modG
                break
            }
        }

        return Math.round(valor_mg * MG_A_MS2 * 100) / 100
    }

    /**
     * Detecta caída libre: |a⃗_propia_cruda| < umbral (mg). NO usa el
     * filtro de gravedad (durante la caída la "gravedad estimada"
     * apuntaría a 0, desvirtuando la detección).
     *
     * @param umbralMg Umbral (50-500 mg). Def. 200.
     */
    //% block="free fall detected? (threshold %umbralMg mg)"
    //% blockId=fisicabit_cin_caida_libre
    //% group="Acceleration"
    //% weight=80
    //% umbralMg.min=50 umbralMg.max=500 umbralMg.defl=200
    export function esCaidaLibre(umbralMg: number): boolean {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)
        const mod = Math.sqrt(ax * ax + ay * ay + az * az)
        return mod < umbralMg
    }

    /**
     * ¿Hay perturbación magnética? Devuelve true cuando la magnitud
     * del magnetómetro calibrado difiere más del 25 % del valor
     * nominal registrado durante la calibración: indica que hay un
     * objeto metálico cerca o un campo magnético externo que
     * corrompería el heading. Durante esos tramos el yaw se congela
     * automáticamente para no contaminar la orientación.
     *
     * Sólo tiene sentido con el magnetómetro calibrado.
     */
    //% block="magnetic disturbance detected?"
    //% blockId=fisicabit_cin_mag_disturbed
    //% group="Acceleration"
    //% weight=79
    export function magnetometroAlterado(): boolean {
        return _magDisturbed
    }

    // =========================================================================
    // GRUPO B: ORIENTACIÓN (pitch, roll, heading)
    // =========================================================================

    /**
     * Ángulo de CABECEO (pitch) estimado, en grados. Rango [-90, +90].
     * Requiere MODO DUAL activo; si no, devuelve 0.
     */
    //% block="pitch (°)"
    //% blockId=fisicabit_cin_pitch
    //% group="Orientation"
    //% weight=70
    export function pitch(): number {
        return Math.round(_estPitch * 180 / Math.PI * 10) / 10
    }

    /**
     * Ángulo de ALABEO (roll) estimado, en grados. Rango [-180, +180].
     * Requiere MODO DUAL activo; si no, devuelve 0.
     */
    //% block="roll (°)"
    //% blockId=fisicabit_cin_roll
    //% group="Orientation"
    //% weight=69
    export function roll(): number {
        return Math.round(_estRoll * 180 / Math.PI * 10) / 10
    }

    /**
     * RUMBO (heading / yaw) tilt-compensado, en grados [0, 360).
     * Requiere MAGNETÓMETRO CALIBRADO (ver `calibrarMagnetometro`).
     * Si no hay calibración o hay perturbación, devuelve el último
     * valor válido (0 al inicio).
     */
    //% block="heading (°)"
    //% blockId=fisicabit_cin_heading
    //% group="Orientation"
    //% weight=68
    export function heading(): number {
        let deg = _estYaw * 180 / Math.PI
        if (deg < 0) deg += 360
        return Math.round(deg * 10) / 10
    }

    // =========================================================================
    // GRUPO C: VELOCIDAD INSTANTÁNEA — Integración numérica de a(t)
    // =========================================================================

    // ── Estado interno del integrador de velocidad ─────────────────────
    // La velocidad instantánea se obtiene INTEGRANDO NUMÉRICAMENTE la
    // aceleración lineal del cuerpo respecto al tiempo:
    //
    //     v(t) = v(t₀) + ∫ₜ₀ᵗ a(τ) dτ
    //
    // En el micro:bit aproximamos la integral por una suma de Riemann
    // con paso dt tan "infinitesimal" como el bucle del usuario permita:
    //
    //     vₙ₊₁ = vₙ + a(tₙ) · (tₙ₊₁ − tₙ)
    //
    // Cada llamada a `velocidadInstantanea` mide el dt REAL transcurrido
    // desde la llamada anterior usando `control.millis()`, por lo que el
    // paso de integración se adapta solo al ritmo del bucle `forever`.
    //
    // Limitación física bien conocida: el acelerómetro tiene ruido y un
    // pequeño sesgo. Aunque se calibre en reposo, el error acumulado
    // hace que la velocidad DERIVE con el tiempo. Por eso:
    //   1) Hay que reiniciar la velocidad al empezar cada experimento.
    //   2) Los experimentos deben durar POCOS SEGUNDOS.
    let _vx = 0            // componente X de v⃗, en m/s
    let _vy = 0            // componente Y de v⃗, en m/s
    let _vz = 0            // componente Z de v⃗, en m/s
    let _vVert = 0         // componente vertical de v⃗ (−ĝ), en m/s
    let _tPrevMs = 0       // instante de la última muestra, en ms
    let _vInit = false     // ¿se ha arrancado ya el reloj del integrador?

    // Paso de integración máximo permitido, en ms. Si entre dos llamadas
    // consecutivas pasan más de DT_MAX_MS el bucle del usuario se ha
    // PAUSADO (p.ej. `basic.showNumber` scrollea ~600 ms, `basic.pause`,
    // `serial.writeLine`, un `while` ajeno…) y multiplicar la aceleración
    // actual por un Δt enorme produciría PICOS ESPURIOS en la velocidad
    // (a_ruido · 0,6 s ≫ a_ruido · 0,01 s). En ese caso NO integramos,
    // sólo re-armamos el reloj: es preferible "perderse" una muestra a
    // inyectar un salto artificial que luego el alumnado vería como un
    // pico inexplicable en la gráfica.
    const _DT_MAX_MS = 100

    /**
     * Velocidad INSTANTÁNEA del cuerpo sobre el eje elegido, en m/s,
     * obtenida integrando numéricamente la aceleración lineal:
     *
     *     v(t) ≈ Σᵢ aᵢ · Δtᵢ     con Δtᵢ → 0
     *
     * USO TÍPICO:
     *   basic.forever(function () {
     *       let v = FisicaBitCinematica.velocidadInstantanea(
     *                   EjeAceleracion.Vertical)
     *       basic.showNumber(v)
     *   })
     *
     * Para que la aproximación sea válida hay que LLAMAR A ESTE BLOQUE
     * REPETIDAMENTE (p.ej. dentro de un `forever`). Cuanto más rápido se
     * llame, más "infinitesimal" es Δt y mejor es la estimación. La
     * primera llamada devuelve 0,00 y arranca el reloj interno.
     *
     * RECOMENDACIONES:
     *   - Calibra el acelerómetro en reposo antes de empezar.
     *   - Usa el bloque "reset instantaneous velocity" al principio de
     *     cada experimento.
     *   - Mantén los experimentos cortos (unos pocos segundos) para que
     *     la deriva del sensor no domine el resultado.
     *   - Evita bloquear el bucle con `basic.showNumber` (scrollea ~600
     *     ms) o `basic.pause` LARGOS mientras integras: aunque el bloque
     *     descarta automáticamente tramos de más de 100 ms para que la
     *     velocidad no pegue picos artificiales, durante esos tramos
     *     NO se mide, y pierdes el cambio real de velocidad que haya
     *     ocurrido durante la pausa.
     *
     * @param eje Eje físico (X, Y, Z, Magnitud o Vertical)
     */
    //% block="instantaneous velocity (m/s) axis %eje"
    //% blockId=fisicabit_cin_velocidad
    //% group="Instantaneous velocity"
    //% weight=90
    //% eje.defl=EjeAceleracion.Vertical
    export function velocidadInstantanea(eje: EjeAceleracion): number {
        const ahoraMs = control.millis()

        // Primera llamada: arranca el reloj del integrador y devuelve 0.
        // Sin esto el primer Δt sería gigantesco (todo el uptime del
        // micro:bit) y dispararía la velocidad a valores absurdos.
        if (!_vInit) {
            _tPrevMs = ahoraMs
            _vInit = true
            return 0
        }

        // Paso dt REAL desde la llamada anterior, en ms.
        const dt_ms = ahoraMs - _tPrevMs
        _tPrevMs = ahoraMs

        // ── Salvaguardas anti-pico ────────────────────────────────────
        //  1) dt negativo ⇒ rollover/corrección del reloj: descartar.
        //  2) dt = 0 ⇒ dos llamadas en el mismo ms: no hay nada que
        //     integrar, devolver el estado actual.
        //  3) dt > DT_MAX_MS ⇒ el bucle estuvo BLOQUEADO (showNumber,
        //     pause, serial…). Integrar ese tramo generaría un pico
        //     artificial en v. Nos saltamos la muestra y sólo re-armamos
        //     el reloj, que ya se hizo arriba.
        // Devolvemos el valor ACTUAL de v sin modificarlo, para que la
        // gráfica no dé un salto inexplicable al reanudarse el bucle.
        if (dt_ms <= 0 || dt_ms > _DT_MAX_MS) {
            switch (eje) {
                case EjeAceleracion.X:
                    return Math.round(_vx * 100) / 100
                case EjeAceleracion.Y:
                    return Math.round(_vy * 100) / 100
                case EjeAceleracion.Z:
                    return Math.round(_vz * 100) / 100
                case EjeAceleracion.Magnitud:
                    return Math.round(
                        Math.sqrt(_vx * _vx + _vy * _vy + _vz * _vz) * 100
                    ) / 100
                case EjeAceleracion.Vertical:
                    return Math.round(_vVert * 100) / 100
                default:
                    return 0
            }
        }

        const dt_s = dt_ms / 1000

        // Leer las componentes de la aceleración lineal (m/s²) con el
        // algoritmo completo local (mediana anti-pico + resta de
        // referencia de reposo + deadband + proyección sobre vertical).
        const ax = leerAceleracionLineal(EjeAceleracion.X)
        const ay = leerAceleracionLineal(EjeAceleracion.Y)
        const az = leerAceleracionLineal(EjeAceleracion.Z)
        const aV = leerAceleracionLineal(EjeAceleracion.Vertical)

        // Integración rectangular (Riemann izquierda): v ← v + a·dt
        // Para dt pequeño el error O(dt²) es despreciable frente al
        // ruido del sensor, así que no merece la pena usar trapezoidal.
        _vx    += ax * dt_s
        _vy    += ay * dt_s
        _vz    += az * dt_s
        _vVert += aV * dt_s

        // Devolver la componente solicitada redondeada a 2 decimales.
        switch (eje) {
            case EjeAceleracion.X:
                return Math.round(_vx * 100) / 100
            case EjeAceleracion.Y:
                return Math.round(_vy * 100) / 100
            case EjeAceleracion.Z:
                return Math.round(_vz * 100) / 100
            case EjeAceleracion.Magnitud:
                return Math.round(
                    Math.sqrt(_vx * _vx + _vy * _vy + _vz * _vz) * 100
                ) / 100
            case EjeAceleracion.Vertical:
                return Math.round(_vVert * 100) / 100
            default:
                return 0
        }
    }

    /**
     * Reinicia el integrador de velocidad instantánea: pone v⃗ a cero
     * en TODOS los ejes y vuelve a arrancar el reloj en la próxima
     * llamada. Úsalo al principio de cada experimento, con el cuerpo
     * REALMENTE en reposo, para que la velocidad inicial sea 0,00 m/s.
     */
    //% block="reset instantaneous velocity"
    //% blockId=fisicabit_cin_reset
    //% group="Instantaneous velocity"
    //% weight=80
    export function reiniciarVelocidad(): void {
        _vx = 0
        _vy = 0
        _vz = 0
        _vVert = 0
        _vInit = false
    }
}
