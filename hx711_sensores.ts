// =============================================================================
//  hx711_sensores.ts — Módulo HX711 para celda de carga (masa y fuerza)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Chip: AVIA Semiconductor HX711 (ADC de 24 bits para celdas de carga)
//  Comunicación: Protocolo propietario 2 hilos (DOUT + PD_SCK)
//  Alimentación: 2.6V – 5.5V, típicamente 3.3V o 5V
//
//  CABLEADO (módulo HX711 genérico con celda de carga):
//    ┌──────────────────────────────────────────────┐
//    │  Celda de carga        Módulo HX711          │
//    │  ┌──────────┐          ┌──────────────┐      │
//    │  │ Rojo  (E+)│────────│E+             │      │
//    │  │ Negro (E-)│────────│E-             │      │
//    │  │ Blanco(A-)│────────│A-             │      │
//    │  │ Verde (A+)│────────│A+             │      │
//    │  └──────────┘          │              │      │
//    │                        │  VCC  │──── 3V      │
//    │                        │  GND  │──── GND     │
//    │                        │  DOUT │──── P0      │  (datos)
//    │                        │  SCK  │──── P1      │  (reloj)
//    │                        └──────────────┘      │
//    └──────────────────────────────────────────────┘
//
//    ⚠ Los colores de los cables de la celda de carga pueden variar
//      según el fabricante. Verificar con la hoja de datos del modelo.
//
//  PROTOCOLO HX711:
//    1. Esperar a que DOUT → LOW (dato listo, ~100ms a 10 Hz)
//    2. Enviar 24 pulsos en PD_SCK, leer DOUT en cada flanco ascendente
//       → se obtiene un valor de 24 bits en complemento a 2
//    3. Enviar 1–3 pulsos adicionales para configurar la ganancia
//       de la SIGUIENTE lectura:
//       - 25 pulsos total → ganancia 128, canal A (por defecto)
//       - 26 pulsos total → ganancia 32,  canal B
//       - 27 pulsos total → ganancia 64,  canal A
//
//    ⚠ Si PD_SCK permanece HIGH por >60μs, el HX711 entra en
//      modo de bajo consumo (power-down). Se reactiva al poner LOW.
//
//  TASA DE MUESTREO:
//    - Pin RATE → GND: 10 Hz (por defecto en la mayoría de módulos)
//    - Pin RATE → VCC: 80 Hz
//
//  RESOLUCIÓN:
//    - ADC: 24 bits (valores de -8388608 a +8388607)
//    - Ganancia 128: sensibilidad de ±20mV (típico para celdas de 5-10kg)
//    - Ganancia 64:  sensibilidad de ±40mV
//    - Ganancia 32:  sensibilidad de ±80mV (canal B)
//
//  CALIBRACIÓN:
//    Para obtener valores en gramos/Newtons se necesita calibrar:
//    1. Tarar la balanza (sin peso → establecer cero)
//    2. Colocar un peso conocido (ej. 100g)
//    3. Calcular factor = (lectura_cruda - tara) / peso_conocido
//    4. masa (g) = (lectura_cruda - tara) / factor
//    5. fuerza (N) = masa (kg) × g (9.81 m/s²)
//
//  USO TÍPICO EN CLASE DE FÍSICA:
//    - Medir masa de objetos (balanza digital)
//    - Medir fuerza de un resorte (ley de Hooke)
//    - Verificar F = m × a (segunda ley de Newton)
//    - Medir fuerza de fricción
// =============================================================================

// Módulo HX711 como bloque independiente
//% weight=87
//% color=#4682B4
//% icon="\uf24e"
//% block="HX711 — Force/Mass"
//% groups='["Configuration", "Calibration", "Measurement", "Diagnostics"]'
namespace FisicaBitHX711 {

    // ── Pines ──
    let _hxDout: DigitalPin = DigitalPin.P0
    let _hxSck: DigitalPin = DigitalPin.P1

    // ── Estado ──
    let _hxListo = false
    let _hxCalibrado = false

    // ── Ganancia (número de pulsos de reloj: 25, 26 o 27) ──
    let _hxGanancia = 25  // 25 pulsos = ganancia 128, canal A

    // ── Calibración ──
    let _hxTara: number = 0          // Offset de tara (valor crudo con peso cero)
    let _hxFactorCal: number = 1.0   // Factor de calibración (unidades ADC por gramo)

