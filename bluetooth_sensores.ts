// =============================================================================
//  bluetooth_sensores.ts — Envío de datos por Bluetooth (UART BLE)
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Bloques para enviar datos de sensores desde la micro:bit
//               a fisicasimple.com vía Bluetooth Low Energy (BLE UART).
//
//  IMPORTANTE — CONFIGURACIÓN PREVIA:
//  ───────────────────────────────────
//  1. En MakeCode: ⚙ → Project Settings → activar "No Pairing Required: JustWorks"
//  2. En pxt.json, sección "bluetooth":
//     {
//         "open": 1,
//         "pairing_mode": 0,
//         "whitelist": 0,
//         "security_level": null
//     }
//  3. Al agregar Bluetooth se DESACTIVA el serial USB y la extensión Radio.
//
//  COMPATIBILIDAD:
//  ───────────────
//  ✅ Chrome y Edge (Windows, macOS, Linux, Android)
//  ❌ Safari / iOS (Apple no soporta Web Bluetooth)
// =============================================================================


// =============================================================================
// Enumeraciones para Bluetooth
// =============================================================================

/**
 * Sensores disponibles para envío por Bluetooth.
 */
const enum SensorBT {
    //% block="Acelerómetro X"
    AcelerometroX = 0,
    //% block="Acelerómetro Y"
    AcelerometroY = 1,
    //% block="Acelerómetro Z"
    AcelerometroZ = 2,
    //% block="Temperatura"
    Temperatura = 3,
    //% block="Nivel de Luz"
    NivelLuz = 4,
    //% block="Brújula"
    Brujula = 5,
    //% block="Nivel Sonido (v2)"
    NivelSonido = 6,
    //% block="Fuerza G"
    FuerzaG = 7,
    //% block="Analógico P0"
    AnalogP0 = 8,
    //% block="Analógico P1"
    AnalogP1 = 9,
    //% block="Analógico P2"
    AnalogP2 = 10
}

/**
 * Velocidades de muestreo predefinidas.
 */
const enum VelocidadMuestreo {
    //% block="muy rápido (20 ms)"
    MuyRapido = 20,
    //% block="rápido (50 ms)"
    Rapido = 50,
    //% block="normal (100 ms)"
    Normal = 100,
    //% block="medio (200 ms)"
    Medio = 200,
    //% block="lento (500 ms)"
    Lento = 500,
    //% block="muy lento (1000 ms)"
    MuyLento = 1000
}


// =============================================================================
// NAMESPACE — "FisicaBit BT" aparecerá como categoría separada en la toolbox
// =============================================================================
//% weight=90
//% color=#0082FB
//% icon="\uf294"
//% block="FisicaBit BT"
//% groups="['Conexión', 'Envío de Datos', 'Envío Continuo', 'Servicios BLE']"
namespace FisicaBitBT {

    // =========================================================================
    // Variables internas
    // =========================================================================
    let _uartIniciado = false
    let _envioContinuoActivo = false
    let _velocidadMs = 100
    let _sensoresActivos: SensorBT[] = []
    let _enviarTimestamp = true

    // =========================================================================
    // GRUPO 1: CONEXIÓN
    // =========================================================================

    /**
     * Inicia el servicio Bluetooth UART para enviar datos.
     * Debe llamarse al inicio del programa (bloque "al iniciar").
     *
     * IMPORTANTE: Requiere configurar "No Pairing Required" en
     * Project Settings para conexión sin PIN.
     */
    //% block="iniciar Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Conexión"
    //% weight=100
    export function iniciarUART(): void {
        if (!_uartIniciado) {
            bluetooth.startUartService()
            _uartIniciado = true
            basic.showIcon(IconNames.Yes)
            basic.pause(500)
            basic.clearScreen()
        }
    }

    /**
     * Inicia el servicio UART y también los servicios BLE adicionales
     * para que fisicasimple.com pueda detectar todos los sensores.
     */
    //% block="iniciar Bluetooth UART con todos los servicios"
    //% blockId=fisicabit_bt_iniciar_completo
    //% group="Conexión"
    //% weight=95
    export function iniciarUARTCompleto(): void {
        if (!_uartIniciado) {
            bluetooth.startUartService()
            bluetooth.startAccelerometerService()
            bluetooth.startTemperatureService()
            bluetooth.startMagnetometerService()
            bluetooth.startButtonService()
            bluetooth.startLEDService()
            bluetooth.startIOPinService()
            _uartIniciado = true
            basic.showIcon(IconNames.Yes)
            basic.pause(500)
            basic.clearScreen()
        }
    }

    /**
     * Muestra un ícono cuando un dispositivo se conecta o desconecta.
     */
    //% block="configurar indicador de conexión BT"
    //% blockId=fisicabit_bt_indicador
    //% group="Conexión"
    //% weight=90
    export function configurarIndicadorConexion(): void {
        bluetooth.onBluetoothConnected(function () {
            basic.showIcon(IconNames.Heart)
        })
        bluetooth.onBluetoothDisconnected(function () {
            basic.showIcon(IconNames.No)
            _envioContinuoActivo = false
        })
    }

