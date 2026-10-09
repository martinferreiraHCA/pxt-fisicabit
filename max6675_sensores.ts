// =============================================================================
//  max6675_sensores.ts — Termocupla tipo K con módulo MAX6675 (Maxim)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensor: Termocupla tipo K (cromel/alumel) + conversor MAX6675
//  Protocolo: SPI de sólo lectura (3 cables: SCK, CS, SO), bit-bang en TS
//  Alimentación: 3,0 V – 5,5 V → conectar a 3V del micro:bit (la salida SO
//                queda al nivel de VCC, así que a 3 V es segura para la placa)
//
//  CABLEADO (módulo MAX6675 genérico, 5 pines):
//    ┌─────────────────────────────────────────────┐
//    │  Módulo MAX6675               micro:bit     │
//    │  ┌────────┐                                 │
//    │  │  VCC   │──────────────── 3V              │
//    │  │  GND   │──────────────── GND             │
//    │  │  SCK   │──────────────── P13  (reloj)    │
//    │  │  CS    │──────────────── P16  (selección)│
//    │  │  SO    │──────────────── P14  (datos)    │
//    │  └────────┘                                 │
//    │  Termocupla: cable rojo → "−", amarillo → "+"│
//    │  (en el conector del módulo; si la lectura  │
//    │   baja al calentar, están invertidos)       │
//    └─────────────────────────────────────────────┘
//
//    P13/P14 son los pines SPI por hardware del micro:bit y P13–P16 quedan
//    libres en los kits de expansión (no tocan la pantalla ni los botones).
//    Cualquier pin digital sirve: el bloque indica los tres.
//    Varios módulos: comparten SCK y SO, cada uno con su propio CS.
//
//  PROTOCOLO MAX6675 (16 bits, MSB primero, dato válido con SCK en bajo):
//    D15     = 0 (dummy)
//    D14–D3  = temperatura, 12 bits sin signo, paso 0,25 °C (0 a 1023,75 °C)
//    D2      = 1 si la termocupla está abierta (cortada o desconectada)
//    D1      = 0 (identificador del chip)
//    D0      = alta impedancia (se lee cualquier cosa)
//    Con CS en alto el chip convierte sola (170–220 ms); bajar CS detiene
//    la conversión y presenta el último resultado. Leer más seguido que
//    cada 220 ms devuelve el mismo valor, así que el bloque no toca el bus
//    si todavía no pasó ese tiempo (nunca bloquea).
//
//  PRECISIÓN: ±2 °C típica entre 0 y 700 °C (compensación de unión fría
//  interna, −20 a 85 °C en el chip); resolución 0,25 °C. Si se necesita
//  exactitud, calibrar en agua con hielo (0 °C) con `fijar corrección`.
//
//  USO EN FÍSICA: curva de calentamiento/enfriamiento, punto de ebullición,
//  llama de mechero, fusión de estaño, equilibrio térmico con dos sondas.
// =============================================================================

//% weight=86
//% color=#BF360C
//% icon=""
//% block="MAX6675 — Type K thermocouple"
//% groups='["Measurement", "Calibration", "Diagnostics"]'
namespace FisicaBitMAX6675 {

    const INTERVALO_MIN_MS = 220    // tiempo de conversión máximo del chip
    const ERR_NINGUNO = 0
    const ERR_SIN_MODULO = 1
    const ERR_TERMOCUPLA_ABIERTA = 2

    // Estado del último módulo consultado (los bloques sin pines lo usan)
    let _ultRaw = 0                 // última palabra de 16 bits leída
    let _ultCuartos = 0             // última temperatura válida en 1/4 °C
    let _hayLectura = false
    let _ok = false
    let _error = ERR_NINGUNO
    let _correccion = 0             // corrección en °C sumada a cada lectura

    // Estado por módulo, indexado por el pin CS (permite varios MAX6675
    // compartiendo SCK y SO, cada uno con su propio CS y su propio reloj
    // de 220 ms).
    let _modCs: number[] = []
    let _modMs: number[] = []
    let _modRaw: number[] = []
    let _modCuartos: number[] = []
    let _modHay: boolean[] = []
    let _modOk: boolean[] = []
    let _modError: number[] = []

