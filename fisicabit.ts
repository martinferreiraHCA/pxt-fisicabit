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
//% groups="['Internal Sensors', 'Acceleration (m/s²)', 'External Sensors', 'Optical Barrier', 'Conversions', 'Native C++', 'Utilities']"
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
    // GRUPO 1b: ACELERACIÓN EN m/s² — ALGORITMO AVANZADO
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
    //  Donde g⃗ es el vector que apunta hacia el CENTRO de la Tierra.
    //  Equivalentemente, si medimos el vector gravedad APARENTE en el
    //  sistema del sensor (lo que el acelerómetro lee cuando está
    //  estático), la aceleración respecto al suelo se obtiene como:
    //
    //       a⃗_cuerpo  =  a⃗_lectura  −  g⃗_estático
    //
    //  CONVERSIÓN mg → m/s²:
    //  ──────────────────────
    //       a [m/s²]  =  (lectura_mg / 1000) × g₀
    //       g₀ = 9,80665 m/s²  (valor CODATA estándar)
    //
    //  CUIDADOS FÍSICOS PARA EXPERIMENTOS CON LA PLACA ENCIMA DEL CUERPO:
    //  ───────────────────────────────────────────────────────────────────
    //   1. Alineación: mantener la placa con la misma orientación durante
    //      todo el experimento; cualquier rotación mezcla componentes
    //      entre ejes y contamina la medición.
    //   2. Calibración del bias: todo MEMS tiene un offset residual
    //      (típicamente ±20 mg). Siempre medir ese offset con el cuerpo
    //      en reposo ANTES del experimento.
    //   3. Gravedad variable en el sistema del sensor: si el cuerpo puede
    //      rotar, la gravedad cambia de eje aparente. Para resolver esto
    //      estimamos g⃗ con un filtro pasabajos adaptativo.
    //   4. Ruido térmico y cuantización: el sensor tiene ruido RMS de
    //      ≈2-4 mg. Un filtro pasabajos de la componente lineal reduce
    //      esto sin perder dinámica de interés (<20 Hz).
    //   5. Rango dinámico: ±2 g sólo permite medir hasta ≈19,6 m/s² de
    //      aceleración propia. Si se esperan golpes o caídas, usar ±8 g.
    //   6. Banda pasante: el LSM303AGR a 100 Hz de ODR tiene ancho de
    //      banda útil ≈40 Hz. Fenómenos más rápidos se aliasean.
    //
    //  ALGORITMO IMPLEMENTADO — "Gravity Tracking + Bias Cancellation":
    //  ─────────────────────────────────────────────────────────────────
    //  Usamos un estimador complementario. El vector gravedad g⃗ en el
    //  marco del sensor se obtiene con un filtro pasabajos exponencial
    //  (EMA) de constante α pequeña (≈0,05). La aceleración lineal
    //  (pasabanda) se obtiene restando g⃗ a la lectura cruda:
    //
    //       g⃗_{k+1}  =  (1−α)·g⃗_k  +  α·a⃗_{raw,k}        (LPF, fc≈0,5 Hz)
    //       a⃗_lineal_k  =  a⃗_{raw,k}  −  g⃗_k  −  bias⃗   (HPF por diferencia)
    //
    //  Además, para obtener la aceleración "respecto al suelo" en la
    //  dirección vertical real (no el eje Z del sensor, que puede estar
    //  inclinado), PROYECTAMOS a⃗_lineal sobre el versor −ĝ:
    //
    //       ĝ  =  g⃗ / |g⃗|
    //       a_vertical↑  =  − (a⃗_lineal · ĝ)
    //
    //  De este modo el bloque devuelve la aceleración vertical POSITIVA
    //  cuando el cuerpo sube y NEGATIVA cuando frena/cae, con independen‑
    //  cia de cómo esté inclinada la placa sobre el cuerpo.
    //
    //  INVARIANTE FUNDAMENTAL — "cuerpo quieto ⇒ a = 0":
    //  ─────────────────────────────────────────────────
    //  Si el cuerpo está en reposo, las lecturas crudas cumplen
    //  a⃗_raw = g⃗ + ruido. El estimador EMA converge a g⃗, por lo que
    //  a⃗_lineal = a⃗_raw − g⃗ ≈ ruido (≈3 mg RMS = 0,03 m/s²). El
    //  redondeo a 2 decimales en m/s² garantiza que el resultado
    //  devuelto sea EXACTAMENTE 0,00 m/s² en reposo.
    //
    //  Importante: NO se aplica ninguna corrección adicional de "bias"
    //  más allá del estimador EMA; agregar una segunda resta de bias
    //  introduciría un offset artificial que rompería este invariante.
    //  El EMA ya absorbe simultáneamente la gravedad y el offset DC
    //  intrínseco del sensor MEMS, que es justo lo que queremos.
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

    /**
     * Actualiza una vez el estimador de gravedad a partir de la lectura cruda
     * del acelerómetro. Esta función la llaman internamente los bloques de
     * lectura, pero también se expone por si el usuario quiere forzar una
     * actualización dentro de su bucle.
     *
     * Modelo matemático (filtro pasabajos EMA de primer orden):
     *     g_k = (1 − α) · g_{k−1}  +  α · a_raw_k
     *
     * Con α = 0,05 y ODR de 100 Hz → frecuencia de corte ≈ 0,8 Hz, lo que
     * separa eficazmente la componente estática (gravedad, DC-lento) de la
     * dinámica (movimientos del cuerpo, >1 Hz).
     *
     * Si se ha ejecutado "calibrate accelerometer at rest", el vector g⃗
     * queda CONGELADO y este bloque no lo modifica (garantiza que sostener
     * una aceleración no sea "absorbida" por el filtro). Para volver a
     * habilitar el tracking, llamar a "unlock gravity tracking".
     */
    //% block="update gravity estimate"
    //% blockId=fisicabit_accel_actualizar_gravedad
    //% group="Acceleration (m/s²)"
    //% weight=99
    export function actualizarGravedad(): void {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)
        if (!_gInit) {
            // Inicializar con la primera muestra para evitar transitorio de convergencia
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
     * Fija la constante α del filtro pasabajos usado para estimar la
     * gravedad. Valores más bajos → filtro más lento (más inercia, mejor
     * rechazo de movimiento rápido) pero tarda más en adaptarse a rotaciones.
     *
     * Guía práctica:
     *   α = 0.01  → fc ≈ 0,16 Hz. Ideal si la placa NO rota durante el
     *               experimento (máxima limpieza del bias gravitatorio).
     *   α = 0.05  → fc ≈ 0,8 Hz. Valor por defecto. Buen compromiso.
     *   α = 0.20  → fc ≈ 3,5 Hz. Sólo si el cuerpo cambia de orientación
     *               con frecuencia (no recomendado para medir a_cuerpo).
     *
     * @param alfa Constante del filtro (0 < α < 1). Por defecto 0,05.
     */
    //% block="set gravity filter α to %alfa"
    //% blockId=fisicabit_accel_fijar_alfa
    //% group="Acceleration (m/s²)"
    //% weight=98
    //% alfa.min=0.001 alfa.max=0.5 alfa.defl=0.05
    export function fijarAlfaGravedad(alfa: number): void {
        if (alfa < 0.001) alfa = 0.001
        if (alfa > 0.5) alfa = 0.5
        _gAlpha = alfa
    }

    /**
     * Vuelve a habilitar el seguimiento adaptativo del vector gravedad
     * (desbloquea el EMA) después de una calibración. Usar sólo si el
     * cuerpo va a cambiar de orientación durante el experimento.
     */
    //% block="unlock gravity tracking"
    //% blockId=fisicabit_accel_unlock
    //% group="Acceleration (m/s²)"
    //% weight=95
    export function desbloquearGravedad(): void {
        _gLocked = false
    }

    /**
     * Calibra el acelerómetro midiendo el vector gravedad del entorno
     * mientras el cuerpo está en REPOSO absoluto sobre el suelo.
     *
     * PROCEDIMIENTO DE CALIBRACIÓN:
     *   1. Colocar el cuerpo con la placa encima, totalmente quieto, en la
     *      orientación final del experimento (ej: placa horizontal, cara
     *      arriba, sobre el objeto a medir).
     *   2. Invocar este bloque. El programa tomará N muestras y calculará
     *      el vector gravedad aparente g⃗ = ⟨a⃗_raw⟩ promediando muestras
     *      sucesivas para eliminar el ruido por el factor 1/√N.
     *   3. El vector g⃗ queda CONGELADO como referencia: todas las lecturas
     *      posteriores de "linear acceleration" le restarán exactamente
     *      ese vector, de modo que:
     *           • en reposo:     a⃗_lineal = a⃗_raw − g⃗ ≈ 0  (0,00 m/s²)
     *           • en movimiento: a⃗_lineal = variación respecto al reposo
     *
     * JUSTIFICACIÓN FÍSICA:
     *   La lectura promedio en reposo contiene tanto la aceleración propia
     *   debida a la gravedad como el offset intrínseco DC del sensor MEMS:
     *        ⟨a⃗⟩ = g⃗_aparente + bias_sensor + ruido/√M
     *   Al usarla como referencia y restarla, eliminamos AMBAS contribucio‑
     *   nes de golpe, sin necesidad de conocer por separado la gravedad
     *   ideal (9,81 m/s²) ni el bias del chip. Para M = 200 muestras a
     *   100 Hz (2 s), el ruido RMS del sensor (~3 mg) se reduce a
     *   3/√200 ≈ 0,21 mg, despreciable.
     *
     * NOTA: el módulo del vector capturado debería valer ≈1000 mg (1 g).
     * Si el micro:bit está lejos del ecuador (g_real ≈ 9,78 a 9,83 m/s²)
     * o si hay bias de hasta ±30 mg, el módulo puede diferir un 1-3 %.
     * Esto NO afecta al invariante "cuerpo quieto ⇒ 0 m/s²" porque
     * restamos exactamente la misma referencia.
     *
     * @param muestras Número de muestras a promediar (50-500). Por defecto 200.
     */
    //% block="calibrate accelerometer at rest (%muestras samples)"
    //% blockId=fisicabit_accel_calibrar
    //% group="Acceleration (m/s²)"
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
        // Vector gravedad medido (en reposo = aceleración propia pura
        // + bias DC intrínseco del MEMS, ambos absorbidos como referencia)
        _gvx = sx / muestras
        _gvy = sy / muestras
        _gvz = sz / muestras
        _gInit = true
        // Bloqueamos el EMA: la referencia queda fija y el sensor mide
        // exclusivamente las variaciones alrededor de ese punto de reposo.
        // Esto garantiza el invariante "cuerpo quieto ⇒ 0 m/s²" y además
        // impide que una aceleración sostenida sea absorbida por el filtro.
        _gLocked = true
    }

    /**
     * Fija el rango de medición del acelerómetro. Rangos mayores permiten
     * medir golpes/impactos más fuertes, a cambio de menor resolución por bit.
     *
     * Resolución efectiva (API a 10 bits, ≈1024 cuentas por ±rango):
     *      ±2 g  →  ≈3,9 mg/bit  →  0,038 m/s² por bit   (por defecto)
     *      ±4 g  →  ≈7,8 mg/bit  →  0,077 m/s² por bit
     *      ±8 g  →  ≈15,6 mg/bit →  0,153 m/s² por bit
     *
     * Regla: elegir el rango MÁS PEQUEÑO que no sature durante el experimento.
     *
     * @param rango Rango deseado (±2g, ±4g, ±8g)
     */
    //% block="set accelerometer range %rango"
    //% blockId=fisicabit_accel_rango
    //% group="Acceleration (m/s²)"
    //% weight=97
    //% rango.defl=RangoAcelerometro.Rango2G
    export function fijarRangoAcelerometro(rango: RangoAcelerometro): void {
        // La API nativa acepta 1, 2, 4, 8 (g)
        input.setAccelerometerRange(rango as any)
    }

    /**
     * Devuelve la aceleración LINEAL del cuerpo respecto al suelo, con la
     * gravedad aparente (referencia de reposo) ya descontada, sobre el eje
     * elegido y en la unidad pedida.
     *
     * INVARIANTE: cuerpo en reposo ⇒ 0,00 m/s² en todos los ejes.
     *
     * ALGORITMO:
     *   1. Leer la aceleración propia cruda del sensor (a⃗_raw, en mg).
     *   2. Si el estimador EMA no está bloqueado (no se calibró aún),
     *      actualizarlo con la nueva muestra:
     *            g⃗ ← (1−α)·g⃗ + α·a⃗_raw
     *      Si el usuario ya calibró, g⃗ queda FIJO como referencia de reposo.
     *   3. Calcular la aceleración lineal restando la referencia:
     *            a⃗_lineal = a⃗_raw − g⃗
     *      Esto elimina simultáneamente la gravedad aparente y el bias DC
     *      intrínseco del sensor MEMS (ambos absorbidos en g⃗).
     *   4. Si el eje solicitado es "Vertical", proyectar sobre −ĝ:
     *            a_vert = −(a⃗_lineal · ĝ)
     *      Así el signo positivo = "hacia arriba respecto al suelo" sin
     *      importar la orientación física de la placa.
     *   5. Si el eje es Magnitud, devolver |a⃗_lineal|.
     *   6. Convertir de mg a la unidad pedida y redondear.
     *
     * JUSTIFICACIÓN DE CÓMO SE CUMPLE EL INVARIANTE:
     *   Antes de calibrar, el EMA converge exponencialmente a ⟨a⃗_raw⟩,
     *   por lo que a⃗_lineal → 0 en reposo. Después de calibrar, g⃗ queda
     *   igual al promedio de N muestras en reposo, así que en cada lectura
     *   posterior en reposo a⃗_lineal = (a⃗_raw − ⟨a⃗_raw⟩) = ruido gaussiano
     *   con σ ≈ 3 mg ≈ 0,03 m/s². El redondeo a 2 decimales (m/s²) hace
     *   que el resultado devuelto sea EXACTAMENTE 0,00 en reposo.
     *
     * INTERPRETACIÓN FÍSICA:
     *   - En reposo: 0,00 m/s² en todos los ejes (garantía estricta).
     *   - En caída libre: el eje Vertical devuelve ≈ −9,81 m/s²
     *     (el cuerpo acelera hacia abajo respecto al suelo).
     *   - Subiendo en ascensor a 2 m/s²: eje Vertical ≈ +2,00 m/s².
     *   - Frenando al bajar: eje Vertical positivo (decelera la caída).
     *
     * @param eje Eje físico deseado (X, Y, Z, Magnitud o Vertical)
     * @param unidad Unidad de salida (m/s², g o mg)
     */
    //% block="linear acceleration on axis %eje in %unidad"
    //% blockId=fisicabit_accel_lineal
    //% group="Acceleration (m/s²)"
    //% weight=96
    //% eje.defl=EjeAceleracion.Vertical
    //% unidad.defl=UnidadAceleracion.MetroPorSegundo2
    export function leerAceleracionLineal(eje: EjeAceleracion, unidad: UnidadAceleracion): number {
        // 1) Lectura cruda
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)

        // 2) Actualizar estimador de gravedad SÓLO si no está bloqueado.
        //    Tras calibrar, la referencia queda fija para preservar el
        //    invariante "cuerpo quieto ⇒ 0 m/s²" y para no absorber
        //    aceleraciones sostenidas.
        if (!_gInit) {
            _gvx = ax; _gvy = ay; _gvz = az; _gInit = true
        } else if (!_gLocked) {
            _gvx = (1 - _gAlpha) * _gvx + _gAlpha * ax
            _gvy = (1 - _gAlpha) * _gvy + _gAlpha * ay
            _gvz = (1 - _gAlpha) * _gvz + _gAlpha * az
        }

        // 3) Aceleración lineal en mg — se resta UNA sola vez la referencia
        //    de reposo (que incluye gravedad + bias DC del MEMS).
        const lx = ax - _gvx
        const ly = ay - _gvy
        const lz = az - _gvz

        // 4) Selección de componente
        let valor_mg = 0
        switch (eje) {
            case EjeAceleracion.X:
                valor_mg = lx; break
            case EjeAceleracion.Y:
                valor_mg = ly; break
            case EjeAceleracion.Z:
                valor_mg = lz; break
            case EjeAceleracion.Magnitud:
                valor_mg = Math.sqrt(lx * lx + ly * ly + lz * lz)
                break
            case EjeAceleracion.Vertical: {
                // Proyección sobre el versor −ĝ  (arriba = positivo)
                const modG = Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz)
                if (modG < 1) { valor_mg = 0; break }
                const dot = lx * _gvx + ly * _gvy + lz * _gvz
                valor_mg = -dot / modG
                break
            }
        }

        // 5) Conversión a la unidad pedida (2 decimales de redondeo)
        switch (unidad) {
            case UnidadAceleracion.MetroPorSegundo2:
                return Math.round(valor_mg * MG_A_MS2 * 100) / 100
            case UnidadAceleracion.G:
                return Math.round(valor_mg / 10) / 100   // mg → g con 2 decimales
            case UnidadAceleracion.Miligravedad:
                return Math.round(valor_mg)
            default:
                return Math.round(valor_mg * MG_A_MS2 * 100) / 100
        }
    }

    /**
     * Aceleración PROPIA (lo que mide el sensor sin restar nada).
     * Útil para estudiantes avanzados que quieren comparar el modelo
     * de "peso aparente" con la teoría: esta función devuelve la fuerza
     * por unidad de masa que el soporte ejerce sobre el cuerpo (N/kg).
     *
     * Equivalente pedagógico: si te paras sobre una balanza dentro de
     * un ascensor, esta función devuelve lo que marca la balanza
     * dividido por tu masa.
     *
     * @param eje Eje físico (X, Y, Z o Magnitud)
     * @param unidad Unidad deseada
     */
    //% block="proper acceleration on axis %eje in %unidad"
    //% blockId=fisicabit_accel_propia
    //% group="Acceleration (m/s²)"
    //% weight=94
    //% eje.defl=EjeAceleracion.Magnitud
    //% unidad.defl=UnidadAceleracion.MetroPorSegundo2
    export function leerAceleracionPropia(eje: EjeAceleracion, unidad: UnidadAceleracion): number {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)

        let valor_mg = 0
        switch (eje) {
            case EjeAceleracion.X: valor_mg = ax; break
            case EjeAceleracion.Y: valor_mg = ay; break
            case EjeAceleracion.Z: valor_mg = az; break
            case EjeAceleracion.Magnitud:
                valor_mg = Math.sqrt(ax * ax + ay * ay + az * az); break
            case EjeAceleracion.Vertical: {
                // Componente a lo largo de la vertical real (estimada por filtro)
                const modG = Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz)
                if (modG < 1) { valor_mg = 0; break }
                const dot = ax * _gvx + ay * _gvy + az * _gvz
                valor_mg = -dot / modG
                break
            }
        }

        switch (unidad) {
            case UnidadAceleracion.MetroPorSegundo2:
                return Math.round(valor_mg * MG_A_MS2 * 100) / 100
            case UnidadAceleracion.G:
                return Math.round(valor_mg / 10) / 100
            case UnidadAceleracion.Miligravedad:
                return Math.round(valor_mg)
            default:
                return Math.round(valor_mg * MG_A_MS2 * 100) / 100
        }
    }

    /**
     * Devuelve el módulo del vector gravedad estimado actualmente, en mg.
     * Herramienta de diagnóstico: en reposo debería valer ≈1000 mg. Si no
     * lo hace, el cuerpo se está moviendo o la calibración es incorrecta.
     */
    //% block="|g estimated| (mg)"
    //% blockId=fisicabit_accel_mod_gravedad
    //% group="Acceleration (m/s²)"
    //% weight=85
    export function moduloGravedadEstimada(): number {
        return Math.round(Math.sqrt(_gvx * _gvx + _gvy * _gvy + _gvz * _gvz))
    }

    /**
     * Detecta caída libre con umbral físicamente motivado.
     *
     * FUNDAMENTO:
     *   En caída libre la aceleración propia se anula porque desaparece
     *   la fuerza normal. Matemáticamente: |a⃗_propia| → 0. En la práctica
     *   el sensor no llega a 0 exacto por ruido y pequeñas vibraciones,
     *   por lo que usamos un umbral (típico 100-300 mg).
     *
     * Esta función NO usa el filtro de gravedad (sería contraproducente:
     * durante la caída la "gravedad estimada" apuntaría a 0). Usa la
     * magnitud cruda del vector de aceleración propia.
     *
     * @param umbralMg Umbral en mg por debajo del cual se considera caída libre (def. 200)
     */
    //% block="free fall detected? (threshold %umbralMg mg)"
    //% blockId=fisicabit_accel_caida_libre
    //% group="Acceleration (m/s²)"
    //% weight=84
    //% umbralMg.min=50 umbralMg.max=500 umbralMg.defl=200
    export function esCaidaLibre(umbralMg: number): boolean {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        const az = input.acceleration(Dimension.Z)
        const mod = Math.sqrt(ax * ax + ay * ay + az * az)
        return mod < umbralMg
    }

    /**
     * Convierte un valor de miligravedades (mg) a m/s² usando la gravedad
     * estándar CODATA g₀ = 9,80665 m/s². Devuelve con 2 decimales.
     *
     * @param mg Valor en miligravedades
     */
    //% block="convert %mg mg → m/s²"
    //% blockId=fisicabit_accel_mg_a_ms2
    //% group="Acceleration (m/s²)"
    //% weight=70
    export function convertirMgAMs2(mg: number): number {
        return Math.round(mg * MG_A_MS2 * 100) / 100
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
