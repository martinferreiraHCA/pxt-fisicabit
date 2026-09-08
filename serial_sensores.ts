// =============================================================================
//  serial_sensores.ts — "FisicaBit USB": envío de datos a fisicabit.com por USB
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para enviar datos de sensores a fisicabit.com por el
//               puerto serie USB (Web Serial, 115200 baudios).
//
//  USO TÍPICO EN BLOQUES (un solo bloque hace todo):
//    al iniciar:
//      [configurar frecuencia de muestreo (10 Hz)]
//    por siempre:
//      [enviar a fisicabit.com (aceleración x)]
//
//  El bloque "enviar a fisicabit.com":
//    1. Toma el tiempo en ms (arranca en 0)
//    2. Envía la línea CSV  "tiempo,valor"  (formato que espera la página)
//    3. Espera hasta el próximo instante de muestreo (frecuencia configurada)
//
//  Para 50-100 Hz usar el bloque "muestrear para fisicabit.com cada ...", que
//  evita el retardo oculto de ~20 ms del bucle "para siempre".
//
//  Nota: Bluetooth y Radio no pueden convivir en un mismo programa, pero USB
//  serial sí funciona junto con Bluetooth.
// =============================================================================

//% weight=99
//% color=#5C6BC0
//% icon=""
//% block="FisicaBit USB"
//% groups='["fisicabit.com", "Sampling", "Advanced"]'
namespace FisicaBitSerial {

    let _m: FisicaBitDatos.Muestreador = null
    let _iniciado = false

    function _asegurar(): FisicaBitDatos.Muestreador {
        if (!_m) _m = new FisicaBitDatos.Muestreador()
        if (!_iniciado) {
            _iniciado = true
            // fisicabit.com abre el puerto a 115200 baudios
            serial.setBaudRate(BaudRate.BaudRate115200)
            _m.reiniciarTiempo()
        }
        return _m
    }

    function _enviar(valores: number[]): void {
        const m = _asegurar()
        serial.writeLine(m.linea(valores))
        m.esperar()
    }

    // =========================================================================
    // GRUPO 1: fisicabit.com — un solo bloque
    // =========================================================================

    /**
     * Envía UN valor a fisicabit.com por USB y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía la línea: tiempo,valor
     * @param valor Valor a enviar (sensor, variable o cálculo)
     */
    //% block="send to fisicabit.com %valor"
    //% blockId=fisicabit_usb_enviar_1
    //% group="fisicabit.com"
    //% weight=100
    //% inlineInputMode=inline
    export function enviar1(valor: number): void {
        _enviar([valor])
    }

    /**
     * Envía DOS valores a fisicabit.com por USB y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     */
    //% block="send to fisicabit.com %valor1 and %valor2"
    //% blockId=fisicabit_usb_enviar_2
    //% group="fisicabit.com"
    //% weight=95
    //% inlineInputMode=inline
    export function enviar2(valor1: number, valor2: number): void {
        _enviar([valor1, valor2])
    }

    /**
     * Envía TRES valores a fisicabit.com por USB y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2,valor3
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     */
    //% block="send to fisicabit.com %valor1 , %valor2 and %valor3"
    //% blockId=fisicabit_usb_enviar_3
    //% group="fisicabit.com"
    //% weight=90
    //% inlineInputMode=inline
    export function enviar3(valor1: number, valor2: number, valor3: number): void {
        _enviar([valor1, valor2, valor3])
    }

