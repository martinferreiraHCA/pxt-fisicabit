// =============================================================================
//  ds18b20_sensores.ts — Sonda de temperatura DS18B20 (Dallas/Maxim, OneWire)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensor: DS18B20 (sonda sumergible de acero inoxidable o encapsulado TO-92)
//  Protocolo: OneWire (1 cable de datos), implementado en C++ (shims.cpp)
//  Alimentación: 3 V – 5,5 V
//
//  CABLEADO (sonda de 3 cables):
//    Rojo    (VDD)  → 3V
//    Negro   (GND)  → GND
//    Amarillo/blanco (DATA) → P0 (cualquier pin digital)
//    ⚠ Resistencia pull-up de 4,7 kΩ entre DATA y 3V (obligatoria; los
//      módulos con placa suelen traerla incorporada).
//
//  PRECISIÓN: ±0,5 °C entre −10 y 85 °C; rango −55 a 125 °C.
//  RESOLUCIÓN: 9 a 12 bits (0,5 a 0,0625 °C); la conversión tarda de
//              94 ms (9 bits) a 750 ms (12 bits) y bloquea el bloque.
//  VARIAS SONDAS: una por pin (cada bloque indica su pin).
//
//  El código nativo está adaptado de "microbit-dstemp" de Bill Siever
//  (licencia MIT), con espera real del fin de conversión y resolución
//  configurable.
// =============================================================================

//% weight=87
//% color=#E65100
//% icon=""
//% block="DS18B20 — Temperature probe"
//% groups='["Measurement", "Diagnostics"]'
namespace FisicaBitDS18B20 {

    const RAW_ERROR = -100000

    let _bits = 12
    let _ultRaw = 0            // último valor crudo válido (1/16 °C)
    let _ok = false
    let _hayLectura = false

    // ── Shims nativos (cuerpo TS = simulador) ──

    //% shim=fisicabit_native::ds18b20Leer
    function _hwLeer(pin: DigitalPin, bits: number): number {
        // Simulador: 25 °C con una pequeña variación
        return 400 + (control.millis() / 500) % 8
    }

    //% shim=fisicabit_native::ds18b20Error
    function _hwError(): number {
        return 0
    }

    //% shim=fisicabit_native::ds18b20Presente
    function _hwPresente(pin: DigitalPin): number {
        return 1
    }

    function _convertir(raw: number, unidad: UnidadTemperatura): number {
        const c = raw / 16
        let v = c
        if (unidad == UnidadTemperatura.Fahrenheit) v = c * 9 / 5 + 32
        else if (unidad == UnidadTemperatura.Kelvin) v = c + 273.15
        return Math.round(v * 100) / 100
    }

    function _leer(pin: DigitalPin): void {
        const raw = _hwLeer(pin, _bits)
        if (raw == RAW_ERROR || raw < -1000 || raw > 2100) {
            // -55 °C = -880; 125 °C = 2000. Fuera de rango = lectura corrupta.
            _ok = false
            return
        }
        _ultRaw = raw
        _ok = true
        _hayLectura = true
    }

    // =========================================================================
    // MEDICIÓN
    // =========================================================================

    /**
     * Lee la temperatura de la sonda DS18B20 conectada al pin. Precisión
     * ±0,5 °C, resolución 0,06 °C (12 bits). La lectura tarda hasta 750 ms;
     * si falla, devuelve la última temperatura válida (0 si nunca hubo una).
     *
     * Conexión: rojo → 3V, negro → GND, amarillo (DATA) → P0, resistencia
     * de 4,7 kΩ entre DATA y 3V.
     *
     * Ejemplo (calorimetría): [para siempre] → [enviar a fisicabit.com
     * tiempo y (DS18B20 temperatura en P0 en °C) cada 1000 ms]
     * @param pin Pin digital donde está conectado DATA
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_ds18b20_temperatura
    //% block="DS18B20 temperature on %pin in %unidad"
    //% group="Measurement"
    //% weight=90
    //% pin.defl=DigitalPin.P0
    //% unidad.defl=UnidadTemperatura.Celsius
    export function temperatura(pin: DigitalPin, unidad: UnidadTemperatura): number {
        _leer(pin)
        if (!_hayLectura) return 0
        return _convertir(_ultRaw, unidad)
    }

    /**
     * Última temperatura válida leída, sin volver a consultar la sonda.
     * Útil para enviar el mismo valor en varias unidades o para mostrarlo
     * en pantalla sin esperar otra conversión.
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_ds18b20_ultima
    //% block="DS18B20 last temperature in %unidad"
    //% group="Measurement"
    //% weight=85
    //% unidad.defl=UnidadTemperatura.Celsius
    export function ultimaTemperatura(unidad: UnidadTemperatura): number {
        if (!_hayLectura) return 0
        return _convertir(_ultRaw, unidad)
    }

    /**
     * Resolución de la sonda: más bits = más fino pero más lento.
     * 9 bits: 0,5 °C en 94 ms · 10 bits: 0,25 °C en 188 ms ·
     * 11 bits: 0,125 °C en 375 ms · 12 bits: 0,0625 °C en 750 ms (por defecto).
     * Para enviar a fisicabit.com más de 1 vez por segundo usar 9 o 10 bits.
     * @param resolucion Resolución en bits
     */
    //% blockId=fisicabit_ds18b20_resolucion
    //% block="set DS18B20 resolution %resolucion"
    //% group="Measurement"
    //% weight=80
    //% resolucion.defl=ResolucionDS18B20.Bits12
    export function fijarResolucion(resolucion: ResolucionDS18B20): void {
        _bits = resolucion
    }

    // =========================================================================
    // DIAGNÓSTICO
    // =========================================================================

    /**
     * Verdadero si la última lectura fue válida (sonda presente y CRC correcto).
     */
    //% blockId=fisicabit_ds18b20_valida
    //% block="DS18B20 reading valid?"
    //% group="Diagnostics"
    //% weight=70
    export function lecturaValida(): boolean {
        return _ok
    }

    /**
     * Verdadero si hay una sonda DS18B20 respondiendo en el pin (no mide,
     * sólo comprueba la conexión; tarda unos 2 ms).
     * @param pin Pin digital donde está conectado DATA
     */
    //% blockId=fisicabit_ds18b20_conectado
    //% block="DS18B20 connected on %pin?"
    //% group="Diagnostics"
    //% weight=65
    //% pin.defl=DigitalPin.P0
    export function estaConectado(pin: DigitalPin): boolean {
        return _hwPresente(pin) == 1
    }

    /**
     * Código del último error: 0 = sin error, 1 = sonda no conectada
     * (revisar cableado y resistencia de 4,7 kΩ), 2 = no arranca la
     * conversión, 3 = datos corruptos (CRC), 4 = tiempo agotado.
     */
    //% blockId=fisicabit_ds18b20_error
    //% block="DS18B20 last error code"
    //% group="Diagnostics"
    //% weight=60
    export function codigoError(): number {
        return _hwError()
    }
}