    // ── Última lectura ──
    let _hxUltCrudo: number = 0
    let _hxLecturaOk = false         // ¿Última lectura exitosa (no timeout)?

    // ── Constante de gravedad ──
    const GRAVEDAD = 9.81  // m/s²

    // =========================================================================
    // Protocolo de comunicación HX711
    // =========================================================================

    /**
     * Reinicia el HX711 mediante un ciclo de power-down/power-up.
     * PD_SCK HIGH por >60μs → power-down, luego LOW → power-up.
     * Después del power-up se necesitan ~400ms para que el ADC estabilice.
     */
    function _hxReset(): void {
        pins.digitalWritePin(_hxSck, 1)
        control.waitMicros(100)  // >60μs → entra en power-down
        pins.digitalWritePin(_hxSck, 0)
        basic.pause(400)         // esperar estabilización del ADC
    }

    /**
     * Lee un valor crudo de 24 bits del HX711.
     * Espera a que DOUT → LOW (dato listo), luego envía pulsos de reloj
     * para leer los 24 bits y configurar la ganancia para la siguiente lectura.
     *
     * Marca _hxLecturaOk = false si hay timeout.
     */
    function _hxLeerCrudo(): number {
        _hxLecturaOk = false

        // ── Esperar a que DOUT → LOW (dato listo) ──
        // A 10 Hz, un dato nuevo llega cada ~100ms.
        // Timeout: 100 intentos × 10ms = 1 segundo.
        let timeout = 100
        while (pins.digitalReadPin(_hxDout) == 1) {
            if (timeout <= 0) return _hxUltCrudo  // timeout: devolver última lectura válida
            basic.pause(10)
            timeout--
        }

        // ── Leer 24 bits (MSB primero) usando shift-and-or ──
        // Más robusto que calcular posiciones con (1 << (23-i))
        let valor = 0
        for (let i = 0; i < 24; i++) {
            pins.digitalWritePin(_hxSck, 1)
            control.waitMicros(10)

            valor = valor << 1
            if (pins.digitalReadPin(_hxDout) == 1) {
                valor = valor | 1
            }

            pins.digitalWritePin(_hxSck, 0)
            control.waitMicros(10)
        }

        // ── Pulsos adicionales para configurar ganancia de próxima lectura ──
        // 25 pulsos total → ganancia 128, canal A
        // 26 pulsos total → ganancia 32,  canal B
        // 27 pulsos total → ganancia 64,  canal A
        for (let j = 24; j < _hxGanancia; j++) {
            pins.digitalWritePin(_hxSck, 1)
            control.waitMicros(10)
            pins.digitalWritePin(_hxSck, 0)
            control.waitMicros(10)
        }

        // ── Convertir de complemento a 2 (24 bits) a entero con signo ──
        if (valor >= 0x800000) {
            valor = valor - 0x1000000
        }

        _hxUltCrudo = valor
        _hxLecturaOk = true
        return valor
    }