    /**
     * Envía CUATRO valores a fisicabit.com por USB y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2,valor3,valor4
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param valor4 Cuarto valor
     */
    //% block="send to fisicabit.com %valor1 , %valor2 , %valor3 and %valor4"
    //% blockId=fisicabit_usb_enviar_4
    //% group="fisicabit.com"
    //% weight=85
    //% inlineInputMode=inline
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number): void {
        _enviar([valor1, valor2, valor3, valor4])
    }

    /**
     * Configura cuántas muestras por segundo se envían a fisicabit.com.
     * Colocar en "al iniciar". Por defecto: 10 Hz (una muestra cada 100 ms).
     * @param frecuencia Frecuencia de muestreo
     */
    //% block="set sampling rate %frecuencia"
    //% blockId=fisicabit_usb_frecuencia
    //% group="fisicabit.com"
    //% weight=80
    //% frecuencia.defl=FrecuenciaMuestreo.Hz10
    export function fijarFrecuencia(frecuencia: FrecuenciaMuestreo): void {
        _asegurar().fijarPeriodo(frecuencia)
    }

    // =========================================================================
    // GRUPO 2: MUESTREO — control fino del tiempo
    // =========================================================================

    /**
     * Configura el intervalo entre muestras en milisegundos (valor libre).
     * @param ms Intervalo de muestreo en ms (5 a 60000)
     */
    //% block="set sampling interval %ms ms"
    //% blockId=fisicabit_usb_intervalo
    //% group="Sampling"
    //% weight=75
    //% ms.min=5 ms.max=60000 ms.defl=100
    export function fijarIntervalo(ms: number): void {
        _asegurar().fijarPeriodo(ms)
    }

    /**
     * Ejecuta el código interior a la frecuencia indicada con temporización
     * precisa (sin el retardo oculto de "para siempre"). Recomendado para
     * 50 Hz y 100 Hz. Adentro usar "enviar a fisicabit.com".
     * @param frecuencia Frecuencia de muestreo
     * @param cuerpo Código a ejecutar en cada muestra
     */
    //% block="fisicabit.com sampling loop at %frecuencia"
    //% blockId=fisicabit_usb_bucle
    //% group="Sampling"
    //% weight=70
    //% frecuencia.defl=FrecuenciaMuestreo.Hz50
    //% blockAllowMultiple=0
    export function bucleMuestreo(frecuencia: FrecuenciaMuestreo, cuerpo: () => void): void {
        const m = _asegurar()
        m.fijarPeriodo(frecuencia)
        m.bucle(cuerpo)
    }

    /**
     * Tiempo en milisegundos desde que se inició el envío por USB.
     * Siempre comienza en 0. Es el mismo tiempo que viaja en cada línea.
     */
    //% block="USB time (ms)"
    //% blockId=fisicabit_serial_tiempo
    //% group="Sampling"
    //% weight=65
    export function tiempoSerial(): number {
        return _asegurar().tiempo()
    }

    /**
     * Vuelve el tiempo a 0 (por ejemplo al apretar un botón para empezar
     * una nueva medición).
     */
    //% block="reset USB time to 0"
    //% blockId=fisicabit_usb_reiniciar_tiempo
    //% group="Sampling"
    //% weight=60
    export function reiniciarTiempo(): void {
        _asegurar().reiniciarTiempo()
    }

    // =========================================================================
    // GRUPO 3: AVANZADO
    // =========================================================================

    /**
     * Activa o desactiva el envío del tiempo del micro:bit como primera
     * columna. Debe coincidir con la opción "Micro:bit envía timestamp"
     * de fisicabit.com (activada por defecto).
     * @param activar true = enviar tiempo (por defecto), false = sólo valores
     */
    //% block="USB send micro:bit timestamp %activar"
    //% blockId=fisicabit_usb_timestamp
    //% group="Advanced"
    //% weight=50
    //% activar.shadow=toggleOnOff
    //% activar.defl=true
    //% advanced=true
    export function enviarTimestamp(activar: boolean): void {
        _asegurar().enviarTiempo = activar
    }

    /**
     * Cantidad de decimales con que se envían los valores no enteros.
     * @param decimales Decimales (0 a 6). Por defecto 2.
     */
    //% block="USB set decimals %decimales"
    //% blockId=fisicabit_usb_decimales
    //% group="Advanced"
    //% weight=45
    //% decimales.min=0 decimales.max=6 decimales.defl=2
    //% advanced=true
    export function fijarDecimales(decimales: number): void {
        _asegurar().decimales = Math.round(decimales)
    }

    /**
     * Envía una línea de texto libre por USB (sin tiempo ni espera).
     * @param texto Texto a enviar
     */
    //% block="USB send line %texto"
    //% blockId=fisicabit_usb_linea
    //% group="Advanced"
    //% weight=40
    //% advanced=true
    export function enviarLinea(texto: string): void {
        _asegurar()
        serial.writeLine(texto)
    }

    // =========================================================================
    // BLOQUES ANTERIORES (obsoletos) — se mantienen para que los proyectos
    // viejos sigan compilando. No aparecen en la caja de herramientas.
    // =========================================================================

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com" + "configurar frecuencia".
     */
    //% block="serial sample %valor|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_1
    //% group="Advanced"
    //% weight=10
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function serialMuestrear1(valor: number, ms: number): void {
        _asegurar()
        serial.writeLine("" + valor)
        basic.pause(ms)
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com" + "configurar frecuencia".
     */
    //% block="serial sample %valor1 and %valor2|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_2
    //% group="Advanced"
    //% weight=9
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function serialMuestrear2(valor1: number, valor2: number, ms: number): void {
        _asegurar()
        serial.writeLine("" + valor1 + "," + valor2)
        basic.pause(ms)
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com" + "configurar frecuencia".
     */
    //% block="serial sample %valor1 , %valor2 and %valor3|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_3
    //% group="Advanced"
    //% weight=8
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function serialMuestrear3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _asegurar()
        serial.writeLine("" + valor1 + "," + valor2 + "," + valor3)
        basic.pause(ms)
    }
}
