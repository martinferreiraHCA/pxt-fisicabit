// =============================================================================
//  bluetooth_sensores.ts — Envío de datos por Bluetooth (UART BLE)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques simplificados para muestreo y envío de datos
//               vía Bluetooth Low Energy (BLE UART).
//
//  PROTOCOLO DE CONEXIÓN CON fisicabit.com:
//  ─────────────────────────────────────────
//  fisicabit.com usa Web Bluetooth API y busca:
//    1. Dispositivo con nombre "BBC micro:bit [XXXXX]"
//    2. Servicio UART Nordic (UUID 6e400001-b5a3-f393-e0a9-e50e24dcca9e)
//    3. Opcionalmente: servicios BLE nativos (acelerómetro, temperatura, etc.)
//
//  El micro:bit envía datos CSV por UART:
//    - Con timestamp:  "tiempo,valor1,valor2\n"
//    - Sin timestamp:  "valor1,valor2\n"
//
//  CONFIGURACIÓN REQUERIDA (pxt.json):
//    "bluetooth": { "open": 1, "pairing_mode": 0, "whitelist": 0 }
//    → Conexión abierta, sin vinculación, sin lista blanca.
//
//  NOTA SOBRE LAS "BARRITAS" EN LA PANTALLA LED:
//  ──────────────────────────────────────────────
//  Al arrancar con Bluetooth, CODAL muestra un patrón de barras
//  (el nombre BLE del dispositivo) en la matriz LED. El bloque
//  "start FisicaBit BT" limpia la pantalla inmediatamente y
//  muestra el ícono de "listo para conectar" en su lugar.
// =============================================================================


// =============================================================================
// NAMESPACE — "FisicaBit BT" aparecerá como categoría separada en la toolbox
// =============================================================================
//% weight=90
//% color=#0082FB
//% icon="\uf294"
//% block="FisicaBit BT"
//% groups="['Sampling', 'Connection', 'Manual Send', 'BLE Services']"
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
            bluetooth.setTransmitPower(7)
            _tiempoInicio = input.runningTime()
            _uartIniciado = true
            // Limpiar las "barritas" que CODAL muestra al arrancar BLE
            basic.clearScreen()
        }
    }

    // =========================================================================
    // GRUPO 0: INICIO RÁPIDO — Conexión inmediata a fisicabit.com
    // =========================================================================

    /**
     * Inicia Bluetooth UART listo para fisicabit.com.
     * Colocar en "al iniciar" como PRIMER bloque.
     *
     * Qué hace:
     *   1. Inicia el servicio UART BLE (requerido por fisicabit.com)
     *   2. Sube la potencia de transmisión al máximo (alcance ~20m)
     *   3. Limpia las barras del patrón Bluetooth de la pantalla
     *   4. Muestra diana (◎) = listo, corazón (♥) = conectado
     */
    //% block="start FisicaBit BT"
    //% blockId=fisicabit_bt_inicio_rapido
    //% group="Connection"
    //% weight=110
    export function inicioRapido(): void {
        _asegurarUART()
        // Indicador visual: corazón al conectar, diana al desconectar
        bluetooth.onBluetoothConnected(function () {
            basic.showIcon(IconNames.Heart)
        })
        bluetooth.onBluetoothDisconnected(function () {
            basic.showIcon(IconNames.Target)
        })
        // Mostrar que está listo para conectar (reemplaza las barras BLE)
        basic.showIcon(IconNames.Target)
    }

    /**
     * Inicia Bluetooth con UART + todos los servicios BLE nativos
     * que fisicabit.com puede leer directamente (acelerómetro,
     * temperatura, magnetómetro, botones, LED, pines I/O).
     *
     * Usar este bloque si querés que fisicabit.com pueda leer
     * los sensores internos del micro:bit directamente por BLE
     * además de recibir datos por UART.
     */
    //% block="start FisicaBit BT with all services"
    //% blockId=fisicabit_bt_inicio_completo
    //% group="Connection"
    //% weight=109
    export function inicioCompleto(): void {
        _asegurarUART()
        bluetooth.startAccelerometerService()
        bluetooth.startTemperatureService()
        bluetooth.startMagnetometerService()
        bluetooth.startButtonService()
        bluetooth.startLEDService()
        bluetooth.startIOPinService()
        // Indicador visual
        bluetooth.onBluetoothConnected(function () {
            basic.showIcon(IconNames.Heart)
        })
        bluetooth.onBluetoothDisconnected(function () {
            basic.showIcon(IconNames.Target)
        })
        basic.showIcon(IconNames.Target)
    }

    // =========================================================================
    // GRUPO 1: MUESTREO — Bloques principales
    // =========================================================================

    /**
     * Tiempo en milisegundos desde que se inició el Bluetooth.
     * Siempre comienza en 0. Arrastrá este bloque a un slot de muestreo
     * para incluir el tiempo en los datos enviados.
     */
    //% block="time (ms)"
    //% blockId=fisicabit_bt_tiempo
    //% group="Sampling"
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
    //% block="BT sample %valor|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Sampling"
    //% weight=100
    //% ms.min=10 ms.max=60000 ms.defl=100
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
    //% block="BT sample %valor1 and %valor2|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Sampling"
    //% weight=95
    //% ms.min=10 ms.max=60000 ms.defl=100
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
    //% block="BT sample %valor1 , %valor2 and %valor3|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_3
    //% group="Sampling"
    //% weight=90
    //% ms.min=10 ms.max=60000 ms.defl=100
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
    //% block="start Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Connection"
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
    //% block="setup BT connection indicator"
    //% blockId=fisicabit_bt_indicador
    //% group="Connection"
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
    //% block="BT send text %texto"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Manual Send"
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
    //% block="start BLE accelerometer service"
    //% blockId=fisicabit_bt_srv_accel
    //% group="BLE Services"
    //% weight=50
    //% advanced=true
    export function iniciarServicioAcelerometro(): void {
        bluetooth.startAccelerometerService()
    }

    /**
     * Inicia el servicio BLE de temperatura.
     */
    //% block="start BLE temperature service"
    //% blockId=fisicabit_bt_srv_temp
    //% group="BLE Services"
    //% weight=48
    //% advanced=true
    export function iniciarServicioTemperatura(): void {
        bluetooth.startTemperatureService()
    }

    /**
     * Inicia el servicio BLE de magnetómetro (brújula).
     */
    //% block="start BLE magnetometer service"
    //% blockId=fisicabit_bt_srv_mag
    //% group="BLE Services"
    //% weight=46
    //% advanced=true
    export function iniciarServicioMagnetometro(): void {
        bluetooth.startMagnetometerService()
    }

    /**
     * Inicia el servicio BLE de botones.
     */
    //% block="start BLE button service"
    //% blockId=fisicabit_bt_srv_btn
    //% group="BLE Services"
    //% weight=44
    //% advanced=true
    export function iniciarServicioBotones(): void {
        bluetooth.startButtonService()
    }

    /**
     * Inicia el servicio BLE de pantalla LED.
     */
    //% block="start BLE LED service"
    //% blockId=fisicabit_bt_srv_led
    //% group="BLE Services"
    //% weight=42
    //% advanced=true
    export function iniciarServicioLED(): void {
        bluetooth.startLEDService()
    }

    /**
     * Inicia el servicio BLE de pines I/O.
     */
    //% block="start BLE I/O pin service"
    //% blockId=fisicabit_bt_srv_io
    //% group="BLE Services"
    //% weight=40
    //% advanced=true
    export function iniciarServicioIO(): void {
        bluetooth.startIOPinService()
    }
}