    function _indice(cs: DigitalPin): number {
        for (let i = 0; i < _modCs.length; i++) if (_modCs[i] == cs) return i
        _modCs.push(cs)
        _modMs.push(-INTERVALO_MIN_MS)
        _modRaw.push(0)
        _modCuartos.push(0)
        _modHay.push(false)
        _modOk.push(false)
        _modError.push(ERR_NINGUNO)
        return _modCs.length - 1
    }

    // =========================================================================
    // Acceso al bus (bit-bang SPI modo 0, sólo lectura)
    // =========================================================================

    /**
     * Lee los 16 bits del MAX6675. SCK queda en bajo entre lecturas; el dato
     * se muestrea con SCK en bajo (tras el flanco descendente), igual que la
     * librería de referencia de Adafruit. Tarda ~1 ms en TypeScript.
     */
    function _leerPalabra(sck: DigitalPin, cs: DigitalPin, so: DigitalPin): number {
        pins.digitalWritePin(sck, 0)
        pins.digitalWritePin(cs, 1)
        pins.setPull(so, PinPullMode.PullNone)
        control.waitMicros(5)
        pins.digitalWritePin(cs, 0)     // detiene la conversión y presenta D15
        control.waitMicros(5)
        let palabra = 0
        for (let i = 0; i < 16; i++) {
            pins.digitalWritePin(sck, 0)
            control.waitMicros(2)
            palabra = (palabra << 1) | (pins.digitalReadPin(so) & 1)
            pins.digitalWritePin(sck, 1)
            control.waitMicros(2)
        }
        pins.digitalWritePin(sck, 0)
        pins.digitalWritePin(cs, 1)     // arranca una nueva conversión
        return palabra & 0xFFFF
    }

    function _actualizar(sck: DigitalPin, cs: DigitalPin, so: DigitalPin, forzar: boolean): void {
        const k = _indice(cs)
        const ahora = control.millis()
        if (forzar || ahora - _modMs[k] >= INTERVALO_MIN_MS) {
            const raw = _leerPalabra(sck, cs, so)
            _modMs[k] = ahora
            _modRaw[k] = raw
            // Sin módulo (SO flotando o sin alimentación) el bus devuelve todo 1
            // o todo 0; además el bit D1 (identificador) siempre tiene que ser 0.
            if (raw == 0xFFFF || raw == 0x0000 || (raw & 0x0002) != 0) {
                _modOk[k] = false
                _modError[k] = ERR_SIN_MODULO
            } else if ((raw & 0x0004) != 0) {
                _modOk[k] = false
                _modError[k] = ERR_TERMOCUPLA_ABIERTA
            } else {
                _modCuartos[k] = (raw >> 3) & 0x0FFF
                _modOk[k] = true
                _modError[k] = ERR_NINGUNO
                _modHay[k] = true
            }
        }
        // Si todavía no pasaron 220 ms se conserva el resultado anterior del
        // módulo: bajar CS antes de tiempo cortaría la conversión en curso.
        _ultRaw = _modRaw[k]
        _ultCuartos = _modCuartos[k]
        _hayLectura = _modHay[k]
        _ok = _modOk[k]
        _error = _modError[k]
    }

    function _convertir(cuartos: number, unidad: UnidadTemperatura): number {
        const c = cuartos * 0.25 + _correccion
        let v = c
        if (unidad == UnidadTemperatura.Fahrenheit) v = c * 9 / 5 + 32
        else if (unidad == UnidadTemperatura.Kelvin) v = c + 273.15
        return Math.round(v * 100) / 100
    }

    // =========================================================================
    // MEDICIÓN
    // =========================================================================

