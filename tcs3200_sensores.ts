// =============================================================================
//  tcs3200_sensores.ts — Sensor de color TCS3200 como espectrofotómetro
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Módulo para el sensor de color TCS3200 configurado como
//               espectrofotómetro educativo. Mide período de la señal de
//               frecuencia del TCS3200, calibra con blanco de referencia,
//               y calcula transmitancia (%) y absorbancia.
//
//  CONEXIONADO POR DEFECTO:
//    S0  → P8   (escalado de frecuencia)
//    S1  → P12  (escalado de frecuencia)
//    S2  → P2   (selección de canal)
//    S3  → P16  (selección de canal)
//    OUT → P1   (señal de frecuencia)
//
//  PRINCIPIO DE FUNCIONAMIENTO:
//    El TCS3200 emite una onda cuadrada cuya frecuencia es proporcional
//    a la intensidad de luz del canal seleccionado (R, G, B, Clear).
//    Medimos el PERÍODO (μs) en vez de frecuencia para evitar contadores.
//    Período largo = poca luz, período corto = mucha luz.
//
//  ESPECTROFOTOMETRÍA:
//    Transmitancia T = (período_blanco / período_muestra) × 100
//    Absorbancia   A = log₁₀(período_muestra / período_blanco)
//    (A = -log₁₀(T/100) = log₁₀(100/T))
// =============================================================================

// Extiende el namespace FisicaBit con el espectrofotómetro TCS3200
namespace FisicaBit {

    // ── Pines por defecto ──
    let _pinS0 = DigitalPin.P8
    let _pinS1 = DigitalPin.P12
    let _pinS2 = DigitalPin.P2
    let _pinS3 = DigitalPin.P16
    let _pinOut = 1  // número de pin para shim C++

    // ── Estado ──
    let _inicializado = false
    let _muestrasPromedio = 10
    let _timeoutUs = 500000  // 500ms

    // ── Calibración blanco (período en μs por canal) ──
    let _blancoRojo = 0
    let _blancoVerde = 0
    let _blancoAzul = 0
    let _blancoClear = 0

    // ── Última lectura (período en μs por canal) ──
    let _ultimoRojo = 0
    let _ultimoVerde = 0
    let _ultimoAzul = 0
    let _ultimoClear = 0

    // =========================================================================
    // Funciones internas
    // =========================================================================

    function _seleccionarCanal(canal: CanalTCS3200): void {
        switch (canal) {
            case CanalTCS3200.Rojo:
                pins.digitalWritePin(_pinS2, 0)
                pins.digitalWritePin(_pinS3, 0)
                break
            case CanalTCS3200.Verde:
                pins.digitalWritePin(_pinS2, 1)
                pins.digitalWritePin(_pinS3, 1)
                break
            case CanalTCS3200.Azul:
                pins.digitalWritePin(_pinS2, 0)
                pins.digitalWritePin(_pinS3, 1)
                break
            case CanalTCS3200.Clear:
                pins.digitalWritePin(_pinS2, 1)
                pins.digitalWritePin(_pinS3, 0)
                break
        }
        control.waitMicros(100) // estabilización del fotodiodo
    }

    function _aplicarEscalado(escalado: EscaladoTCS3200): void {
        switch (escalado) {
            case EscaladoTCS3200.Apagado:
                pins.digitalWritePin(_pinS0, 0)
                pins.digitalWritePin(_pinS1, 0)
                break
            case EscaladoTCS3200.Dos:
                pins.digitalWritePin(_pinS0, 0)
                pins.digitalWritePin(_pinS1, 1)
                break
            case EscaladoTCS3200.Veinte:
                pins.digitalWritePin(_pinS0, 1)
                pins.digitalWritePin(_pinS1, 0)
                break
            case EscaladoTCS3200.Cien:
                pins.digitalWritePin(_pinS0, 1)
                pins.digitalWritePin(_pinS1, 1)
                break
        }
    }

    function _leerPeriodo(canal: CanalTCS3200): number {
        _seleccionarCanal(canal)
        if (_muestrasPromedio <= 1) {
            return fisicabit_native.tcs3200LeerPeriodoUs(_pinOut, _timeoutUs)
        } else {
            return fisicabit_native.tcs3200LeerRafagaUs(_pinOut, _muestrasPromedio, _timeoutUs)
        }
    }

