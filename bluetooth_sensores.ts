// =============================================================================
//  bluetooth_sensores.ts — Envío de datos por Bluetooth (UART BLE)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques simplificados para muestreo y envío de datos
//               vía Bluetooth Low Energy (BLE UART).
//
//  USO: El usuario arrastra UN bloque dentro de "para siempre" y listo.
//       El bloque acepta CUALQUIER valor (variable, sensor, expresión).
//       El timestamp comienza en 0 automáticamente.
//
//  EJEMPLO EN BLOQUES:
//  ┌──────────────────────────────────────────────┐
//  │ para siempre                                 │
//  │   ┌────────────────────────────────────────┐ │
//  │   │ BT muestrear valor [acelerómetro X]   │ │
//  │   │              muestreo cada [100] ms    │ │
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
    // Función interna: timestamp relativo (empieza en 0)
    // =========================================================================
    function _timestamp(): number {
        return input.runningTime() - _tiempoInicio
    }

    // =========================================================================
    // GRUPO 1: MUESTREO — Bloques principales (un bloque = todo)
    // =========================================================================

    /**
     * Muestrea y envía UN valor por Bluetooth con timestamp.
     * Coloca este bloque dentro de "para siempre".
     * Envía: timestamp,valor — luego espera el tiempo indicado.
     * El timestamp comienza en 0 automáticamente.
     * @param valor Valor a enviar (cualquier variable o sensor)
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear valor %valor|muestreo cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Muestreo"
    //% weight=100
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% valor.shadow=math_number
    //% inlineInputMode=inline
    export function muestrear1(valor: number, ms: number): void {
        _asegurarUART()
        let t = _timestamp()
        bluetooth.uartWriteLine("" + t + "," + valor)
        basic.pause(ms)
    }

    /**
     * Muestrea y envía DOS valores por Bluetooth con timestamp.
     * Coloca este bloque dentro de "para siempre".
     * Envía: timestamp,valor1,valor2 — luego espera el tiempo indicado.
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear valores %valor1 y %valor2|muestreo cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Muestreo"
    //% weight=95
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% valor1.shadow=math_number
    //% valor2.shadow=math_number
    //% inlineInputMode=inline
    export function muestrear2(valor1: number, valor2: number, ms: number): void {
        _asegurarUART()
        let t = _timestamp()
        bluetooth.uartWriteLine("" + t + "," + valor1 + "," + valor2)
        basic.pause(ms)
    }

    /**
     * Muestrea y envía TRES valores por Bluetooth con timestamp.
     * Coloca este bloque dentro de "para siempre".
     * Envía: timestamp,valor1,valor2,valor3 — luego espera el tiempo indicado.
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param ms Tiempo de muestreo en milisegundos
     */
    //% block="BT muestrear valores %valor1 , %valor2 y %valor3|muestreo cada %ms ms"
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
        let t = _timestamp()
        bluetooth.uartWriteLine("" + t + "," + valor1 + "," + valor2 + "," + valor3)
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

    /**
     * Envía un valor con timestamp por Bluetooth (sin pausa).
     * Útil para envíos puntuales, no para muestreo continuo.
     * @param valor Valor a enviar
     */
    //% block="BT enviar valor %valor"
    //% blockId=fisicabit_bt_enviar_valor
    //% group="Envío Manual"
    //% weight=55
    export function enviarValor(valor: number): void {
        _asegurarUART()
        let t = _timestamp()
        bluetooth.uartWriteLine("" + t + "," + valor)
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