    // =========================================================================
    // GRUPO 2: ENVÍO DE DATOS (manual, una línea por vez)
    // =========================================================================

    /**
     * Envía una línea de texto por Bluetooth UART.
     * Formato libre — útil para depuración o datos personalizados.
     * @param texto Texto a enviar
     */
    //% block="enviar por BT texto %texto"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Envío de Datos"
    //% weight=80
    export function enviarTexto(texto: string): void {
        if (_uartIniciado) {
            bluetooth.uartWriteLine(texto)
        }
    }

    /**
     * Envía un valor con timestamp por Bluetooth UART.
     * Formato: timestamp,valor
     * @param valor Valor numérico a enviar
     */
    //% block="enviar por BT valor %valor"
    //% blockId=fisicabit_bt_enviar_valor
    //% group="Envío de Datos"
    //% weight=78
    export function enviarValor(valor: number): void {
        if (_uartIniciado) {
            let t = input.runningTime()
            bluetooth.uartWriteLine("" + t + "," + valor)
        }
    }

    /**
     * Envía dos valores con timestamp por Bluetooth UART.
     * Formato: timestamp,valor1,valor2
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     */
    //% block="enviar por BT valores %valor1 y %valor2"
    //% blockId=fisicabit_bt_enviar_2valores
    //% group="Envío de Datos"
    //% weight=76
    export function enviar2Valores(valor1: number, valor2: number): void {
        if (_uartIniciado) {
            let t = input.runningTime()
            bluetooth.uartWriteLine("" + t + "," + valor1 + "," + valor2)
        }
    }

    /**
     * Envía tres valores con timestamp por Bluetooth UART.
     * Formato: timestamp,valor1,valor2,valor3
     * @param valor1 Primer valor
     * @param valor2 Segundo valor
     * @param valor3 Tercer valor
     */
    //% block="enviar por BT valores %valor1 , %valor2 y %valor3"
    //% blockId=fisicabit_bt_enviar_3valores
    //% group="Envío de Datos"
    //% weight=74
    export function enviar3Valores(valor1: number, valor2: number, valor3: number): void {
        if (_uartIniciado) {
            let t = input.runningTime()
            bluetooth.uartWriteLine("" + t + "," + valor1 + "," + valor2 + "," + valor3)
        }
    }

    /**
     * Envía la lectura de un sensor interno con timestamp.
     * Formato: timestamp,valor
     * @param sensor Sensor a leer y enviar
     */
    //% block="enviar por BT sensor %sensor"
    //% blockId=fisicabit_bt_enviar_sensor
    //% group="Envío de Datos"
    //% weight=72
    export function enviarSensor(sensor: SensorBT): void {
        if (_uartIniciado) {
            let t = input.runningTime()
            let v = _leerSensor(sensor)
            bluetooth.uartWriteLine("" + t + "," + v)
        }
    }

    // =========================================================================
    // GRUPO 3: ENVÍO CONTINUO (automático con velocidad configurable)
    // =========================================================================

    /**
     * Configura la velocidad de muestreo para el envío continuo.
     * Determina cada cuántos milisegundos se envía una lectura.
     * @param velocidad Intervalo entre lecturas
     */
    //% block="configurar velocidad de muestreo %velocidad"
    //% blockId=fisicabit_bt_velocidad
    //% group="Envío Continuo"
    //% weight=70
    export function configurarVelocidad(velocidad: VelocidadMuestreo): void {
        _velocidadMs = velocidad
    }

    /**
     * Configura la velocidad de muestreo con un valor personalizado en ms.
     * @param ms Milisegundos entre cada envío (mínimo 10)
     */
    //% block="configurar muestreo cada %ms ms"
    //% blockId=fisicabit_bt_velocidad_custom
    //% group="Envío Continuo"
    //% weight=68
    //% ms.min=10 ms.max=10000 ms.defl=100
    export function configurarVelocidadMs(ms: number): void {
        _velocidadMs = Math.max(10, ms)
    }

    /**
     * Inicia el envío continuo de UN sensor por Bluetooth.
     * Los datos se envían con timestamp en formato CSV.
     * Presionar botón B para detener.
     * @param sensor Sensor a enviar continuamente
     */
    //% block="iniciar envío continuo de %sensor"
    //% blockId=fisicabit_bt_envio_1sensor
    //% group="Envío Continuo"
    //% weight=66
    export function iniciarEnvio1Sensor(sensor: SensorBT): void {
        if (!_uartIniciado) iniciarUART()
        _envioContinuoActivo = true

        // Botón B detiene el envío
        input.onButtonPressed(Button.B, function () {
            _envioContinuoActivo = false
            basic.showIcon(IconNames.No)
            basic.pause(500)
            basic.clearScreen()
        })

        control.inBackground(function () {
            while (_envioContinuoActivo) {
                let t = input.runningTime()
                let v = _leerSensor(sensor)
                bluetooth.uartWriteLine("" + t + "," + v)
                basic.pause(_velocidadMs)
            }
        })
    }