    function _getBlanco(canal: CanalTCS3200): number {
        switch (canal) {
            case CanalTCS3200.Rojo: return _blancoRojo
            case CanalTCS3200.Verde: return _blancoVerde
            case CanalTCS3200.Azul: return _blancoAzul
            case CanalTCS3200.Clear: return _blancoClear
            default: return 0
        }
    }

    // =========================================================================
    // Bloques — Setup
    // =========================================================================

    /**
     * Inicializa el sensor TCS3200 con los pines por defecto.
     * Escalado: 20% (buena relación velocidad/precisión).
     */
    //% blockId=fisicabit_tcs_inicializar
    //% block="initialize TCS3200 color sensor"
    //% group="Spectrophotometer" weight=100
    export function tcsInicializar(): void {
        _aplicarEscalado(EscaladoTCS3200.Veinte)
        _inicializado = true
    }

    /**
     * Inicializa el TCS3200 con pines personalizados.
     * @param s0 pin S0 (escalado)
     * @param s1 pin S1 (escalado)
     * @param s2 pin S2 (canal)
     * @param s3 pin S3 (canal)
     * @param out pin OUT (señal de frecuencia) — número de pin (0-16)
     */
    //% blockId=fisicabit_tcs_inicializar_custom
    //% block="initialize TCS3200 S0 %s0 S1 %s1 S2 %s2 S3 %s3 OUT P %out"
    //% group="Spectrophotometer" weight=99
    //% s0.defl=DigitalPin.P8 s1.defl=DigitalPin.P12
    //% s2.defl=DigitalPin.P2 s3.defl=DigitalPin.P16
    //% out.min=0 out.max=16 out.defl=1
    export function tcsInicializarCustom(s0: DigitalPin, s1: DigitalPin, s2: DigitalPin, s3: DigitalPin, out: number): void {
        _pinS0 = s0
        _pinS1 = s1
        _pinS2 = s2
        _pinS3 = s3
        _pinOut = out
        _aplicarEscalado(EscaladoTCS3200.Veinte)
        _inicializado = true
    }

    /**
     * Configura el escalado de frecuencia del TCS3200.
     * @param escalado nivel de escalado
     */
    //% blockId=fisicabit_tcs_escalado
    //% block="set TCS3200 frequency scaling %escalado"
    //% group="Spectrophotometer" weight=98
    export function tcsFijarEscalado(escalado: EscaladoTCS3200): void {
        _aplicarEscalado(escalado)
    }

    /**
     * Configura el número de muestras para promediar lecturas.
     * @param muestras número de períodos a promediar (1-50)
     */
    //% blockId=fisicabit_tcs_muestras
    //% block="set TCS3200 averaging samples %muestras"
    //% group="Spectrophotometer" weight=97
    //% muestras.min=1 muestras.max=50 muestras.defl=10
    export function tcsFijarMuestras(muestras: number): void {
        _muestrasPromedio = Math.clamp(1, 50, muestras)
    }

    // =========================================================================
    // Bloques — Measurement
    // =========================================================================

    /**
     * Lee el período (μs) de un canal del TCS3200.
     * Período largo = poca luz, período corto = mucha luz.
     * @param canal canal de color a leer
     */
    //% blockId=fisicabit_tcs_leer_canal
    //% block="TCS3200 period (μs) channel %canal"
    //% group="Spectrophotometer" weight=90
    export function tcsLeerCanal(canal: CanalTCS3200): number {
        return _leerPeriodo(canal)
    }

    /**
     * Lee todos los canales (R, G, B, Clear) y almacena los resultados.
     * Usar los bloques getter para obtener cada valor.
     */
    //% blockId=fisicabit_tcs_leer_todos
    //% block="TCS3200 read all channels"
    //% group="Spectrophotometer" weight=89
    export function tcsLeerTodos(): void {
        _ultimoRojo = _leerPeriodo(CanalTCS3200.Rojo)
        _ultimoVerde = _leerPeriodo(CanalTCS3200.Verde)
        _ultimoAzul = _leerPeriodo(CanalTCS3200.Azul)
        _ultimoClear = _leerPeriodo(CanalTCS3200.Clear)
    }

    /**
     * Obtiene el último valor leído de un canal (después de leerTodos).
     * @param canal canal a consultar
     */
    //% blockId=fisicabit_tcs_valor
    //% block="TCS3200 last value %canal (μs)"
    //% group="Spectrophotometer" weight=88
    export function tcsValor(canal: CanalTCS3200): number {
        switch (canal) {
            case CanalTCS3200.Rojo: return _ultimoRojo
            case CanalTCS3200.Verde: return _ultimoVerde
            case CanalTCS3200.Azul: return _ultimoAzul
            case CanalTCS3200.Clear: return _ultimoClear
            default: return 0
        }
    }

