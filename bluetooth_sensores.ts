// =============================================================================
//  bluetooth_sensores.ts — "FisicaBit Bluetooth": datos a fisicabit.com por BLE
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para conectar el micro:bit a fisicabit.com de forma
//               inalámbrica (Bluetooth Low Energy, servicio UART Nordic) y
//               enviar datos de sensores con un solo bloque.
//
//  USO TÍPICO EN BLOQUES:
//    al iniciar:
//      [iniciar Bluetooth para fisicabit.com]        ← PRIMER bloque
//      [configurar frecuencia de muestreo (10 Hz)]
//    por siempre:
//      [enviar a fisicabit.com por Bluetooth (aceleración x)]
//
//  PROTOCOLO DE CONEXIÓN CON fisicabit.com (Web Bluetooth):
//  ─────────────────────────────────────────────────────────
//    1. Busca un dispositivo llamado "BBC micro:bit [XXXXX]"
//    2. Usa el servicio UART Nordic (6e400001-b5a3-f393-e0a9-e50e24dcca9e)
//       • micro:bit → página: característica TX con INDICATE, 20 bytes máx.
//         por paquete (cada paquete espera confirmación de la página)
//    3. Recibe líneas CSV "tiempo,valor1,valor2\n" (o "valor1,valor2\n")
//
//  POR QUÉ ESTOS BLOQUES CONECTAN "SIN PROBLEMAS":
//  ────────────────────────────────────────────────
//    • Sólo se inicia el servicio UART (menos servicios = descubrimiento
//      rápido; en Windows cada servicio extra demora segundos y puede vencer
//      el timeout de supervisión de 4 s del firmware).
//    • Potencia de transmisión al máximo (7) → mejor alcance y menos cortes.
//    • Líneas cortas (tiempo desde 0, pocos decimales) → 1 paquete BLE por
//      muestra, sin fragmentación.
//    • Sólo se transmite cuando hay una página conectada; el muestreo sigue
//      su ritmo y al reconectar los datos vuelven solos.
//    • El tiempo arranca en 0 en cada conexión.
//    • Muestreo con temporización por deadline: si BLE se atrasa, se
//      resincroniza en vez de acumular una ráfaga de muestras viejas.
//
//  CONFIGURACIÓN REQUERIDA (pxt.json, ya incluida en esta extensión):
//    "yotta": { "config": { "microbit-dal": { "bluetooth":
//        { "open": 1, "pairing_mode": 0, "whitelist": 0 } } } }
//    → Conexión abierta, sin vinculación ("No Pairing Required").
//    (La clave "bluetooth" de nivel superior NO la lee el compilador;
//     se verificó en built/codal.json: OPEN=1, PAIRING_MODE=0, WHITELIST=0.)
//
//  LIMITACIONES CONOCIDAS:
//    • Bluetooth y Radio no pueden usarse en el mismo programa.
//    • iOS/iPadOS no soporta Web Bluetooth (usar Android, Windows, macOS,
//      Linux o ChromeOS con Chrome/Edge).
//    • Velocidad práctica por BLE: hasta ~20 Hz. Para 50-100 Hz usar USB.
// =============================================================================

//% weight=98
//% color=#0082FB
//% icon=""
//% block="FisicaBit Bluetooth"
//% groups='["fisicabit.com", "Conexión", "Muestreo", "Avanzado", "Servicios BLE"]'
namespace FisicaBitBT {

    let _m: FisicaBitDatos.Muestreador = null
    let _uartIniciado = false
    let _conectado = false
    let _mostrarIconos = true

    function _asegurarUART(): FisicaBitDatos.Muestreador {
        if (!_m) _m = new FisicaBitDatos.Muestreador()
        if (!_uartIniciado) {
            _uartIniciado = true
            bluetooth.startUartService()
            bluetooth.setTransmitPower(7)
            bluetooth.onBluetoothConnected(function () {
                _conectado = true
                // El tiempo arranca en 0 para cada sesión de fisicabit.com
                _m.reiniciarTiempo()
                if (_mostrarIconos) basic.showIcon(IconNames.Heart)
            })
            bluetooth.onBluetoothDisconnected(function () {
                _conectado = false
                if (_mostrarIconos) basic.showIcon(IconNames.Target)
            })
            _m.reiniciarTiempo()
            // Limpiar las "barritas" que CODAL muestra al arrancar BLE
            basic.clearScreen()
        }
        return _m
    }

