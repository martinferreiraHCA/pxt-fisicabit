// =============================================================================
//  serial_sensores.ts — Muestreo serial (USB) para datos de sensores
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para enviar datos de sensores por puerto serie USB.
//               Ideal para graficar en tiempo real desde MakeCode,
//               planillas de cálculo, o la app FisicaBit.
//
//  USO TÍPICO EN BLOQUES:
//    por siempre:
//      [serial muestrear [tiempo serial] y [sensor] cada 50 ms]
// =============================================================================

// Muestreo serial como bloque independiente
//% weight=89
//% color=#A8A8A8
//% icon="\uf1c0"
//% block="FisicaBit Serial"
//% groups='["Sampling"]'
namespace FisicaBitSerial {

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
    //% group="Sampling"
    //% weight=75
    export function tiempoSerial(): number {
        _asegurarSerial()
        return input.runningTime() - _serialTiempoInicio
    }

    /**
     * Envía UN valor por puerto serie (USB) y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * @param valor Valor a enviar
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_1
    //% group="Sampling"
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
     * Envía: valor1,valor2
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor1 and %valor2|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_2
    //% group="Sampling"
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
     * Envía: valor1,valor2,valor3
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="serial sample %valor1 , %valor2 and %valor3|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_3
    //% group="Sampling"
    //% weight=60
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function serialMuestrear3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _asegurarSerial()
        serial.writeLine("" + valor1 + "," + valor2 + "," + valor3)
        basic.pause(ms)
    }
}
