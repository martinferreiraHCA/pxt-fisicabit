// =============================================================================
//  serial_sensores.ts — "FisicaBit USB": envío de datos a fisicabit.com por USB
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para enviar datos de sensores a fisicabit.com por el
//               puerto serie USB (Web Serial, 115200 baudios).
//
//  SECUENCIA MÍNIMA (un solo bloque):
//    por siempre:
//      [enviar a fisicabit.com tiempo y (aceleración x) cada (100) ms]
//
//  Ese bloque, en cada vuelta:
//    1. Toma el tiempo del micro:bit en ms (arranca en 0)
//    2. Envía la línea CSV  "tiempo,valor"  (formato que espera la página)
//    3. Espera hasta que se cumplan los ms indicados desde la muestra anterior
//       (temporización por "deadline": el período real coincide con el
//       configurado aunque "para siempre" agregue su retardo oculto de ~20 ms)
//
//  En fisicabit.com: conexión USB, número de variables = cantidad de valores
//  del bloque (sin contar el tiempo) y "Micro:bit envía timestamp" activado.
//
//  Para 50-100 Hz usar el bloque "bucle rápido para fisicabit.com cada ... ms",
//  que evita el retardo oculto de "para siempre".
//
//  Nota: Bluetooth y Radio no pueden convivir en un mismo programa, pero USB
//  serial sí funciona junto con Bluetooth.
// =============================================================================