    function _enviar(valores: number[]): void {
        const m = _asegurarUART()
        if (_conectado) {
            // "\n" en lugar de "\r\n": un byte menos por paquete BLE
            bluetooth.uartWriteString(m.linea(valores) + "\n")
        }
        m.esperar()
    }

    // =========================================================================
    // GRUPO 1: fisicabit.com — inicio y un solo bloque de envío
    // =========================================================================

    /**
     * Inicia Bluetooth listo para conectarse a fisicabit.com.
     * Colocar en "al iniciar" como PRIMER bloque.
     *
     * Qué hace:
     *   1. Inicia el servicio UART BLE (el que usa fisicabit.com)
     *   2. Potencia de transmisión al máximo (alcance ~20 m)
     *   3. Limpia las barras del patrón Bluetooth de la pantalla
     *   4. Muestra diana (◎) = esperando conexión, corazón (♥) = conectado
     */
    //% block="iniciar Bluetooth para fisicabit.com"
    //% blockId=fisicabit_bt_inicio_rapido
    //% group="fisicabit.com"
    //% weight=110
    export function inicioRapido(): void {
        _asegurarUART()
        _mostrarIconos = true
        basic.showIcon(IconNames.Target)
    }

    /**
     * Envía UN valor a fisicabit.com por Bluetooth y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía la línea: tiempo,valor
     * Sólo transmite cuando fisicabit.com está conectado.
     * @param valor Valor a enviar (sensor, variable o cálculo)
     */
    //% block="enviar a fisicabit.com por Bluetooth %valor"
    //% blockId=fisicabit_bt_enviar_1
    //% group="fisicabit.com"
    //% weight=100
    //% inlineInputMode=inline
    export function enviar1(valor: number): void {
        _enviar([valor])
    }

    /**
     * Envía DOS valores a fisicabit.com por Bluetooth y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     */
    //% block="enviar a fisicabit.com por Bluetooth %valor1 y %valor2"
    //% blockId=fisicabit_bt_enviar_2
    //% group="fisicabit.com"
    //% weight=95
    //% inlineInputMode=inline
    export function enviar2(valor1: number, valor2: number): void {
        _enviar([valor1, valor2])
    }

    /**
     * Envía TRES valores a fisicabit.com por Bluetooth y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2,valor3
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     */
    //% block="enviar a fisicabit.com por Bluetooth %valor1 , %valor2 y %valor3"
    //% blockId=fisicabit_bt_enviar_3
    //% group="fisicabit.com"
    //% weight=90
    //% inlineInputMode=inline
    export function enviar3(valor1: number, valor2: number, valor3: number): void {
        _enviar([valor1, valor2, valor3])
    }

