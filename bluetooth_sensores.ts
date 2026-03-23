// =============================================================================
//  bluetooth_sensores.ts — Envío de datos por Bluetooth (UART BLE)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques simplificados para muestreo y envío de datos
//               vía Bluetooth Low Energy (BLE UART).
//
//  USO: El usuario arrastra UN bloque dentro de "para siempre".
//       Cada slot acepta CUALQUIER valor (variable, sensor, expresión).
//       Si quiere incluir el tiempo, arrastra el bloque "tiempo (ms)"
//       en uno de los slots.
//
//  EJEMPLO EN BLOQUES (con tiempo):
//  ┌──────────────────────────────────────────────────────┐
//  │ para siempre                                         │
//  │   ┌──────────────────────────────────────────────┐   │
//  │   │ BT muestrear [tiempo (ms)] y [acel X]       │   │
//  │   │              cada [100] ms                    │   │
//  │   └──────────────────────────────────────────────┘   │
//  └──────────────────────────────────────────────────────┘
//
//  EJEMPLO EN BLOQUES (sin tiempo):
//  ┌──────────────────────────────────────────────┐
//  │ para siempre                                 │
//  │   ┌────────────────────────────────────────┐ │
//  │   │ BT muestrear [acelerómetro X]         │ │
//  │   │              cada [100] ms             │ │
//  │   └────────────────────────────────────────┘ │
//  └──────────────────────────────────────────────┘
//
//  IMPORTANTE — CONFIGURACIÓN PREVIA:
//  ───────────────────────────────────
//  1. En MakeCode: ⚙ → Project Settings → activar "No Pairing Required"
//  2. En pxt.json, sección "bluetooth":
//     { "open": 1, "pairing_mode": 0, "whitelist": 0 }
//  3. Al agregar Bluetooth se DESACTIVA el serial USB y la extensión Radio.
// =============================================================================


// =============================================================================
// NAMESPACE — "FisicaBit BT" aparecerá como categoría separada en la toolbox
// =============================================================================
//% weight=90
//% color=#0082FB
//% icon="\uf294"
//% block="FisicaBit BT"
//% groups="['Muestreo', 'Conexión', 'Envío Manual', 'Servicios BLE']"
namespace FisicaBitBT {

    // =========================================================================
    // Variables internas
    // =========================================================================
    let _uartIniciado = false
    let _tiempoInicio = 0

    // =========================================================================
    // Función interna: asegurar que UART esté iniciado
    // =========================================================================
    function _asegurarUART(): void {
        if (!_uartIniciado) {
            bluetooth.startUartService()
            _tiempoInicio = input.runningTime()
            _uartIniciado = true
        }
    }

    // =========================================================================
    // GRUPO 1: MUESTREO — Bloques principales
    // =========================================================================

    /**
     * Tiempo en milisegundos desde que se inició el Bluetooth.
     * Siempre comienza en 0. Arrastrá este bloque a un slot de muestreo
     * para incluir el tiempo en los datos enviados.
     */
    //% block="tiempo (ms)"
    //% blockId=fisicabit_bt_tiempo
    //% group="Muestreo"
    //% weight=105
    export function tiempo(): number {
        _asegurarUART()
        return input.runningTime() - _tiempoInicio
    }

