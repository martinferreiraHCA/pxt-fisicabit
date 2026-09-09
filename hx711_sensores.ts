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
//      modo de bajo consumo (power-down). El shim C++ deshabilita
//      interrupciones durante la lectura para evitar esto.
//
//  TASA DE MUESTREO:
//    - Pin RATE → GND: 10 Hz (por defecto en la mayoría de módulos)
//    - Pin RATE → VCC: 80 Hz
//
//  FILTRADO (basado en la librería olkal/HX711_ADC):
//    Buffer circular de 18 muestras con media recortada (trimmed mean):
//    - Se almacenan 18 lecturas en un buffer circular
//    - Se descarta la lectura más alta y la más baja (rechazo de outliers)
//    - Se promedian las 16 restantes usando bit-shift (÷16 = >>4)
//    - Tiempo de llenado a 10 Hz: 18 × 100ms = 1.8 segundos
//    - Esto rechaza automáticamente lecturas corruptas por interrupciones
//
//  CALIBRACIÓN:
//    Para obtener valores en gramos/Newtons se necesita calibrar:
//    1. Tarar la balanza (sin peso → establecer cero)
//    2. Colocar un peso conocido (ej. 100g)
//    3. Calcular factor = (lectura_suavizada - tara) / peso_conocido
//    4. masa (g) = (lectura_suavizada - tara) / factor
//    5. fuerza (N) = masa (kg) × g (9.81 m/s²)
//
//  USO EN FOREVER LOOP (no bloqueante):
//    Los bloques de medición (masa, fuerza) son no-bloqueantes:
//    - Verifican si hay un dato nuevo disponible (DOUT LOW)
//    - Si hay dato: lo leen (~80μs) y lo agregan al buffer circular
//    - Retornan el valor suavizado actual del buffer (media recortada)
//    - Si no hay dato: retornan el último valor suavizado sin bloquear
//
//  REFERENCIAS:
//    - olkal/HX711_ADC (Arduino): Buffer circular + trimmed mean
//    - bogde/HX711 (Arduino): noInterrupts() durante bit-bang
//    - Datasheet HX711: T3 max 50μs, power-down si SCK HIGH >60μs
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// Shim C++ — lectura de 24 bits con interrupciones deshabilitadas
// En hardware usa fisicabit_native::hx711LeerCrudoNativo (shims.cpp).
// En el simulador usa el cuerpo TS como fallback.
// NO declarar en shims.d.ts (doble declaración confunde a pxt).
// ─────────────────────────────────────────────────────────────────────────────
namespace fisicabit_native {
    /**
     * Lee el ADC de 24 bits del HX711 con protección de interrupciones.
     * Non-blocking: retorna 0 si DOUT está HIGH (dato no listo).
     * Retorna [1..0xFFFFFF] (valor unsigned tras XOR 0x800000).
     *
     * @param pinDoutId ID del pin DOUT (valor del enum DigitalPin)
     * @param pinSckId ID del pin SCK (valor del enum DigitalPin)
     * @param ganExtra Pulsos extra: 1=gain128, 2=gain32, 3=gain64
     */
    //% shim=fisicabit_native::hx711LeerCrudoNativo
    export function hx711LeerCrudoNativo(pinDoutId: number, pinSckId: number, ganExtra: number): number {
        // ── Fallback para simulador ──
        // Simula un sensor con lecturas alrededor del punto medio (0x800000)
        // con un poco de ruido gaussiano para testing realista.
        return 0x800000 + Math.randomRange(-200, 200)
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Módulo HX711 — Namespace principal
// ─────────────────────────────────────────────────────────────────────────────
//% weight=87
//% color=#4682B4
//% icon="\uf24e"
//% block="HX711 — Force/Mass"
//% groups='["Configuration", "Calibration", "Measurement", "Diagnostics"]'
namespace FisicaBitHX711 {

    // =========================================================================
    // Constantes del filtro (basadas en olkal/HX711_ADC config.h)
    // =========================================================================

    const MUESTRAS = 16         // Muestras útiles para el promedio (potencia de 2)
    const IGN_ALTA = 1          // Descartar la lectura más alta (outlier)
    const IGN_BAJA = 1          // Descartar la lectura más baja (outlier)
    const BUFFER_TOTAL = 18     // MUESTRAS + IGN_ALTA + IGN_BAJA
    const DIV_BIT = 4           // log2(MUESTRAS) = log2(16) = 4
    const GRAVEDAD = 9.81       // m/s²
    const TIMEOUT_SIGNAL = 1500 // ms sin dato → sensor desconectado

    // ── Pines (almacenados como DigitalPin para el shim C++) ──
    let _hxDout: DigitalPin = DigitalPin.P0
    let _hxSck: DigitalPin = DigitalPin.P1

    // ── Estado ──
    let _hxListo = false
    let _hxCalibrado = false
    let _hxGananciaExtra = 1    // Pulsos extra: 1=128, 2=32, 3=64

    // ── Buffer circular (trimmed moving average) ──
    let _hxBuffer: number[] = []
    let _hxIndice = 0
    let _hxBufferLleno = false

    // ── Calibración ──
    let _hxTara: number = 0            // Offset de tara (en unidades unsigned)
    let _hxFactorCal: number = 1.0     // Factor: unidades_ADC_unsigned / gramo
    let _hxFactorCalRecip: number = 1.0 // 1.0 / factorCal (precomputado para velocidad)

    // ── Timing ──
    let _hxUltDatoMs = 0        // Timestamp del último dato válido
    let _hxSinSenal = false     // Flag de timeout (sensor desconectado)

    // =========================================================================
    // Funciones internas
    // =========================================================================

    /**
     * Reinicia el HX711 mediante un ciclo de power-down/power-up.
     * PD_SCK HIGH por >60μs → power-down, luego LOW → power-up.
     * Espera 400ms para que el ADC interno estabilice (datasheet).
     */
    function _hxReset(): void {
        pins.digitalWritePin(_hxSck, 1)
        control.waitMicros(120)  // >60μs → power-down garantizado
        pins.digitalWritePin(_hxSck, 0)
        basic.pause(400)         // settling del ADC interno
    }

    /**
     * Lectura no-bloqueante del HX711 vía shim C++.
     * - Si DOUT está LOW (dato listo): lee 24 bits con IRQ deshabilitadas,
     *   aplica XOR 0x800000, retorna valor unsigned [1..0xFFFFFF].
     * - Si DOUT está HIGH (no hay dato): retorna 0 inmediatamente.
     *
     * En hardware real ~80μs por lectura. En simulador retorna valor simulado.
     */
    function _hxLeerShim(): number {
        return fisicabit_native.hx711LeerCrudoNativo(
            _hxDout as number,
            _hxSck as number,
            _hxGananciaExtra
        )
    }

    /**
     * Actualización no-bloqueante: intenta leer un dato nuevo.
     * Si hay dato disponible, lo agrega al buffer circular.
     * Retorna true si se leyó un dato nuevo.
     *
     * Diseñado para llamarse dentro de un forever loop.
     * Si no hay dato nuevo, retorna false sin bloquear.
     */
    function _hxActualizar(): boolean {
        if (!_hxListo) return false

        let dato = _hxLeerShim()

        if (dato > 0) {
            // Dato válido: agregar al buffer circular
            _hxBuffer[_hxIndice] = dato
            _hxIndice++
            if (_hxIndice >= BUFFER_TOTAL) {
                _hxIndice = 0
                _hxBufferLleno = true
            }
            _hxUltDatoMs = input.runningTime()
            _hxSinSenal = false
            return true
        }

        // No hay dato nuevo — verificar timeout
        if (input.runningTime() - _hxUltDatoMs > TIMEOUT_SIGNAL) {
            _hxSinSenal = true
        }
        return false
    }

    /**
     * Media recortada (trimmed mean) del buffer circular.
     * Basada en smoothedData() de olkal/HX711_ADC:
     * 1. Suma todos los valores del buffer (18 muestras)
     * 2. Resta el valor más alto (rechazo de outlier superior)
     * 3. Resta el valor más bajo (rechazo de outlier inferior)
     * 4. Divide por 16 usando bit-shift (>>4)
     *
     * Esto rechaza automáticamente lecturas corruptas por interrupciones
     * (que típicamente dan 0xFFFFFF = todos los bits en 1).
     */
    function _hxDatosSuavizados(): number {
        let n = _hxBufferLleno ? BUFFER_TOTAL : _hxIndice
        if (n == 0) return 0

        let suma = 0
        let minVal = 0xFFFFFF
        let maxVal = 0

        for (let i = 0; i < n; i++) {
            let v = _hxBuffer[i]
            suma += v
            if (v < minVal) minVal = v
            if (v > maxVal) maxVal = v
        }

        // Recortar outliers solo si tenemos suficientes muestras
        if (n > 2) {
            suma -= minVal
            suma -= maxVal
            n -= 2
        }

        // Dividir: si el buffer está lleno usamos bit-shift (rápido),
        // si no, división normal
        if (_hxBufferLleno) {
            return suma >> DIV_BIT  // ÷16 = >>4
        } else {
            return Math.idiv(suma, n)
        }
    }

    /**
     * Llena el buffer circular completamente (operación bloqueante).
     * A 10 Hz, tarda ~1.8 segundos (18 muestras × 100ms).
     * Se usa para tara y calibración donde necesitamos estabilidad máxima.
     * Timeout de seguridad: 3 segundos.
     */
    function _hxLlenarBuffer(): void {
        _hxIndice = 0
        _hxBufferLleno = false
        let timeout = input.runningTime() + 3000

        while (!_hxBufferLleno) {
            if (input.runningTime() > timeout) break
            _hxActualizar()
            basic.pause(5)  // no busy-wait: ceder al scheduler
        }
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Configuración
    // =========================================================================

    /**
     * Inicializa el módulo HX711 con los pines indicados.
     * Realiza un power-cycle (reset), descarta las primeras lecturas
     * inestables y llena el buffer circular (~2 segundos).
     * Muestra ✓ si el sensor responde correctamente, ✗ si no.
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

        // Inicializar buffer circular con ceros
        _hxBuffer = []
        for (let i = 0; i < BUFFER_TOTAL; i++) {
            _hxBuffer.push(0)
        }
        _hxIndice = 0
        _hxBufferLleno = false

        // Reset: power-cycle del HX711
        _hxReset()

        // Marcar como listo para poder leer
        _hxListo = true
        _hxUltDatoMs = input.runningTime()

        // Llenar buffer con datos estabilizados (~1.8s a 10 Hz)
        _hxLlenarBuffer()

        // Verificar si recibimos datos válidos
        if (!_hxBufferLleno) {
            _hxListo = false
            basic.showIcon(IconNames.No)
        } else {
            basic.showIcon(IconNames.Yes)
        }

        // Resetear calibración
        _hxTara = 0
        _hxFactorCal = 1.0
        _hxFactorCalRecip = 1.0
        _hxCalibrado = false

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
     * Se recomienda configurar ANTES de tarar y calibrar.
     * Rellena el buffer con la nueva ganancia (~2 segundos).
     *
     * @param ganancia Ganancia del amplificador
     */
    //% blockId=fisicabit_hx711_ganancia
    //% block="set HX711 gain to %ganancia"
    //% group="Configuration"
    //% weight=98
    //% ganancia.defl=GananciaHX711.G128
    export function hx711SetGanancia(ganancia: GananciaHX711): void {
        // Convertir de pulsos totales (25,26,27) a pulsos extra (1,2,3)
        _hxGananciaExtra = ganancia - 24

        if (_hxListo) {
            // La nueva ganancia se aplica en la PRÓXIMA conversión.
            // Rellenamos el buffer para que todas las muestras usen
            // la ganancia nueva.
            _hxLlenarBuffer()
        }
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Calibración
    // =========================================================================

    /**
     * Tara la balanza (establece el peso actual como cero).
     * Llama a este bloque SIN peso sobre la celda de carga.
     * Rellena el buffer completo (~2s) y calcula el offset promedio.
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
        _hxLlenarBuffer()
        _hxTara = _hxDatosSuavizados()
    }

    /**
     * Calibra el HX711 con un peso conocido.
     * Coloca el peso de referencia sobre la celda de carga y luego
     * ejecuta este bloque. Rellena el buffer (~2s) y calcula el factor.
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

        _hxLlenarBuffer()
        let lectura = _hxDatosSuavizados()
        let diff = lectura - _hxTara

        if (diff != 0) {
            _hxFactorCal = diff / pesoConocido
            _hxFactorCalRecip = 1.0 / _hxFactorCal
            _hxCalibrado = true
        }
    }

    /**
     * Establece el factor de calibración directamente.
     * Útil si ya conoces el factor de tu celda de carga
     * (obtenido en una calibración previa con "HX711 calibration factor").
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
        _hxFactorCalRecip = 1.0 / factor
        _hxCalibrado = true
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — Medición (no-bloqueantes, para usar en forever)
    // =========================================================================

    /**
     * Lee la masa en la unidad seleccionada (no-bloqueante).
     *
     * Ideal para usar en un bloque "forever":
     * - Si hay un dato nuevo del HX711 → lo lee y actualiza el buffer
     * - Retorna la media recortada actual (trimmed mean de 16 muestras)
     * - Si no hay dato nuevo → retorna el último valor sin bloquear
     *
     * Para resultados precisos: tarar y calibrar antes de medir.
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

        // Actualización no-bloqueante: leer dato si está disponible
        _hxActualizar()

        let suavizado = _hxDatosSuavizados()
        let gramos = (suavizado - _hxTara) * _hxFactorCalRecip

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
     * Lee la fuerza en Newtons (no-bloqueante).
     * Calcula: F = m × g, donde g es configurable (por defecto 9.81 m/s²).
     *
     * Ideal para usar en un bloque "forever" — misma lógica que hx711Masa.
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

        // Actualización no-bloqueante
        _hxActualizar()

        let suavizado = _hxDatosSuavizados()
        let gramos = (suavizado - _hxTara) * _hxFactorCalRecip
        let kg = gramos / 1000
        let newtons = kg * gravedad

        return Math.round(newtons * 1000) / 1000
    }

    /**
     * Lee el valor crudo del ADC (no-bloqueante).
     * Retorna la media recortada del buffer sin calibración.
     * Útil para depuración o análisis personalizado.
     */
    //% blockId=fisicabit_hx711_crudo
    //% block="HX711 raw value"
    //% group="Measurement"
    //% weight=85
    export function hx711Crudo(): number {
        if (!_hxListo) return 0
        _hxActualizar()
        return _hxDatosSuavizados()
    }

    /**
     * Lee el valor crudo neto (media recortada menos tara).
     * Útil para observar el valor sin calibración pero con tara aplicada.
     */
    //% blockId=fisicabit_hx711_crudo_neto
    //% block="HX711 net raw value (tared)"
    //% group="Measurement"
    //% weight=84
    export function hx711CrudoNeto(): number {
        if (!_hxListo) return 0
        _hxActualizar()
        return _hxDatosSuavizados() - _hxTara
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
        return _hxListo && !_hxSinSenal
    }

    /**
     * Indica si el HX711 ha sido calibrado.
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
     */
    //% blockId=fisicabit_hx711_get_factor
    //% block="HX711 calibration factor"
    //% group="Diagnostics"
    //% weight=78
    export function hx711GetFactor(): number {
        return _hxFactorCal
    }

    /**
     * Obtiene el valor de tara actual (offset en unidades unsigned).
     */
    //% blockId=fisicabit_hx711_get_tara
    //% block="HX711 tare offset"
    //% group="Diagnostics"
    //% weight=77
    export function hx711GetTara(): number {
        return _hxTara
    }
}