    /**
     * Lee N muestras del HX711 y retorna el promedio.
     * Reduce el ruido eléctrico promediando múltiples lecturas.
     * A 10 Hz, N muestras toman ~N×100ms.
     *
     * Solo promedia lecturas exitosas (no timeout).
     * Si todas fallan, retorna la última lectura válida.
     */
    function _hxLeerPromedio(muestras: number): number {
        let suma = 0
        let validas = 0
        for (let i = 0; i < muestras; i++) {
            _hxLeerCrudo()
            if (_hxLecturaOk) {
                suma += _hxUltCrudo
                validas++
            }
        }
        if (validas == 0) return _hxUltCrudo
        return suma / validas
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Configuración
    // =========================================================================

    /**
     * Inicializa el módulo HX711 con los pines indicados.
     * Verifica que el sensor responda y muestra ✓ o ✗ en el LED.
     *
     * Conexión física HX711 → micro:bit:
     *   VCC  → 3V (o 5V según módulo)
     *   GND  → GND
     *   DOUT → pin digital (datos, ej. P0)
     *   SCK  → pin digital (reloj, ej. P1)
     *
     * @param dout Pin conectado a DOUT (datos del HX711)
     * @param sck Pin conectado a PD_SCK (reloj del HX711)
     */
    //% blockId=fisicabit_hx711_inicializar
    //% block="initialize HX711 DOUT %dout SCK %sck"
    //% group="Configuration"
    //% weight=100
    //% dout.defl=DigitalPin.P0
    //% sck.defl=DigitalPin.P1
    export function hx711Inicializar(dout: DigitalPin, sck: DigitalPin): void {
        _hxDout = dout
        _hxSck = sck

        // Reset: power-cycle del HX711 para arrancar limpio
        _hxReset()

        // Descartar las primeras 5 lecturas (el ADC necesita estabilizarse)
        _hxListo = true  // permitir lecturas temporalmente
        let detectado = false
        for (let i = 0; i < 5; i++) {
            _hxLeerCrudo()
            if (_hxLecturaOk) detectado = true
        }
        _hxListo = detectado

        // Resetear estado de calibración
        _hxTara = 0
        _hxFactorCal = 1.0
        _hxCalibrado = false

        if (_hxListo) {
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Configura la ganancia del amplificador del HX711.
     * - 128 (canal A): Mayor sensibilidad, ideal para celdas pequeñas (≤10 kg)
     * - 64 (canal A):  Sensibilidad media
     * - 32 (canal B):  Menor sensibilidad, para celdas grandes
     *
     * La ganancia se aplica a partir de la SIGUIENTE lectura.
     * Se recomienda configurar antes de tarar y calibrar.
     *
     * @param ganancia Ganancia del amplificador
     */
    //% blockId=fisicabit_hx711_ganancia
    //% block="set HX711 gain to %ganancia"
    //% group="Configuration"
    //% weight=98
    //% ganancia.defl=GananciaHX711.G128
    export function hx711SetGanancia(ganancia: GananciaHX711): void {
        _hxGanancia = ganancia
        if (_hxListo) {
            // La ganancia se aplica en la PRÓXIMA lectura después de configurarla.
            // Hacemos 2 lecturas descartables: la primera configura los pulsos,
            // la segunda ya usa la nueva ganancia.
            _hxLeerCrudo()
            _hxLeerCrudo()
        }
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Calibración
    // =========================================================================

    /**
     * Tara la balanza (establece el peso actual como cero).
     * Llama a este bloque SIN peso sobre la celda de carga.
     * Promedia 10 lecturas para mayor estabilidad.
     *
     * ⚠ La tara es necesaria antes de medir masa o fuerza.
     *   Sin tara, los valores incluyen el offset propio de la celda.
     */
    //% blockId=fisicabit_hx711_tarar
    //% block="HX711 tare (set zero)"
    //% group="Calibration"
    //% weight=95
    export function hx711Tarar(): void {
        if (!_hxListo) return
        _hxTara = _hxLeerPromedio(10)
    }

    /**
     * Calibra el HX711 con un peso conocido.
     * Coloca el peso de referencia sobre la celda de carga y luego
     * ejecuta este bloque.
     *
     * ⚠ La balanza debe estar tarada ANTES de calibrar.
     *   Pasos: 1) tarar sin peso → 2) colocar peso → 3) calibrar
     *
     * @param pesoConocido Masa del objeto de calibración en gramos
     */
    //% blockId=fisicabit_hx711_calibrar
    //% block="HX711 calibrate with %pesoConocido g"
    //% group="Calibration"
    //% weight=94
    //% pesoConocido.defl=100
    //% pesoConocido.min=1
    export function hx711Calibrar(pesoConocido: number): void {
        if (!_hxListo) return
        if (pesoConocido <= 0) return

        let lectura = _hxLeerPromedio(10)
        let diferencia = lectura - _hxTara

        if (diferencia != 0) {
            _hxFactorCal = diferencia / pesoConocido
            _hxCalibrado = true
        }
    }

    /**
     * Establece el factor de calibración directamente.
     * Útil si ya conoces el factor de tu celda de carga
     * (obtenido en una calibración previa).
     *
     * El factor se define como: unidades_ADC / gramo.
     * Puedes obtenerlo con el bloque "HX711 calibration factor"
     * después de una calibración exitosa.
     *
     * @param factor Factor de calibración (unidades ADC por gramo)
     */
    //% blockId=fisicabit_hx711_set_factor
    //% block="set HX711 calibration factor %factor"
    //% group="Calibration"
    //% weight=93
    export function hx711SetFactor(factor: number): void {
        if (factor == 0) return
        _hxFactorCal = factor
        _hxCalibrado = true
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Medición
    // =========================================================================

    /**
     * Lee la masa medida por la celda de carga en la unidad seleccionada.
     * Promedia 10 lecturas para reducir ruido (~1s a 10 Hz).
     *
     * Para resultados precisos: tarar y calibrar antes de medir.
     * Sin calibración, retorna valores crudos (unidades ADC).
     *
     * @param unidad Unidad de masa (gramos o kilogramos)
     */
    //% blockId=fisicabit_hx711_masa
    //% block="HX711 mass in %unidad"
    //% group="Measurement"
    //% weight=90
    //% unidad.defl=UnidadMasa.Gramos
    export function hx711Masa(unidad: UnidadMasa): number {
        if (!_hxListo) return 0

        let lectura = _hxLeerPromedio(10)
        let gramos = (lectura - _hxTara) / _hxFactorCal

        switch (unidad) {
            case UnidadMasa.Gramos:
                return Math.round(gramos * 10) / 10
            case UnidadMasa.Kilogramos:
                return Math.round(gramos / 100) / 10
            default:
                return Math.round(gramos * 10) / 10
        }
    }

    /**
     * Lee la fuerza medida por la celda de carga en Newtons.
     * Calcula: F = m × g, donde g = 9.81 m/s².
     * Promedia 10 lecturas para reducir ruido (~1s a 10 Hz).
     *
     * Para resultados precisos: tarar y calibrar antes de medir.
     *
     * Ejemplo: un objeto de 100g produce ~0.981 N.
     *
     * @param gravedad Aceleración de la gravedad en m/s² (por defecto 9.81)
     */
    //% blockId=fisicabit_hx711_fuerza
    //% block="HX711 force (N) with g %gravedad m/s²"
    //% group="Measurement"
    //% weight=89
    //% gravedad.defl=9.81
    export function hx711Fuerza(gravedad: number): number {
        if (!_hxListo) return 0
        if (gravedad <= 0) gravedad = GRAVEDAD

        let lectura = _hxLeerPromedio(10)
        let gramos = (lectura - _hxTara) / _hxFactorCal
        let kg = gramos / 1000
        let newtons = kg * gravedad

        return Math.round(newtons * 1000) / 1000
    }

    /**
     * Lee el valor crudo del ADC del HX711 (sin calibración).
     * Útil para depuración, análisis personalizado o cuando
     * se quiere medir sin calibrar.
     *
     * Retorna un valor de 24 bits con signo (-8388608 a +8388607).
     */
    //% blockId=fisicabit_hx711_crudo
    //% block="HX711 raw value"
    //% group="Measurement"
    //% weight=85
    export function hx711Crudo(): number {
        if (!_hxListo) return 0
        return _hxLeerCrudo()
    }

    /**
     * Lee el valor crudo del ADC ya compensado con la tara.
     * Es decir: lectura_cruda - tara.
     * Útil para observar el valor neto sin aplicar calibración.
     */
    //% blockId=fisicabit_hx711_crudo_neto
    //% block="HX711 net raw value (tared)"
    //% group="Measurement"
    //% weight=84
    export function hx711CrudoNeto(): number {
        if (!_hxListo) return 0
        return _hxLeerCrudo() - _hxTara
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Diagnóstico
    // =========================================================================

    /**
     * Indica si el módulo HX711 fue detectado e inicializado correctamente.
     */
    //% blockId=fisicabit_hx711_conectado
    //% block="HX711 connected"
    //% group="Diagnostics"
    //% weight=80
    export function hx711Conectado(): boolean {
        return _hxListo
    }

    /**
     * Indica si el HX711 ha sido calibrado (por calibración con peso
     * conocido o por asignación manual del factor).
     */
    //% blockId=fisicabit_hx711_calibrado
    //% block="HX711 calibrated"
    //% group="Diagnostics"
    //% weight=79
    export function hx711Calibrado(): boolean {
        return _hxCalibrado
    }

    /**
     * Obtiene el factor de calibración actual.
     * Útil para guardarlo y reutilizarlo sin recalibrar.
     *
     * Después de calibrar, anota este valor y úsalo con
     * "set HX711 calibration factor" en futuros programas.
     */
    //% blockId=fisicabit_hx711_get_factor
    //% block="HX711 calibration factor"
    //% group="Diagnostics"
    //% weight=78
    export function hx711GetFactor(): number {
        return _hxFactorCal
    }

    /**
     * Obtiene el valor de tara actual (offset crudo).
     * Útil para diagnóstico.
     */
    //% blockId=fisicabit_hx711_get_tara
    //% block="HX711 tare offset"
    //% group="Diagnostics"
    //% weight=77
    export function hx711GetTara(): number {
        return _hxTara
    }
}