    /**
     * Envía UN valor por Bluetooth y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * Envía: valor — luego espera el tiempo indicado.
     * @param valor Valor a enviar (cualquier variable, sensor o "tiempo (ms)")
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear %valor|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Muestreo"
    //% weight=100
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% valor.shadow=math_number
    //% inlineInputMode=inline
    export function muestrear1(valor: number, ms: number): void {
        _asegurarUART()
        bluetooth.uartWriteLine("" + valor)
        basic.pause(ms)
    }

    /**
     * Envía DOS valores por Bluetooth y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * Envía: valor1,valor2 — luego espera el tiempo indicado.
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear %valor1 y %valor2|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Muestreo"
    //% weight=95
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% valor1.shadow=math_number
    //% valor2.shadow=math_number
    //% inlineInputMode=inline
    export function muestrear2(valor1: number, valor2: number, ms: number): void {
        _asegurarUART()
        bluetooth.uartWriteLine("" + valor1 + "," + valor2)
        basic.pause(ms)
    }

    /**
     * Envía TRES valores por Bluetooth y espera el tiempo de muestreo.
     * Coloca este bloque dentro de "para siempre".
     * Envía: valor1,valor2,valor3 — luego espera el tiempo indicado.
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear %valor1 , %valor2 y %valor3|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_3
    //% group="Muestreo"
    //% weight=90
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% valor1.shadow=math_number
    //% valor2.shadow=math_number
    //% valor3.shadow=math_number
    //% inlineInputMode=inline
    export function muestrear3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _asegurarUART()
        bluetooth.uartWriteLine("" + valor1 + "," + valor2 + "," + valor3)
        basic.pause(ms)
    }

    // =========================================================================
    // GRUPO 2: CONEXIÓN
    // =========================================================================

    /**
     * Inicia el servicio Bluetooth UART manualmente.
     * No es necesario si usás los bloques de muestreo (se inicia solo).
     */
    //% block="iniciar Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Conexión"
    //% weight=80
    export function iniciarUART(): void {
        _asegurarUART()
        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * Muestra un ícono cuando un dispositivo se conecta o desconecta.
     */
    //% block="configurar indicador de conexión BT"
    //% blockId=fisicabit_bt_indicador
    //% group="Conexión"
    //% weight=75
    export function configurarIndicadorConexion(): void {
        bluetooth.onBluetoothConnected(function () {
            basic.showIcon(IconNames.Heart)
        })
        bluetooth.onBluetoothDisconnected(function () {
            basic.showIcon(IconNames.No)
        })
    }

    // =========================================================================
    // GRUPO 3: ENVÍO MANUAL (para casos especiales)
    // =========================================================================

    /**
     * Envía una línea de texto libre por Bluetooth.
     * @param texto Texto a enviar
     */
    //% block="BT enviar texto %texto"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Envío Manual"
    //% weight=60
    export function enviarTexto(texto: string): void {
        _asegurarUART()
        bluetooth.uartWriteLine(texto)
    }

    // =========================================================================
    // GRUPO 4: SERVICIOS BLE ADICIONALES (avanzado)
    // =========================================================================

    /**
     * Inicia el servicio BLE de acelerómetro.
     */
    //% block="iniciar servicio BLE acelerómetro"
    //% blockId=fisicabit_bt_srv_accel
    //% group="Servicios BLE"
    //% weight=50
    //% advanced=true
    export function iniciarServicioAcelerometro(): void {
        bluetooth.startAccelerometerService()
    }

    /**
     * Inicia el servicio BLE de temperatura.
     */
    //% block="iniciar servicio BLE temperatura"
    //% blockId=fisicabit_bt_srv_temp
    //% group="Servicios BLE"
    //% weight=48
    //% advanced=true
    export function iniciarServicioTemperatura(): void {
        bluetooth.startTemperatureService()
    }

    /**
     * Inicia el servicio BLE de magnetómetro (brújula).
     */
    //% block="iniciar servicio BLE magnetómetro"
    //% blockId=fisicabit_bt_srv_mag
    //% group="Servicios BLE"
    //% weight=46
    //% advanced=true
    export function iniciarServicioMagnetometro(): void {
        bluetooth.startMagnetometerService()
    }

    /**
     * Inicia el servicio BLE de botones.
     */
    //% block="iniciar servicio BLE botones"
    //% blockId=fisicabit_bt_srv_btn
    //% group="Servicios BLE"
    //% weight=44
    //% advanced=true
    export function iniciarServicioBotones(): void {
        bluetooth.startButtonService()
    }

    /**
     * Inicia el servicio BLE de pantalla LED.
     */
    //% block="iniciar servicio BLE pantalla LED"
    //% blockId=fisicabit_bt_srv_led
    //% group="Servicios BLE"
    //% weight=42
    //% advanced=true
    export function iniciarServicioLED(): void {
        bluetooth.startLEDService()
    }

    /**
     * Inicia el servicio BLE de pines I/O.
     */
    //% block="iniciar servicio BLE pines I/O"
    //% blockId=fisicabit_bt_srv_io
    //% group="Servicios BLE"
    //% weight=40
    //% advanced=true
    export function iniciarServicioIO(): void {
        bluetooth.startIOPinService()
    }
}