    /**
     * Lee un canal con un número específico de muestras (sin cambiar la config global).
     * @param canal canal de color
     * @param muestras número de períodos a promediar
     */
    //% blockId=fisicabit_tcs_leer_promedio
    //% block="TCS3200 averaged period (μs) channel %canal samples %muestras"
    //% group="Spectrophotometer" weight=87
    //% muestras.min=1 muestras.max=50 muestras.defl=10
    export function tcsLeerPromediado(canal: CanalTCS3200, muestras: number): number {
        _seleccionarCanal(canal)
        let n = Math.clamp(1, 50, muestras)
        return fisicabit_native.tcs3200LeerRafagaUs(_pinOut, n, _timeoutUs)
    }

    // =========================================================================
    // Bloques — Calibration
    // =========================================================================

    /**
     * Calibra el blanco de referencia (I₀). Coloca la cubeta con solvente puro
     * o la referencia blanca frente al sensor antes de ejecutar este bloque.
     * Los valores se usan para calcular transmitancia y absorbancia.
     */
    //% blockId=fisicabit_tcs_calibrar_blanco
    //% block="TCS3200 calibrate white reference"
    //% group="Spectrophotometer Calibration" weight=80
    export function tcsCalibrarBlanco(): void {
        _blancoRojo = _leerPeriodo(CanalTCS3200.Rojo)
        _blancoVerde = _leerPeriodo(CanalTCS3200.Verde)
        _blancoAzul = _leerPeriodo(CanalTCS3200.Azul)
        _blancoClear = _leerPeriodo(CanalTCS3200.Clear)
    }

    /**
     * Establece manualmente el valor de calibración blanco para un canal.
     * @param canal canal de color
     * @param periodoUs período de referencia en μs
     */
    //% blockId=fisicabit_tcs_fijar_blanco
    //% block="TCS3200 set white reference %canal to %periodoUs μs"
    //% group="Spectrophotometer Calibration" weight=79
    export function tcsFijarBlanco(canal: CanalTCS3200, periodoUs: number): void {
        switch (canal) {
            case CanalTCS3200.Rojo: _blancoRojo = periodoUs; break
            case CanalTCS3200.Verde: _blancoVerde = periodoUs; break
            case CanalTCS3200.Azul: _blancoAzul = periodoUs; break
            case CanalTCS3200.Clear: _blancoClear = periodoUs; break
        }
    }

    /**
     * Obtiene el valor de calibración blanco almacenado para un canal.
     * @param canal canal de color
     */
    //% blockId=fisicabit_tcs_blanco_valor
    //% block="TCS3200 white reference %canal (μs)"
    //% group="Spectrophotometer Calibration" weight=78
    export function tcsBlancoValor(canal: CanalTCS3200): number {
        return _getBlanco(canal)
    }

    // =========================================================================
    // Bloques — Spectrophotometry
    // =========================================================================

    /**
     * Calcula la transmitancia (%) de un canal.
     * T = (período_blanco / período_muestra) × 100
     * Requiere calibración previa con calibrarBlanco().
     * @param canal canal de color
     */
    //% blockId=fisicabit_tcs_transmitancia
    //% block="TCS3200 transmittance (percent) channel %canal"
    //% group="Spectrophotometer" weight=70
    export function tcsTransmitancia(canal: CanalTCS3200): number {
        let blanco = _getBlanco(canal)
        if (blanco <= 0) return 0
        let muestra = _leerPeriodo(canal)
        if (muestra <= 0) return 0
        // T = (blanco / muestra) × 100
        // Período corto = mucha luz = alta transmitancia
        return Math.roundWithPrecision((blanco / muestra) * 100, 1)
    }

    /**
     * Calcula la absorbancia de un canal.
     * A = log₁₀(período_muestra / período_blanco)
     * Requiere calibración previa con calibrarBlanco().
     * @param canal canal de color
     */
    //% blockId=fisicabit_tcs_absorbancia
    //% block="TCS3200 absorbance channel %canal"
    //% group="Spectrophotometer" weight=69
    export function tcsAbsorbancia(canal: CanalTCS3200): number {
        let blanco = _getBlanco(canal)
        if (blanco <= 0) return 0
        let muestra = _leerPeriodo(canal)
        if (muestra <= 0) return 0
        // A = log₁₀(muestra / blanco) = -log₁₀(T/100)
        let ratio = muestra / blanco
        if (ratio <= 0) return 0
        // log₁₀(x) = ln(x) / ln(10)
        return Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
    }