    /**
     * Envía CUATRO valores a fisicabit.com por Bluetooth y espera el tiempo de muestreo.
     * Colocar dentro de "para siempre". Envía: tiempo,valor1,valor2,valor3,valor4
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     * @param valor4 Cuarto valor
     */
    //% block="enviar a fisicabit.com por Bluetooth %valor1 , %valor2 , %valor3 y %valor4"
    //% blockId=fisicabit_bt_enviar_4
    //% group="fisicabit.com"
    //% weight=85
    //% inlineInputMode=inline
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number): void {
        _enviar([valor1, valor2, valor3, valor4])
    }

    /**
     * Configura cuántas muestras por segundo se envían por Bluetooth.
     * Colocar en "al iniciar". Por defecto: 10 Hz. Por BLE se recomienda
     * hasta 20 Hz; para más velocidad usar USB.
     * @param frecuencia Frecuencia de muestreo
     */
    //% block="configurar frecuencia de muestreo Bluetooth %frecuencia"
    //% blockId=fisicabit_bt_frecuencia
    //% group="fisicabit.com"
    //% weight=80
    //% frecuencia.defl=FrecuenciaMuestreo.Hz10
    export function fijarFrecuencia(frecuencia: FrecuenciaMuestreo): void {
        _asegurarUART().fijarPeriodo(frecuencia)
    }

    // =========================================================================
    // GRUPO 2: CONEXIÓN
    // =========================================================================

    /**
     * Verdadero mientras fisicabit.com (u otra app) está conectada por Bluetooth.
     */
    //% block="¿Bluetooth conectado?"
    //% blockId=fisicabit_bt_conectado
    //% group="Conexión"
    //% weight=75
    export function estaConectado(): boolean {
        _asegurarUART()
        return _conectado
    }

    /**
     * Ejecuta el código cuando fisicabit.com se conecta por Bluetooth.
     * @param cuerpo Código a ejecutar al conectar
     */
    //% block="al conectar fisicabit.com por Bluetooth"
    //% blockId=fisicabit_bt_al_conectar
    //% group="Conexión"
    //% weight=72
    export function alConectar(cuerpo: () => void): void {
        _asegurarUART()
        bluetooth.onBluetoothConnected(cuerpo)
    }

    /**
     * Ejecuta el código cuando fisicabit.com se desconecta del Bluetooth.
     * @param cuerpo Código a ejecutar al desconectar
     */
    //% block="al desconectar fisicabit.com del Bluetooth"
    //% blockId=fisicabit_bt_al_desconectar
    //% group="Conexión"
    //% weight=71
    export function alDesconectar(cuerpo: () => void): void {
        _asegurarUART()
        bluetooth.onBluetoothDisconnected(cuerpo)
    }

    /**
     * Activa o desactiva los íconos de estado en la pantalla LED
     * (diana = esperando, corazón = conectado). Útil si querés usar
     * la pantalla para otra cosa.
     * @param mostrar true = mostrar íconos (por defecto)
     */
    //% block="Bluetooth mostrar íconos de conexión %mostrar"
    //% blockId=fisicabit_bt_iconos
    //% group="Conexión"
    //% weight=70
    //% mostrar.shadow=toggleOnOff
    //% mostrar.defl=true
    export function mostrarIconos(mostrar: boolean): void {
        _mostrarIconos = mostrar
        if (!mostrar) basic.clearScreen()
    }

    // =========================================================================
    // GRUPO 3: MUESTREO — control fino del tiempo
    // =========================================================================

    /**
     * Configura el intervalo entre muestras en milisegundos (valor libre).
     * @param ms Intervalo de muestreo en ms (5 a 60000)
     */
    //% block="configurar intervalo de muestreo Bluetooth %ms ms"
    //% blockId=fisicabit_bt_intervalo
    //% group="Muestreo"
    //% weight=65
    //% ms.min=5 ms.max=60000 ms.defl=100
    export function fijarIntervalo(ms: number): void {
        _asegurarUART().fijarPeriodo(ms)
    }

    /**
     * Ejecuta el código interior a la frecuencia indicada con temporización
     * precisa (sin el retardo oculto de "para siempre").
     * Adentro usar "enviar a fisicabit.com por Bluetooth".
     * @param frecuencia Frecuencia de muestreo
     * @param cuerpo Código a ejecutar en cada muestra
     */
    //% block="muestrear para fisicabit.com por Bluetooth a %frecuencia"
    //% blockId=fisicabit_bt_bucle
    //% group="Muestreo"
    //% weight=60
    //% frecuencia.defl=FrecuenciaMuestreo.Hz20
    //% blockAllowMultiple=0
    export function bucleMuestreo(frecuencia: FrecuenciaMuestreo, cuerpo: () => void): void {
        const m = _asegurarUART()
        m.fijarPeriodo(frecuencia)
        m.bucle(cuerpo)
    }

    /**
     * Tiempo en milisegundos desde la última conexión Bluetooth (arranca en 0).
     * Es el mismo tiempo que viaja en cada línea enviada.
     */
    //% block="tiempo Bluetooth (ms)"
    //% blockId=fisicabit_bt_tiempo
    //% group="Muestreo"
    //% weight=55
    export function tiempo(): number {
        return _asegurarUART().tiempo()
    }

    /**
     * Vuelve el tiempo a 0 (por ejemplo al apretar un botón para empezar
     * una nueva medición).
     */
    //% block="reiniciar tiempo Bluetooth a 0"
    //% blockId=fisicabit_bt_reiniciar_tiempo
    //% group="Muestreo"
    //% weight=50
    export function reiniciarTiempo(): void {
        _asegurarUART().reiniciarTiempo()
    }

    // =========================================================================
    // GRUPO 4: AVANZADO
    // =========================================================================

    /**
     * Activa o desactiva el envío del tiempo del micro:bit como primera
     * columna. Debe coincidir con la opción "Micro:bit envía timestamp"
     * de fisicabit.com (activada por defecto).
     * @param activar true = enviar tiempo (por defecto), false = sólo valores
     */
    //% block="Bluetooth enviar tiempo del micro:bit %activar"
    //% blockId=fisicabit_bt_timestamp
    //% group="Avanzado"
    //% weight=45
    //% activar.shadow=toggleOnOff
    //% activar.defl=true
    //% advanced=true
    export function enviarTimestamp(activar: boolean): void {
        _asegurarUART().enviarTiempo = activar
    }

    /**
     * Cantidad de decimales con que se envían los valores no enteros.
     * Menos decimales = líneas más cortas = Bluetooth más fluido.
     * @param decimales Decimales (0 a 6). Por defecto 2.
     */
    //% block="Bluetooth fijar decimales %decimales"
    //% blockId=fisicabit_bt_decimales
    //% group="Avanzado"
    //% weight=44
    //% decimales.min=0 decimales.max=6 decimales.defl=2
    //% advanced=true
    export function fijarDecimales(decimales: number): void {
        _asegurarUART().decimales = Math.round(decimales)
    }

    /**
     * Envía una línea de texto libre por Bluetooth (sin tiempo ni espera).
     * @param texto Texto a enviar
     */
    //% block="Bluetooth enviar texto %texto"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Avanzado"
    //% weight=43
    //% advanced=true
    export function enviarTexto(texto: string): void {
        _asegurarUART()
        if (_conectado) bluetooth.uartWriteLine(texto)
    }

    /**
     * Inicia Bluetooth con UART + todos los servicios BLE nativos
     * (acelerómetro, temperatura, magnetómetro, botones, LED, pines).
     * fisicabit.com puede leerlos directamente, pero cada servicio extra
     * hace más lenta la conexión (sobre todo en Windows). Usar sólo si
     * hace falta.
     */
    //% block="iniciar Bluetooth para fisicabit.com con todos los servicios BLE"
    //% blockId=fisicabit_bt_inicio_completo
    //% group="Avanzado"
    //% weight=42
    //% advanced=true
    export function inicioCompleto(): void {
        _asegurarUART()
        bluetooth.startAccelerometerService()
        bluetooth.startTemperatureService()
        bluetooth.startMagnetometerService()
        bluetooth.startButtonService()
        bluetooth.startLEDService()
        bluetooth.startIOPinService()
        _mostrarIconos = true
        basic.showIcon(IconNames.Target)
    }

    // =========================================================================
    // GRUPO 5: SERVICIOS BLE INDIVIDUALES (avanzado)
    // =========================================================================

    /**
     * Inicia el servicio BLE de acelerómetro.
     */
    //% block="iniciar servicio BLE acelerómetro"
    //% blockId=fisicabit_bt_srv_accel
    //% group="Servicios BLE"
    //% weight=30
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
    //% weight=28
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
    //% weight=26
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
    //% weight=24
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
    //% weight=22
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
    //% weight=20
    //% advanced=true
    export function iniciarServicioIO(): void {
        bluetooth.startIOPinService()
    }

    // =========================================================================
    // BLOQUES ANTERIORES (obsoletos) — se mantienen para que los proyectos
    // viejos sigan compilando. No aparecen en la caja de herramientas.
    // =========================================================================

    /**
     * (Obsoleto) Usar "iniciar Bluetooth para fisicabit.com".
     */
    //% block="iniciar Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Avanzado"
    //% weight=10
    //% deprecated=true
    export function iniciarUART(): void {
        _asegurarUART()
        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * (Obsoleto) "iniciar Bluetooth para fisicabit.com" ya muestra los íconos.
     */
    //% block="configurar indicador de conexión BT"
    //% blockId=fisicabit_bt_indicador
    //% group="Avanzado"
    //% weight=9
    //% deprecated=true
    export function configurarIndicadorConexion(): void {
        _asegurarUART()
        _mostrarIconos = true
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com por Bluetooth" + "configurar frecuencia".
     */
    //% block="BT muestrear %valor|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Avanzado"
    //% weight=8
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function muestrear1(valor: number, ms: number): void {
        _asegurarUART()
        if (_conectado) bluetooth.uartWriteLine("" + valor)
        basic.pause(ms)
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com por Bluetooth" + "configurar frecuencia".
     */
    //% block="BT muestrear %valor1 y %valor2|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Avanzado"
    //% weight=7
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function muestrear2(valor1: number, valor2: number, ms: number): void {
        _asegurarUART()
        if (_conectado) bluetooth.uartWriteLine("" + valor1 + "," + valor2)
        basic.pause(ms)
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com por Bluetooth" + "configurar frecuencia".
     */
    //% block="BT muestrear %valor1 , %valor2 y %valor3|cada %ms ms"
    //% blockId=fisicabit_bt_muestrear_3
    //% group="Avanzado"
    //% weight=6
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function muestrear3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _asegurarUART()
        if (_conectado) bluetooth.uartWriteLine("" + valor1 + "," + valor2 + "," + valor3)
        basic.pause(ms)
    }
}