//% weight=99
//% color=#5C6BC0
//% icon=""
//% block="FisicaBit USB"
//% groups='["1. Send (inside forever)", "2. Optional", "Advanced"]'
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

    function _enviar(valores: number[], ms: number): void {
        const m = _asegurar()
        m.fijarPeriodo(ms)
        serial.writeLine(m.linea(valores))
        m.esperar()
    }

    // =========================================================================
    // PASO 1: ENVIAR — un solo bloque dentro de "para siempre"
    // =========================================================================

    /**
     * Envía a fisicabit.com el tiempo (ms) y un valor medido, y espera hasta
     * la próxima muestra. Colocar dentro de "para siempre".
     * Línea enviada: tiempo,valor
     *
     * Ejemplo: [enviar a fisicabit.com tiempo y (aceleración x) cada (100) ms]
     *   → 10 muestras por segundo con el tiempo del micro:bit desde 0.
     * En fisicabit.com: USB, 1 variable, "Micro:bit envía timestamp" activado.
     *
     * @param valor Valor medido (sensor, variable o cálculo)
     * @param ms Tiempo entre muestras en ms (100 = 10 por segundo), eg: 100
     */
    //% block="send to fisicabit.com time and %valor every %ms ms"
    //% blockId=fisicabit_usb_enviar_1
    //% group="1. Send (inside forever)"
    //% weight=100
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar1(valor: number, ms: number): void {
        _enviar([valor], ms)
    }

    /**
     * Envía a fisicabit.com el tiempo (ms) y dos valores medidos, y espera
     * hasta la próxima muestra. Colocar dentro de "para siempre".
     * Línea enviada: tiempo,valor1,valor2
     *
     * Ejemplo: [enviar a fisicabit.com tiempo, (aceleración x) y (aceleración y) cada (100) ms]
     * En fisicabit.com: USB, 2 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com time, %valor1 and %valor2 every %ms ms"
    //% blockId=fisicabit_usb_enviar_2
    //% group="1. Send (inside forever)"
    //% weight=95
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar2(valor1: number, valor2: number, ms: number): void {
        _enviar([valor1, valor2], ms)
    }

    /**
     * Envía a fisicabit.com el tiempo (ms) y tres valores medidos, y espera
     * hasta la próxima muestra. Colocar dentro de "para siempre".
     * Línea enviada: tiempo,valor1,valor2,valor3
     *
     * Ejemplo: aceleración x, y, z cada 100 ms.
     * En fisicabit.com: USB, 3 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com time, %valor1 , %valor2 and %valor3 every %ms ms"
    //% blockId=fisicabit_usb_enviar_3
    //% group="1. Send (inside forever)"
    //% weight=90
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _enviar([valor1, valor2, valor3], ms)
    }

    /**
     * Envía a fisicabit.com el tiempo (ms) y cuatro valores medidos, y espera
     * hasta la próxima muestra. Colocar dentro de "para siempre".
     * Línea enviada: tiempo,valor1,valor2,valor3,valor4
     *
     * En fisicabit.com: USB, 4 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param valor4 Cuarto valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com time, %valor1 , %valor2 , %valor3 and %valor4 every %ms ms"
    //% blockId=fisicabit_usb_enviar_4
    //% group="1. Send (inside forever)"
    //% weight=85
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number, ms: number): void {
        _enviar([valor1, valor2, valor3, valor4], ms)
    }

    // =========================================================================
    // PASO 2: OPCIONAL — velocidad alta y control del tiempo
    // =========================================================================

    /**
     * Bucle rápido para fisicabit.com: ejecuta el código interior cada
     * X ms con temporización precisa, sin el retardo oculto de
     * "para siempre". Usar en lugar de "para siempre" para 50-100 Hz
     * (caída libre, choques, resortes). Adentro va el bloque "enviar a
     * fisicabit.com"; su tiempo "cada ... ms" se ignora dentro del bucle.
     *
     * Ejemplo: [bucle rápido cada (20) ms] con [enviar a fisicabit.com tiempo y (aceleración z) cada (20) ms] → 50 Hz.
     *
     * @param ms Tiempo entre muestras en ms (20 = 50 por segundo, 10 = 100 por segundo), eg: 20
     * @param cuerpo Código a ejecutar en cada muestra
     */
    //% block="fisicabit.com fast loop every %ms ms"
    //% blockId=fisicabit_usb_bucle
    //% group="2. Optional"
    //% weight=80
    //% ms.min=5 ms.max=60000 ms.defl=20
    //% blockAllowMultiple=0
    export function bucleMuestreo(ms: number, cuerpo: () => void): void {
        const m = _asegurar()
        m.fijarPeriodo(ms)
        m.bucle(cuerpo)
    }

    /**
     * Vuelve el tiempo a 0. Útil para empezar una nueva medición al apretar
     * un botón: la próxima línea enviada arranca en tiempo 0.
     *
     * Ejemplo: [al presionar botón A] → [reiniciar tiempo USB a 0]
     */
    //% block="reset USB time to 0"
    //% blockId=fisicabit_usb_reiniciar_tiempo
    //% group="2. Optional"
    //% weight=75
    export function reiniciarTiempo(): void {
        _asegurar().reiniciarTiempo()
    }

    /**
     * Tiempo en milisegundos desde que se inició el envío por USB (arranca
     * en 0). Es el mismo tiempo que viaja en cada línea. Sirve para
     * mostrarlo en la pantalla o para cálculos propios.
     */
    //% block="USB time (ms)"
    //% blockId=fisicabit_serial_tiempo
    //% group="2. Optional"
    //% weight=70
    export function tiempoSerial(): number {
        return _asegurar().tiempo()
    }

    // =========================================================================
    // AVANZADO
    // =========================================================================

    /**
     * Activa o desactiva el envío del tiempo del micro:bit como primera
     * columna. Debe coincidir con la opción "Micro:bit envía timestamp"
     * de fisicabit.com (activada por defecto). Si la desactivás, la página
     * usa el reloj del navegador.
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

    /**
     * Fija el intervalo entre muestras que usarán los bloques de envío que
     * no lo indiquen. Normalmente no hace falta: el bloque "enviar" ya trae
     * su propio "cada ... ms".
     * @param frecuencia Frecuencia de muestreo
     */
    //% block="set sampling rate %frecuencia"
    //% blockId=fisicabit_usb_frecuencia
    //% group="Advanced"
    //% weight=30
    //% frecuencia.defl=FrecuenciaMuestreo.Hz10
    //% advanced=true
    export function fijarFrecuencia(frecuencia: FrecuenciaMuestreo): void {
        _asegurar().fijarPeriodo(frecuencia)
    }

    /**
     * Fija el intervalo entre muestras en milisegundos (valor libre).
     * Normalmente no hace falta: el bloque "enviar" ya trae su propio "cada ... ms".
     * @param ms Intervalo de muestreo en ms (5 a 60000)
     */
    //% block="set sampling interval %ms ms"
    //% blockId=fisicabit_usb_intervalo
    //% group="Advanced"
    //% weight=29
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% advanced=true
    export function fijarIntervalo(ms: number): void {
        _asegurar().fijarPeriodo(ms)
    }

    // =========================================================================
    // BLOQUES ANTERIORES (obsoletos) — se mantienen para que los proyectos
    // viejos sigan compilando. No aparecen en la caja de herramientas.
    // =========================================================================

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com tiempo y ... cada ... ms".
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
     * (Obsoleto) Usar "enviar a fisicabit.com tiempo, ... y ... cada ... ms".
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
     * (Obsoleto) Usar "enviar a fisicabit.com tiempo, ... , ... y ... cada ... ms".
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