    /**
     * Calcula transmitancia a partir de valores ya medidos (sin nueva lectura).
     * @param periodoMuestra período de la muestra en μs
     * @param periodoBlanco período del blanco en μs
     */
    //% blockId=fisicabit_tcs_transmitancia_manual
    //% block="transmittance (percent) sample %periodoMuestra white %periodoBlanco μs"
    //% group="Spectrophotometer" weight=68
    export function tcsTransmitanciaManual(periodoMuestra: number, periodoBlanco: number): number {
        if (periodoBlanco <= 0 || periodoMuestra <= 0) return 0
        return Math.roundWithPrecision((periodoBlanco / periodoMuestra) * 100, 1)
    }

    /**
     * Calcula absorbancia a partir de valores ya medidos (sin nueva lectura).
     * @param periodoMuestra período de la muestra en μs
     * @param periodoBlanco período del blanco en μs
     */
    //% blockId=fisicabit_tcs_absorbancia_manual
    //% block="absorbance sample %periodoMuestra white %periodoBlanco μs"
    //% group="Spectrophotometer" weight=67
    export function tcsAbsorbanciaManual(periodoMuestra: number, periodoBlanco: number): number {
        if (periodoBlanco <= 0 || periodoMuestra <= 0) return 0
        let ratio = periodoMuestra / periodoBlanco
        return Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
    }

    // =========================================================================
    // Bloques — Advanced
    // =========================================================================

    /**
     * Lee un solo período del TCS3200 sin promediado (lectura cruda).
     * @param canal canal de color
     */
    //% blockId=fisicabit_tcs_crudo
    //% block="TCS3200 raw single period (μs) channel %canal"
    //% group="Spectrophotometer" weight=60
    export function tcsLeerCrudo(canal: CanalTCS3200): number {
        _seleccionarCanal(canal)
        return fisicabit_native.tcs3200LeerPeriodoUs(_pinOut, _timeoutUs)
    }

    /**
     * Configura el timeout para las lecturas del TCS3200.
     * @param timeoutMs timeout en milisegundos
     */
    //% blockId=fisicabit_tcs_timeout
    //% block="set TCS3200 timeout %timeoutMs ms"
    //% group="Spectrophotometer" weight=59
    //% timeoutMs.min=50 timeoutMs.max=2000 timeoutMs.defl=500
    export function tcsFijarTimeout(timeoutMs: number): void {
        _timeoutUs = Math.clamp(50, 2000, timeoutMs) * 1000
    }

    /**
     * Envía los datos de todos los canales por serial (para graficar).
     * Formato: R:valor,G:valor,B:valor,C:valor
     */
    //% blockId=fisicabit_tcs_serial
    //% block="TCS3200 send all channels via serial"
    //% group="Spectrophotometer" weight=58
    export function tcsEnviarSerial(): void {
        tcsLeerTodos()
        serial.writeLine(
            "R:" + _ultimoRojo +
            ",G:" + _ultimoVerde +
            ",B:" + _ultimoAzul +
            ",C:" + _ultimoClear
        )
    }

    /**
     * Envía datos de espectrofotometría por serial.
     * Formato: canal,periodo_us,transmitancia_%,absorbancia
     * @param canal canal de color
     */
    //% blockId=fisicabit_tcs_serial_spectro
    //% block="TCS3200 send spectro data via serial channel %canal"
    //% group="Spectrophotometer" weight=57
    export function tcsEnviarSerialSpectro(canal: CanalTCS3200): void {
        let blanco = _getBlanco(canal)
        let muestra = _leerPeriodo(canal)
        let T = 0
        let A = 0
        if (blanco > 0 && muestra > 0) {
            T = Math.roundWithPrecision((blanco / muestra) * 100, 1)
            let ratio = muestra / blanco
            A = Math.roundWithPrecision(Math.log(ratio) / Math.log(10), 3)
        }
        let nombre = ""
        switch (canal) {
            case CanalTCS3200.Rojo: nombre = "R"; break
            case CanalTCS3200.Verde: nombre = "G"; break
            case CanalTCS3200.Azul: nombre = "B"; break
            case CanalTCS3200.Clear: nombre = "C"; break
        }
        serial.writeLine(nombre + "," + muestra + "," + T + "," + A)
    }
}
