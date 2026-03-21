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
//% color=#0078D7
//% icon="\uf0e7"
//% block="FisicaBit"
//% groups="['Sensores Internos', 'Sensores Externos', 'Sensor Ultrasonido', 'Conversiones', 'Nativo C++', 'Utilidades']"
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
    //% block="leer sensor interno %sensor"
    //% blockId=fisicabit_leer_sensor_interno
    //% group="Sensores Internos"
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
    //% block="leer sensor analógico en %pin"
    //% blockId=fisicabit_leer_analogico
    //% group="Sensores Externos"
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
    //% block="leer sensor digital en P%pin"
    //% blockId=fisicabit_leer_digital
    //% group="Sensores Externos"
    //% weight=85
    //% pin.defl=8
    export function leerSensorDigital(pin: number): number {
        return pins.digitalReadPin(pin as any)
    }


    // =========================================================================
    // GRUPO 3: SENSOR ULTRASÓNICO HC-SR04
    // =========================================================================
    //
    // CÓMO FUNCIONA:
    //   1. Se envía un pulso HIGH de 10μs por el pin TRIG
    //   2. El sensor emite 8 pulsos ultrasónicos a 40kHz
    //   3. Los pulsos rebotan en el objeto y vuelven al sensor
    //   4. El pin ECHO se pone HIGH durante el tiempo de ida y vuelta
    //   5. distancia = (tiempo_μs × velocidad_sonido) / 2
    //
    // CABLEADO:
    //   ┌───────────────────────────────┐
    //   │  HC-SR04                      │
    //   │  ┌────────────────────┐       │
    //   │  │  VCC  │──── 3V/5V │       │ ⚠ Algunos necesitan 5V
    //   │  │  TRIG │──── P1    │       │ (pin de disparo)
    //   │  │  ECHO │──── P2    │       │ (pin de respuesta)
    //   │  │  GND  │──── GND   │       │
    //   │  └────────────────────┘       │
    //   └───────────────────────────────┘
    //
    // NOTA: Si el HC-SR04 necesita 5V, usar divisor de voltaje
    //       en el pin ECHO para no dañar el micro:bit (3.3V max)
    // =========================================================================

    /**
     * Mide la distancia con un sensor ultrasónico HC-SR04.
     *
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad de medida deseada
     * @returns Distancia medida en la unidad seleccionada
     */
    //% block="distancia ultrasónica TRIG %pinTrig ECHO %pinEcho en %unidad"
    //% blockId=fisicabit_ultrasonido
    //% group="Sensor Ultrasonido"
    //% weight=80
    //% pinTrig.defl=DigitalPin.P1
    //% pinEcho.defl=DigitalPin.P2
    //% unidad.defl=UnidadDistancia.Centimetros
    export function medirDistanciaUltrasonido(
        pinTrig: DigitalPin,
        pinEcho: DigitalPin,
        unidad: UnidadDistancia
    ): number {
        // ── Paso 1: Asegurar que TRIG está LOW ──
        pins.digitalWritePin(pinTrig, 0)
        control.waitMicros(2)

        // ── Paso 2: Enviar pulso de 10μs ──
        pins.digitalWritePin(pinTrig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(pinTrig, 0)

        // ── Paso 3: Medir duración del pulso ECHO ──
        // pulseDuration devuelve el tiempo en microsegundos
        // maxCmDistance=300 → timeout para evitar bloqueos
        let duracion = pins.pulseIn(pinEcho, PulseValue.High, 25000)

        // ── Paso 4: Calcular distancia ──
        // Velocidad del sonido: 343 m/s = 0.0343 cm/μs
        // Dividimos por 2 porque el sonido va y vuelve
        // distancia_cm = duracion_μs × 0.0343 / 2 = duracion / 58.2
        let distanciaCm = Math.idiv(duracion, 58)

        // ── Paso 5: Convertir a la unidad solicitada ──
        switch (unidad) {
            case UnidadDistancia.Centimetros:
                return distanciaCm
            case UnidadDistancia.Milimetros:
                return distanciaCm * 10
            case UnidadDistancia.Pulgadas:
                return Math.idiv(distanciaCm * 100, 254)
            default:
                return distanciaCm
        }
    }


    // =========================================================================
    // GRUPO 4: CONVERSIONES DE UNIDADES
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
    //% block="convertir %valor de %de a %a"
    //% blockId=fisicabit_convertir_temp
    //% group="Conversiones"
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
    //% block="mapear %valor de (%entradaMin — %entradaMax) a (%salidaMin — %salidaMax)"
    //% blockId=fisicabit_mapear
    //% group="Conversiones"
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
    //% block="[C++] leer ADC nativo canal %canal"
    //% blockId=fisicabit_adc_nativo
    //% group="Nativo C++"
    //% weight=50
    //% advanced=true
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
    //% block="[C++] medir pulso pin P%pin nivel %nivelAlto timeout %timeoutUs μs"
    //% blockId=fisicabit_pulso_nativo
    //% group="Nativo C++"
    //% weight=45
    //% advanced=true
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
    //% block="[C++] leer ADC promedio canal %canal muestras %muestras"
    //% blockId=fisicabit_adc_promedio
    //% group="Nativo C++"
    //% weight=40
    //% advanced=true
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
    // GRUPO 6: UTILIDADES
    // =========================================================================

    /**
     * Muestra el valor de un sensor en la pantalla LED con scroll.
     * Formato: "ETIQUETA: VALOR"
     *
     * @param etiqueta Texto descriptivo (ej: "Temp")
     * @param valor Valor numérico a mostrar
     */
    //% block="mostrar en LED %etiqueta : %valor"
    //% blockId=fisicabit_mostrar_led
    //% group="Utilidades"
    //% weight=30
    export function mostrarEnLED(etiqueta: string, valor: number): void {
        basic.showString(etiqueta + ":" + Math.round(valor))
    }

    /**
     * Envía datos de sensor por el puerto serie (USB).
     * Formato CSV para fácil análisis en hoja de cálculo.
     *
     * EJEMPLO — Logging continuo de temperatura:
     *   basic.forever(() => {
     *       let t = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
     *       FisicaBit.enviarPorSerie("temperatura", t)
     *       basic.pause(1000)
     *   })
     *
     * Luego abrir la consola serie de MakeCode para ver los datos.
     *
     * @param etiqueta Nombre del dato (aparece como columna en CSV)
     * @param valor Valor numérico
     */
    //% block="enviar por serie %etiqueta = %valor"
    //% blockId=fisicabit_serial
    //% group="Utilidades"
    //% weight=25
    export function enviarPorSerie(etiqueta: string, valor: number): void {
        serial.writeValue(etiqueta, valor)
    }

    /**
     * Espera un intervalo preciso en milisegundos.
     * Wrapper simple, pero útil para tener todo en un namespace.
     *
     * @param ms Milisegundos a esperar
     */
    //% block="esperar %ms ms"
    //% blockId=fisicabit_esperar
    //% group="Utilidades"
    //% weight=20
    export function esperar(ms: number): void {
        basic.pause(ms)
    }
}
