// =============================================================================
//  bluetooth_sensores.ts — "FisicaBit Bluetooth": datos a fisicabit.com por BLE
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para conectar el micro:bit a fisicabit.com de forma
//               inalámbrica (Bluetooth Low Energy, servicio UART Nordic) y
//               enviar datos de sensores con un solo bloque.
//
//  SECUENCIA MÍNIMA (dos bloques):
//    al iniciar:
//      [iniciar Bluetooth para fisicabit.com]        ← PRIMER bloque
//    por siempre:
//      [enviar a fisicabit.com por Bluetooth tiempo y (aceleración x) cada (100) ms]
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
//% icon="\uf294"
//% block="FisicaBit Bluetooth"
//% groups='["1. Start (in on start)", "2. Send (inside forever)", "Send without time", "3. Optional", "Advanced", "BLE Services"]'
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

    function _enviar(valores: number[], ms: number): void {
        const m = _asegurarUART()
        m.fijarPeriodo(ms)
        if (_conectado) {
            // "\n" en lugar de "\r\n": un byte menos por paquete BLE
            bluetooth.uartWriteString(m.linea(valores) + "\n")
        }
        m.esperar()
    }

    function _enviarSinTiempo(valores: number[], ms: number): void {
        const m = _asegurarUART()
        m.fijarPeriodo(ms)
        if (_conectado) {
            bluetooth.uartWriteString(m.linea(valores, false) + "\n")
        }
        m.esperar()
    }

    // =========================================================================
    // PASO 1: INICIAR — primer bloque de "al iniciar"
    // =========================================================================

    /**
     * Inicia Bluetooth listo para conectarse a fisicabit.com.
     * Colocar en "al iniciar" como PRIMER bloque.
     *
     * Qué hace: enciende el servicio UART que busca fisicabit.com, sube la
     * potencia de transmisión al máximo y muestra en la pantalla una diana (◎)
     * mientras espera y un corazón (♥) cuando la página se conecta.
     *
     * Ejemplo: [al iniciar] → [iniciar Bluetooth para fisicabit.com]
     * Luego en fisicabit.com: Bluetooth → Conectar → "BBC micro:bit [xxxxx]".
     */
    //% block="start Bluetooth for fisicabit.com"
    //% blockId=fisicabit_bt_inicio_rapido
    //% group="1. Start (in on start)"
    //% weight=110
    export function inicioRapido(): void {
        _asegurarUART()
        _mostrarIconos = true
        basic.showIcon(IconNames.Target)
    }

    // =========================================================================
    // PASO 2: ENVIAR — un solo bloque dentro de "para siempre"
    // =========================================================================

    /**
     * Envía a fisicabit.com por Bluetooth el tiempo (ms) y un valor medido,
     * y espera hasta la próxima muestra. Colocar dentro de "para siempre".
     * Sólo transmite mientras la página está conectada. Línea: tiempo,valor
     *
     * Ejemplo: [enviar a fisicabit.com por Bluetooth tiempo y (aceleración x) cada (100) ms]
     *   → 10 muestras por segundo, tiempo desde 0 en cada conexión.
     * En fisicabit.com: Bluetooth, 1 variable, "Micro:bit envía timestamp" activado.
     * Por Bluetooth se recomienda 50 ms o más (hasta 20 muestras por segundo).
     *
     * @param valor Valor medido (sensor, variable o cálculo)
     * @param ms Tiempo entre muestras en ms (100 = 10 por segundo), eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time and %valor every %ms ms"
    //% blockId=fisicabit_bt_enviar_1
    //% group="2. Send (inside forever)"
    //% weight=100
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar1(valor: number, ms: number): void {
        _enviar([valor], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth el tiempo (ms) y dos valores
     * medidos, y espera hasta la próxima muestra. Colocar dentro de
     * "para siempre". Línea: tiempo,valor1,valor2
     *
     * Ejemplo: aceleración x e y cada 100 ms.
     * En fisicabit.com: Bluetooth, 2 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %valor1 and %valor2 every %ms ms"
    //% blockId=fisicabit_bt_enviar_2
    //% group="2. Send (inside forever)"
    //% weight=95
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar2(valor1: number, valor2: number, ms: number): void {
        _enviar([valor1, valor2], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth el tiempo (ms) y tres valores
     * medidos, y espera hasta la próxima muestra. Colocar dentro de
     * "para siempre". Línea: tiempo,valor1,valor2,valor3
     *
     * Ejemplo: aceleración x, y, z cada 100 ms.
     * En fisicabit.com: Bluetooth, 3 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %valor1 , %valor2 and %valor3 every %ms ms"
    //% blockId=fisicabit_bt_enviar_3
    //% group="2. Send (inside forever)"
    //% weight=90
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _enviar([valor1, valor2, valor3], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth el tiempo (ms) y cuatro valores
     * medidos, y espera hasta la próxima muestra. Colocar dentro de
     * "para siempre". Línea: tiempo,valor1,valor2,valor3,valor4
     *
     * En fisicabit.com: Bluetooth, 4 variables, "Micro:bit envía timestamp" activado.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param valor4 Cuarto valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %valor1 , %valor2 , %valor3 and %valor4 every %ms ms"
    //% blockId=fisicabit_bt_enviar_4
    //% group="2. Send (inside forever)"
    //% weight=85
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number, ms: number): void {
        _enviar([valor1, valor2, valor3, valor4], ms)
    }

    // =========================================================================
    // ENVÍO DE DATOS SIN TIEMPO — sólo los valores medidos
    // =========================================================================

    /**
     * Envía a fisicabit.com por Bluetooth SOLO un valor medido, sin el
     * tiempo del micro:bit, y espera hasta la próxima muestra. Colocar dentro
     * de "para siempre". Línea enviada: valor
     * La página pone el tiempo con el reloj del navegador.
     *
     * Ejemplo: [enviar a fisicabit.com sin tiempo (nivel de luz) cada (500) ms]
     * En fisicabit.com: Bluetooth, 1 variable, "Micro:bit envía timestamp" DESACTIVADO.
     *
     * @param valor Valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth without time %valor every %ms ms"
    //% blockId=fisicabit_bt_enviar_st_1
    //% group="Send without time"
    //% weight=83
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarSinTiempo1(valor: number, ms: number): void {
        _enviarSinTiempo([valor], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth SOLO dos valores medidos, sin el
     * tiempo del micro:bit, y espera hasta la próxima muestra. Colocar dentro
     * de "para siempre". Línea enviada: valor1,valor2
     * La página pone el tiempo con el reloj del navegador.
     *
     * Ejemplo: temperatura y nivel de luz cada 1000 ms
     * En fisicabit.com: Bluetooth, 2 variables, "Micro:bit envía timestamp" DESACTIVADO.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth without time %valor1 and %valor2 every %ms ms"
    //% blockId=fisicabit_bt_enviar_st_2
    //% group="Send without time"
    //% weight=82
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarSinTiempo2(valor1: number, valor2: number, ms: number): void {
        _enviarSinTiempo([valor1, valor2], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth SOLO tres valores medidos, sin el
     * tiempo del micro:bit, y espera hasta la próxima muestra. Colocar dentro
     * de "para siempre". Línea enviada: valor1,valor2,valor3
     * La página pone el tiempo con el reloj del navegador.
     *
     * Ejemplo: aceleración x, y, z cada 100 ms
     * En fisicabit.com: Bluetooth, 3 variables, "Micro:bit envía timestamp" DESACTIVADO.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth without time %valor1 , %valor2 and %valor3 every %ms ms"
    //% blockId=fisicabit_bt_enviar_st_3
    //% group="Send without time"
    //% weight=81
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarSinTiempo3(valor1: number, valor2: number, valor3: number, ms: number): void {
        _enviarSinTiempo([valor1, valor2, valor3], ms)
    }

    /**
     * Envía a fisicabit.com por Bluetooth SOLO cuatro valores medidos, sin el
     * tiempo del micro:bit, y espera hasta la próxima muestra. Colocar dentro
     * de "para siempre". Línea enviada: valor1,valor2,valor3,valor4
     * La página pone el tiempo con el reloj del navegador.
     *
     * Ejemplo: cuatro sensores cada 200 ms
     * En fisicabit.com: Bluetooth, 4 variables, "Micro:bit envía timestamp" DESACTIVADO.
     *
     * @param valor1 Primer valor medido
     * @param valor2 Segundo valor medido
     * @param valor3 Tercer valor medido
     * @param valor4 Cuarto valor medido
     * @param ms Tiempo entre muestras en ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth without time %valor1 , %valor2 , %valor3 and %valor4 every %ms ms"
    //% blockId=fisicabit_bt_enviar_st_4
    //% group="Send without time"
    //% weight=80
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarSinTiempo4(valor1: number, valor2: number, valor3: number, valor4: number, ms: number): void {
        _enviarSinTiempo([valor1, valor2, valor3, valor4], ms)
    }

    // =========================================================================
    // PASO 3: OPCIONAL — estado de la conexión y control del tiempo
    // =========================================================================

    /**
     * Verdadero mientras fisicabit.com está conectado por Bluetooth.
     *
     * Ejemplo: [si (¿Bluetooth conectado?) entonces] → [mostrar ícono ♥]
     */
    //% block="Bluetooth connected?"
    //% blockId=fisicabit_bt_conectado
    //% group="3. Optional"
    //% weight=80
    export function estaConectado(): boolean {
        _asegurarUART()
        return _conectado
    }

    /**
     * Ejecuta el código cuando fisicabit.com se conecta por Bluetooth.
     *
     * Ejemplo: [al conectar fisicabit.com por Bluetooth] → [reproducir tono Do]
     * @param cuerpo Código a ejecutar al conectar
     */
    //% block="on fisicabit.com Bluetooth connected"
    //% blockId=fisicabit_bt_al_conectar
    //% group="3. Optional"
    //% weight=78
    export function alConectar(cuerpo: () => void): void {
        _asegurarUART()
        bluetooth.onBluetoothConnected(cuerpo)
    }

    /**
     * Ejecuta el código cuando fisicabit.com se desconecta del Bluetooth.
     * @param cuerpo Código a ejecutar al desconectar
     */
    //% block="on fisicabit.com Bluetooth disconnected"
    //% blockId=fisicabit_bt_al_desconectar
    //% group="3. Optional"
    //% weight=77
    export function alDesconectar(cuerpo: () => void): void {
        _asegurarUART()
        bluetooth.onBluetoothDisconnected(cuerpo)
    }

    /**
     * Vuelve el tiempo a 0. Útil para empezar una nueva medición al apretar
     * un botón: la próxima línea enviada arranca en tiempo 0.
     *
     * Ejemplo: [al presionar botón A] → [reiniciar tiempo Bluetooth a 0]
     */
    //% block="reset Bluetooth time to 0"
    //% blockId=fisicabit_bt_reiniciar_tiempo
    //% group="3. Optional"
    //% weight=75
    export function reiniciarTiempo(): void {
        _asegurarUART().reiniciarTiempo()
    }

    /**
     * Tiempo en milisegundos desde la última conexión Bluetooth (arranca en 0).
     * Es el mismo tiempo que viaja en cada línea enviada.
     */
    //% block="Bluetooth time (ms)"
    //% blockId=fisicabit_bt_tiempo
    //% group="3. Optional"
    //% weight=70
    export function tiempo(): number {
        return _asegurarUART().tiempo()
    }

    /**
     * Bucle rápido para fisicabit.com por Bluetooth: ejecuta el código
     * interior cada X ms con temporización precisa, sin el retardo oculto de
     * "para siempre". Adentro va el bloque "enviar a fisicabit.com por
     * Bluetooth"; su tiempo "cada ... ms" se ignora dentro del bucle.
     * Por Bluetooth conviene 50 ms o más.
     *
     * @param ms Tiempo entre muestras en ms, eg: 50
     * @param cuerpo Código a ejecutar en cada muestra
     */
    //% block="fisicabit.com Bluetooth fast loop every %ms ms"
    //% blockId=fisicabit_bt_bucle
    //% group="3. Optional"
    //% weight=65
    //% ms.min=5 ms.max=60000 ms.defl=50
    //% blockAllowMultiple=0
    export function bucleMuestreo(ms: number, cuerpo: () => void): void {
        const m = _asegurarUART()
        m.fijarPeriodo(ms)
        m.bucle(cuerpo)
    }

    /**
     * Activa o desactiva los íconos de estado en la pantalla LED
     * (diana = esperando, corazón = conectado). Desactivalos si querés usar
     * la pantalla para otra cosa.
     * @param mostrar true = mostrar íconos (por defecto)
     */
    //% block="Bluetooth show connection icons %mostrar"
    //% blockId=fisicabit_bt_iconos
    //% group="3. Optional"
    //% weight=60
    //% mostrar.shadow=toggleOnOff
    //% mostrar.defl=true
    export function mostrarIconos(mostrar: boolean): void {
        _mostrarIconos = mostrar
        if (!mostrar) basic.clearScreen()
    }

    // =========================================================================
    // AVANZADO
    // =========================================================================

    /**
     * Activa o desactiva el envío del tiempo del micro:bit como primera
     * columna. Debe coincidir con la opción "Micro:bit envía timestamp"
     * de fisicabit.com (activada por defecto).
     * @param activar true = enviar tiempo (por defecto), false = sólo valores
     */
    //% block="Bluetooth send micro:bit timestamp %activar"
    //% blockId=fisicabit_bt_timestamp
    //% group="Advanced"
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
    //% block="Bluetooth set decimals %decimales"
    //% blockId=fisicabit_bt_decimales
    //% group="Advanced"
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
    //% block="Bluetooth send text %texto"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Advanced"
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
    //% block="start Bluetooth for fisicabit.com with all BLE services"
    //% blockId=fisicabit_bt_inicio_completo
    //% group="Advanced"
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

    /**
     * Fija el intervalo entre muestras que usarán los bloques de envío que
     * no lo indiquen. Normalmente no hace falta: el bloque "enviar" ya trae
     * su propio "cada ... ms".
     * @param frecuencia Frecuencia de muestreo
     */
    //% block="set Bluetooth sampling rate %frecuencia"
    //% blockId=fisicabit_bt_frecuencia
    //% group="Advanced"
    //% weight=30
    //% frecuencia.defl=FrecuenciaMuestreo.Hz10
    //% advanced=true
    export function fijarFrecuencia(frecuencia: FrecuenciaMuestreo): void {
        _asegurarUART().fijarPeriodo(frecuencia)
    }

    /**
     * Fija el intervalo entre muestras en milisegundos (valor libre).
     * Normalmente no hace falta: el bloque "enviar" ya trae su propio "cada ... ms".
     * @param ms Intervalo de muestreo en ms (5 a 60000)
     */
    //% block="set Bluetooth sampling interval %ms ms"
    //% blockId=fisicabit_bt_intervalo
    //% group="Advanced"
    //% weight=29
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% advanced=true
    export function fijarIntervalo(ms: number): void {
        _asegurarUART().fijarPeriodo(ms)
    }

    // =========================================================================
    // GRUPO 5: SERVICIOS BLE INDIVIDUALES (avanzado)
    // =========================================================================

    /**
     * Inicia el servicio BLE de acelerómetro.
     */
    //% block="start BLE accelerometer service"
    //% blockId=fisicabit_bt_srv_accel
    //% group="BLE Services"
    //% weight=30
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
    //% weight=28
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
    //% weight=26
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
    //% weight=24
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
    //% weight=22
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
    //% block="start Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Advanced"
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
    //% block="setup BT connection indicator"
    //% blockId=fisicabit_bt_indicador
    //% group="Advanced"
    //% weight=9
    //% deprecated=true
    export function configurarIndicadorConexion(): void {
        _asegurarUART()
        _mostrarIconos = true
    }

    /**
     * (Obsoleto) Usar "enviar a fisicabit.com por Bluetooth" + "configurar frecuencia".
     */
    //% block="BT sample %valor|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Advanced"
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
    //% block="BT sample %valor1 and %valor2|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Advanced"
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
    //% block="BT sample %valor1 , %valor2 and %valor3|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_3
    //% group="Advanced"
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
