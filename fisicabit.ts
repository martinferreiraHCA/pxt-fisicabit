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
//% groups="['Internal Sensors', 'External Sensors', 'Ultrasonic Sensor', 'Optical Barrier', 'Serial Sampling', 'Conversions', 'Native C++', 'Utilities']"
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
    // ALGORITMO DE FILTRADO (para experimentos de física):
    //   - Filtro de mediana: toma N lecturas, ordena y devuelve la central
    //   - La mediana es IDEAL para eliminar picos espurios (outliers)
    //     porque un valor extremo aislado no afecta al resultado
    //   - Validación de rango: descarta lecturas fuera de 2–400 cm
    //   - Cálculo preciso en mm: duracion × 343 / 2000 (fórmula física exacta)
    //   - Fallback al último valor válido si todas las lecturas fallan
    //
    // RENDIMIENTO vs FILTRADO:
    //   Ninguno (1 lectura):  ~25ms → hasta 40 Hz (rápido pero ruidoso)
    //   Suave (mediana de 3): ~80ms → hasta 12 Hz (bueno para MRU/MRUV)
    //   Medio (mediana de 5): ~135ms → hasta 7 Hz (muy suave)
    //   Fuerte (mediana de 7): ~190ms → hasta 5 Hz (máxima suavidad)
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

    // ── Estado interno del filtro ultrasónico ──
    let _usFiltroMuestras = 3   // Mediana de 3 por defecto
    let _usUltimoValido = 0     // Último valor válido (fallback)
    let _usMinMm = 20           // Mínimo válido: 20 mm (2 cm)
    let _usMaxMm = 4000         // Máximo válido: 4000 mm (400 cm)
    let _usMaxCambioMm = 0      // Máx. cambio entre lecturas (0 = desactivado)

    /**
     * Realiza UNA medición cruda del HC-SR04 y devuelve la distancia en mm.
     * Retorna -1 si la lectura es inválida (timeout, fuera de rango,
     * o cambio excesivo respecto a la última lectura válida).
     */
    function _usLecturaCrudaMm(pinTrig: DigitalPin, pinEcho: DigitalPin): number {
        pins.digitalWritePin(pinTrig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(pinTrig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(pinTrig, 0)

        let duracion = pins.pulseIn(pinEcho, PulseValue.High, 25000)

        if (duracion <= 0) return -1

        // Fórmula física precisa:
        // distancia_mm = duracion_μs × velocidad_sonido / 2
        //              = duracion × 0.343 / 2 = duracion × 343 / 2000
        let distMm = Math.idiv(duracion * 343, 2000)

        // Validar rango (el HC-SR04 es fiable entre 2 cm y 400 cm)
        if (distMm < _usMinMm || distMm > _usMaxMm) return -1

        // Validar tasa de cambio (si está activada y hay lectura previa)
        // Rechaza lecturas que salten más de _usMaxCambioMm respecto
        // a la última lectura válida — físicamente imposible en MRU/MRUV
        if (_usMaxCambioMm > 0 && _usUltimoValido > 0) {
            let cambio = Math.abs(distMm - _usUltimoValido)
            if (cambio > _usMaxCambioMm) return -1
        }

        return distMm
    }

    /**
     * Insertion sort para arrays pequeños (eficiente para N ≤ 7).
     */
    function _usOrdenar(arr: number[], len: number): void {
        for (let i = 1; i < len; i++) {
            let clave = arr[i]
            let j = i - 1
            while (j >= 0 && arr[j] > clave) {
                arr[j + 1] = arr[j]
                j--
            }
            arr[j + 1] = clave
        }
    }

    /**
     * Convierte una distancia en mm a la unidad solicitada.
     */
    function _usConvertir(mm: number, unidad: UnidadDistancia): number {
        switch (unidad) {
            case UnidadDistancia.Milimetros:
                return mm
            case UnidadDistancia.Centimetros:
                return Math.idiv(mm, 10)
            case UnidadDistancia.Pulgadas:
                return Math.idiv(mm * 10, 254)
            default:
                return Math.idiv(mm, 10)
        }
    }

    /**
     * Configura el filtro del sensor ultrasónico.
     * Usa este bloque ANTES de medir para ajustar la calidad del filtrado.
     *
     * Para MRU/MRUV: filtro "suave" (mediana de 3) da buen equilibrio
     * entre velocidad de muestreo y eliminación de picos espurios.
     *
     * Para caída libre: filtro "ninguno" si necesitas máxima frecuencia,
     * o "suave" si la caída es lo suficientemente lenta.
     *
     * @param filtro Intensidad del filtro (más muestras = más suave pero más lento)
     */
    //% block="set ultrasonic filter to %filtro"
    //% blockId=fisicabit_us_configurar
    //% group="Ultrasonic Sensor"
    //% weight=82
    //% filtro.defl=FiltroUltrasonido.Suave
    export function configurarFiltroUltrasonido(filtro: FiltroUltrasonido): void {
        _usFiltroMuestras = filtro
    }

    /**
     * Configura el rango válido de distancia para el sensor ultrasónico.
     * Las lecturas fuera de este rango se descartan como inválidas.
     *
     * Ajustar el rango al experimento específico mejora MUCHO la calidad
     * de los datos. Por ejemplo, si tu péndulo oscila entre 5 cm y 40 cm,
     * fijar el rango a 30–500 mm elimina picos espurios fuera de esa zona.
     *
     * @param minMm Distancia mínima válida en milímetros (defecto: 20 mm)
     * @param maxMm Distancia máxima válida en milímetros (defecto: 4000 mm)
     */
    //% block="set ultrasonic range from %minMm to %maxMm mm"
    //% blockId=fisicabit_us_rango
    //% group="Ultrasonic Sensor"
    //% weight=81
    //% minMm.defl=20 minMm.min=10
    //% maxMm.defl=4000 maxMm.min=20 maxMm.max=4000
    //% inlineInputMode=inline
    export function configurarRangoUltrasonido(minMm: number, maxMm: number): void {
        _usMinMm = Math.max(10, minMm)
        _usMaxMm = Math.min(4000, maxMm)
    }

    /**
     * Configura el máximo cambio permitido entre lecturas consecutivas (en mm).
     * Lecturas que salten más de este valor respecto a la anterior se descartan.
     *
     * Esto es muy eficaz para eliminar picos espurios en experimentos de
     * MRU, MRUV y caída libre, donde la distancia cambia gradualmente.
     *
     * CÓMO CALCULAR EL VALOR:
     *   maxCambio = velocidad_máxima (mm/s) × periodo_muestreo (s)
     *   Ejemplo: objeto a 2 m/s, muestreo cada 30 ms
     *   maxCambio = 2000 × 0.030 = 60 mm
     *   Usar un valor 2-3× mayor para margen: 120-180 mm
     *
     * Usar 0 para desactivar este filtro.
     *
     * @param maxCambioMm Máximo cambio permitido en mm (0 = desactivado)
     */
    //% block="set ultrasonic max step %maxCambioMm mm"
    //% blockId=fisicabit_us_max_cambio
    //% group="Ultrasonic Sensor"
    //% weight=79
    //% maxCambioMm.defl=0 maxCambioMm.min=0
    export function configurarMaxCambioUltrasonido(maxCambioMm: number): void {
        _usMaxCambioMm = maxCambioMm
    }

    /**
     * Mide la distancia con un sensor ultrasónico HC-SR04.
     * Incluye filtro de mediana para eliminar picos espurios.
     *
     * Algoritmo:
     *   1. Toma N lecturas (configurable con "configurar filtro ultrasónico")
     *   2. Descarta lecturas inválidas (0, fuera de rango)
     *   3. Ordena las lecturas válidas y toma la mediana (valor central)
     *   4. Si todas fallan, devuelve la última lectura válida
     *
     * Ideal para experimentos de MRU, MRUV y caída libre donde
     * los picos espurios arruinan el análisis de datos.
     *
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad de medida deseada
     * @returns Distancia medida en la unidad seleccionada
     */
    //% block="ultrasonic distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido
    //% group="Ultrasonic Sensor"
    //% weight=80
    //% pinTrig.defl=DigitalPin.P1
    //% pinEcho.defl=DigitalPin.P2
    //% unidad.defl=UnidadDistancia.Centimetros
    export function medirDistanciaUltrasonido(
        pinTrig: DigitalPin,
        pinEcho: DigitalPin,
        unidad: UnidadDistancia
    ): number {
        let n = _usFiltroMuestras

        // ── Caso sin filtro: lectura única rápida ──
        if (n <= 1) {
            let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
            if (mm > 0) {
                _usUltimoValido = mm
                return _usConvertir(mm, unidad)
            }
            return _usConvertir(_usUltimoValido, unidad)
        }

        // ── Caso con filtro de mediana ──
        let lecturas: number[] = []
        let validas = 0

        for (let i = 0; i < n; i++) {
            let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
            if (mm > 0) {
                lecturas.push(mm)
                validas++
            }
            // Espera entre lecturas para que los ecos se disipen
            // 2.5 ms ≈ eco de ida y vuelta a ~43 cm
            if (i < n - 1) {
                control.waitMicros(2500)
            }
        }

        // Si ninguna lectura fue válida, devolver último valor conocido
        if (validas === 0) {
            return _usConvertir(_usUltimoValido, unidad)
        }

        // Ordenar y tomar la mediana (valor central del array ordenado)
        _usOrdenar(lecturas, validas)
        let medianaMm = lecturas[Math.idiv(validas, 2)]

        _usUltimoValido = medianaMm
        return _usConvertir(medianaMm, unidad)
    }

    /**
     * Mide la distancia con el HC-SR04 sin ningún filtro.
     * Devuelve la lectura cruda de una sola medición.
     *
     * Usar cuando se necesita la máxima velocidad de muestreo (~40 Hz)
     * y se prefiere filtrar los datos después (por ejemplo en una
     * planilla de cálculo o en la app FisicaBit).
     *
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad de medida deseada
     * @returns Distancia cruda en la unidad seleccionada, 0 si falla
     */
    //% block="ultrasonic raw distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido_crudo
    //% group="Ultrasonic Sensor"
    //% weight=78
    //% pinTrig.defl=DigitalPin.P1
    //% pinEcho.defl=DigitalPin.P2
    //% unidad.defl=UnidadDistancia.Milimetros
    export function medirDistanciaUltrasonidoCrudo(
        pinTrig: DigitalPin,
        pinEcho: DigitalPin,
        unidad: UnidadDistancia
    ): number {
        let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
        if (mm <= 0) return 0
        return _usConvertir(mm, unidad)
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
    // GRUPO 6: MUESTREO SERIAL (USB) — misma lógica que BT
    // =========================================================================

    let _serialTiempoInicio = 0
    let _serialIniciado = false

    function _asegurarSerial(): void {
        if (!_serialIniciado) {
            _serialTiempoInicio = input.runningTime()
            _serialIniciado = true
        }
    }

    /**
     * Tiempo en milisegundos desde que se inició el serial.
     * Siempre comienza en 0. Arrastrá este bloque a un slot de muestreo
     * para incluir el tiempo en los datos enviados.
     */
    //% block="serial time (ms)"
    //% blockId=fisicabit_serial_tiempo
    //% group="Serial Sampling"
    //% weight=75
    export function tiempoSerial(): number {
        _asegurarSerial()
        return input.runningTime() - _serialTiempoInicio
    }

    /**
     * Envía UN valor por puerto serie (USB) y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * @param valor Valor a enviar (cualquier variable, sensor o "tiempo serial (ms)")
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_1
    //% group="Serial Sampling"
    //% weight=70
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function serialMuestrear1(valor: number, ms: number): void {
        _asegurarSerial()
        serial.writeLine("" + valor)
        basic.pause(ms)
    }

    /**
     * Envía DOS valores por puerto serie (USB) y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * Envía: valor1,valor2
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor1 and %valor2|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_2
    //% group="Serial Sampling"
    //% weight=65
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function serialMuestrear2(valor1: number, valor2: number, ms: number): void {
        _asegurarSerial()
        serial.writeLine("" + valor1 + "," + valor2)
        basic.pause(ms)
    }

    /**
     * Envía TRES valores por puerto serie (USB) y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * Envía: valor1,valor2,valor3
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor1 , %valor2 and %valor3|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_3
    //% group="Serial Sampling"
    //% weight=60
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function serialMuestrear3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _asegurarSerial()
        serial.writeLine("" + valor1 + "," + valor2 + "," + valor3)
        basic.pause(ms)
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