    /**
     * Inicia el envío continuo de DOS sensores por Bluetooth.
     * Formato: timestamp,valor1,valor2
     * Presionar botón B para detener.
     * @param sensor1 Primer sensor
     * @param sensor2 Segundo sensor
     */
    //% block="iniciar envío continuo de %sensor1 y %sensor2"
    //% blockId=fisicabit_bt_envio_2sensores
    //% group="Envío Continuo"
    //% weight=64
    export function iniciarEnvio2Sensores(sensor1: SensorBT, sensor2: SensorBT): void {
        if (!_uartIniciado) iniciarUART()
        _envioContinuoActivo = true

        input.onButtonPressed(Button.B, function () {
            _envioContinuoActivo = false
            basic.showIcon(IconNames.No)
            basic.pause(500)
            basic.clearScreen()
        })

        control.inBackground(function () {
            while (_envioContinuoActivo) {
                let t = input.runningTime()
                let v1 = _leerSensor(sensor1)
                let v2 = _leerSensor(sensor2)
                bluetooth.uartWriteLine("" + t + "," + v1 + "," + v2)
                basic.pause(_velocidadMs)
            }
        })
    }

    /**
     * Inicia el envío continuo de TRES sensores por Bluetooth.
     * Formato: timestamp,valor1,valor2,valor3
     * Presionar botón B para detener.
     * @param sensor1 Primer sensor
     * @param sensor2 Segundo sensor
     * @param sensor3 Tercer sensor
     */
    //% block="iniciar envío continuo de %sensor1 , %sensor2 y %sensor3"
    //% blockId=fisicabit_bt_envio_3sensores
    //% group="Envío Continuo"
    //% weight=62
    export function iniciarEnvio3Sensores(sensor1: SensorBT, sensor2: SensorBT, sensor3: SensorBT): void {
        if (!_uartIniciado) iniciarUART()
        _envioContinuoActivo = true

        input.onButtonPressed(Button.B, function () {
            _envioContinuoActivo = false
            basic.showIcon(IconNames.No)
            basic.pause(500)
            basic.clearScreen()
        })

        control.inBackground(function () {
            while (_envioContinuoActivo) {
                let t = input.runningTime()
                let v1 = _leerSensor(sensor1)
                let v2 = _leerSensor(sensor2)
                let v3 = _leerSensor(sensor3)
                bluetooth.uartWriteLine("" + t + "," + v1 + "," + v2 + "," + v3)
                basic.pause(_velocidadMs)
            }
        })
    }

    /**
     * Detiene el envío continuo de datos.
     */
    //% block="detener envío continuo"
    //% blockId=fisicabit_bt_detener
    //% group="Envío Continuo"
    //% weight=60
    export function detenerEnvio(): void {
        _envioContinuoActivo = false
    }

    /**
     * Indica si el envío continuo está activo.
     */
    //% block="envío BT activo"
    //% blockId=fisicabit_bt_activo
    //% group="Envío Continuo"
    //% weight=58
    export function envioActivo(): boolean {
        return _envioContinuoActivo
    }

    // =========================================================================
    // GRUPO 4: SERVICIOS BLE ADICIONALES
    // =========================================================================

    /**
     * Inicia el servicio BLE de acelerómetro.
     * Permite lectura directa desde la app sin usar UART.
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

    // =========================================================================
    // FUNCIONES INTERNAS (no visibles como bloques)
    // =========================================================================

    /**
     * Lee el valor de un sensor según su tipo.
     * @param sensor Tipo de sensor a leer
     * @returns Valor numérico del sensor
     */
    function _leerSensor(sensor: SensorBT): number {
        switch (sensor) {
            case SensorBT.AcelerometroX:
                return input.acceleration(Dimension.X)
            case SensorBT.AcelerometroY:
                return input.acceleration(Dimension.Y)
            case SensorBT.AcelerometroZ:
                return input.acceleration(Dimension.Z)
            case SensorBT.Temperatura:
                return input.temperature()
            case SensorBT.NivelLuz:
                return input.lightLevel()
            case SensorBT.Brujula:
                return input.compassHeading()
            case SensorBT.NivelSonido:
                return input.soundLevel()
            case SensorBT.FuerzaG:
                let ax = input.acceleration(Dimension.X)
                let ay = input.acceleration(Dimension.Y)
                let az = input.acceleration(Dimension.Z)
                return Math.round(Math.sqrt(ax * ax + ay * ay + az * az))
            case SensorBT.AnalogP0:
                return pins.analogReadPin(AnalogPin.P0)
            case SensorBT.AnalogP1:
                return pins.analogReadPin(AnalogPin.P1)
            case SensorBT.AnalogP2:
                return pins.analogReadPin(AnalogPin.P2)
            default:
                return 0
        }
    }
}