    /**
     * Temperatura de la termocupla tipo K conectada al módulo MAX6675.
     * Rango 0 a 1023 °C, resolución 0,25 °C, precisión ±2 °C. El chip
     * entrega un valor nuevo cada 220 ms: si se lee más seguido devuelve el
     * mismo valor sin bloquear. Si falla, devuelve la última temperatura
     * válida (0 si nunca hubo una).
     *
     * Conexión: VCC → 3V, GND → GND, SCK → P13, CS → P16, SO → P14.
     *
     * Ejemplo (curva de enfriamiento): [para siempre] → [enviar a
     * fisicabit.com tiempo y (MAX6675 temperatura SCK P13 CS P16 SO P14
     * en °C) cada 500 ms]
     * @param sck Pin del reloj (SCK / CLK)
     * @param cs Pin de selección (CS)
     * @param so Pin de datos (SO / DO / MISO)
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_max6675_temperatura
    //% block="MAX6675 temperature SCK %sck CS %cs SO %so in %unidad"
    //% group="Measurement"
    //% weight=90
    //% sck.defl=DigitalPin.P13
    //% cs.defl=DigitalPin.P16
    //% so.defl=DigitalPin.P14
    //% unidad.defl=UnidadTemperatura.Celsius
    //% inlineInputMode=inline
    export function temperatura(sck: DigitalPin, cs: DigitalPin, so: DigitalPin, unidad: UnidadTemperatura): number {
        _actualizar(sck, cs, so, false)
        if (!_hayLectura) return 0
        return _convertir(_ultCuartos, unidad)
    }

    /**
     * Última temperatura válida leída, sin volver a consultar el módulo.
     * Útil para enviar el mismo valor en varias unidades o mostrarlo en
     * pantalla sin esperar otra conversión.
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_max6675_ultima
    //% block="MAX6675 last temperature in %unidad"
    //% group="Measurement"
    //% weight=85
    //% unidad.defl=UnidadTemperatura.Celsius
    export function ultimaTemperatura(unidad: UnidadTemperatura): number {
        if (!_hayLectura) return 0
        return _convertir(_ultCuartos, unidad)
    }

    // =========================================================================
    // CALIBRACIÓN
    // =========================================================================

    /**
     * Corrección en °C que se suma a todas las lecturas (por defecto 0).
     * Para calibrar: poner la termocupla en agua con hielo picado (0 °C),
     * esperar 1 minuto y fijar la corrección = −(temperatura leída).
     * Ejemplo: si lee 1,5 °C, fijar corrección −1,5.
     * @param grados Corrección en °C (positiva o negativa), eg: 0
     */
    //% blockId=fisicabit_max6675_correccion
    //% block="set MAX6675 correction %grados °C"
    //% group="Calibration"
    //% weight=80
    //% grados.defl=0
    export function fijarCorreccion(grados: number): void {
        _correccion = grados
    }

    /**
     * Corrección en °C aplicada actualmente a las lecturas.
     */
    //% blockId=fisicabit_max6675_correccion_actual
    //% block="MAX6675 correction (°C)"
    //% group="Calibration"
    //% weight=75
    export function correccion(): number {
        return _correccion
    }

    // =========================================================================
    // DIAGNÓSTICO
    // =========================================================================

    /**
     * Verdadero si la última lectura fue válida (módulo presente y
     * termocupla conectada).
     */
    //% blockId=fisicabit_max6675_valida
    //% block="MAX6675 reading valid?"
    //% group="Diagnostics"
    //% weight=70
    export function lecturaValida(): boolean {
        return _ok
    }

    /**
     * Verdadero si hay un módulo MAX6675 respondiendo en esos pines y la
     * termocupla está conectada. Consulta el bus (tarda ~1 ms).
     * @param sck Pin del reloj (SCK / CLK)
     * @param cs Pin de selección (CS)
     * @param so Pin de datos (SO / DO / MISO)
     */
    //% blockId=fisicabit_max6675_conectado
    //% block="MAX6675 connected SCK %sck CS %cs SO %so?"
    //% group="Diagnostics"
    //% weight=65
    //% sck.defl=DigitalPin.P13
    //% cs.defl=DigitalPin.P16
    //% so.defl=DigitalPin.P14
    //% inlineInputMode=inline
    export function estaConectado(sck: DigitalPin, cs: DigitalPin, so: DigitalPin): boolean {
        _actualizar(sck, cs, so, true)
        return _ok
    }

    /**
     * Código del último error: 0 = sin error, 1 = módulo no responde
     * (revisar VCC, GND y los pines SCK/CS/SO), 2 = termocupla abierta
     * (cable cortado o desconectado del módulo).
     */
    //% blockId=fisicabit_max6675_error
    //% block="MAX6675 last error code"
    //% group="Diagnostics"
    //% weight=60
    export function codigoError(): number {
        return _error
    }

    /**
     * Palabra de 16 bits tal como la entregó el chip en la última lectura
     * (para depurar el cableado: 65535 o 0 = módulo sin responder).
     */
    //% blockId=fisicabit_max6675_crudo
    //% block="MAX6675 raw value"
    //% group="Diagnostics"
    //% weight=55
    export function valorCrudo(): number {
        return _ultRaw
    }
}
