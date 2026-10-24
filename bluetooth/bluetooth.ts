// =============================================================================
//  bluetooth.ts — "FisicaBit Bluetooth": data to fisicabit.com over BLE
// =============================================================================
//  Project: FisicaBit.com
//  Description: Blocks to connect the micro:bit to fisicabit.com wirelessly
//               (Bluetooth Low Energy, Nordic UART service) and send sensor
//               data with a single block.
//
//  MINIMAL SEQUENCE (two blocks):
//    on start:
//      [start Bluetooth for fisicabit.com]        ← FIRST block
//    forever:
//      [send to fisicabit.com via Bluetooth time and (acceleration x) every (100) ms]
//
//  CONNECTION PROTOCOL WITH fisicabit.com (Web Bluetooth):
//  ─────────────────────────────────────────────────────────
//    1. Looks for a device named "BBC micro:bit [XXXXX]"
//    2. Uses the Nordic UART service (6e400001-b5a3-f393-e0a9-e50e24dcca9e)
//       • micro:bit → page: TX characteristic with INDICATE, 20 bytes max.
//         per packet (each packet waits for the page's confirmation)
//    3. Receives CSV lines "time,value1,value2\n" (or "value1,value2\n")
//
//  WHY THESE BLOCKS CONNECT "WITHOUT TROUBLE":
//  ────────────────────────────────────────────────
//    • Only the UART service is started (fewer services = fast discovery;
//      on Windows every extra service takes seconds and can exceed the
//      firmware's 4 s supervision timeout).
//    • Transmit power at maximum (7) → better range and fewer drops.
//    • Short lines (time from 0, few decimals) → 1 BLE packet per sample,
//      no fragmentation.
//    • Data is transmitted only while a page is connected; sampling keeps
//      its pace and on reconnection the data comes back by itself.
//    • Time starts at 0 on every connection.
//    • Deadline-timed sampling: if BLE falls behind, it resynchronizes
//      instead of accumulating a burst of stale samples.
//
//  REQUIRED CONFIGURATION (pxt.json, already included in this extension):
//    "yotta": { "config": { "microbit-dal": { "bluetooth":
//        { "open": 1, "pairing_mode": 0, "whitelist": 0 } } } }
//    → Open connection, no pairing ("No Pairing Required").
//    (The top-level "bluetooth" key is NOT read by the compiler; verified
//     in built/codal.json: OPEN=1, PAIRING_MODE=0, WHITELIST=0.)
//
//  KNOWN LIMITATIONS:
//    • Bluetooth and Radio cannot be used in the same program.
//    • iOS/iPadOS does not support Web Bluetooth (use Android, Windows,
//      macOS, Linux or ChromeOS with Chrome/Edge).
//    • Practical BLE speed: up to ~20 Hz. For 50-100 Hz use USB.
// =============================================================================

/** Send sensor data to fisicabit.com wirelessly over Bluetooth Low Energy (Nordic UART). */
//% weight=98
//% color=#0082FB
//% icon=""
//% block="FisicaBit Bluetooth"
//% groups='["1. Start (in on start)", "2. Send (inside forever)", "Send without time", "3. Optional", "Advanced", "BLE Services"]'
namespace fisicabitBluetooth {

    let _sampler: fisicabitData.Sampler = null
    let _uartStarted = false
    let _connected = false
    let _showIcons = true
    // User code for "on connected" / "on disconnected". In MakeCode,
    // registering bluetooth.onBluetoothConnected() twice REPLACES the
    // previous handler: if these blocks called the API directly, the
    // internal handler (connected?, time reset, ♥) would be lost.
    // Hence a single internal handler that calls the user's one.
    let _userOnConnected: () => void = null
    let _userOnDisconnected: () => void = null

    function _ensureUart(): fisicabitData.Sampler {
        if (!_sampler) _sampler = new fisicabitData.Sampler()
        if (!_uartStarted) {
            _uartStarted = true
            bluetooth.startUartService()
            bluetooth.setTransmitPower(7)
            bluetooth.onBluetoothConnected(function () {
                _connected = true
                // Time starts at 0 for every fisicabit.com session
                _sampler.resetTime()
                if (_showIcons) basic.showIcon(IconNames.Heart)
                if (_userOnConnected) _userOnConnected()
            })
            bluetooth.onBluetoothDisconnected(function () {
                _connected = false
                if (_showIcons) basic.showIcon(IconNames.Target)
                if (_userOnDisconnected) _userOnDisconnected()
            })
            _sampler.resetTime()
            // Clear the "bars" CODAL shows when BLE starts
            basic.clearScreen()
        }
        return _sampler
    }

    // Note: the firmware (CODAL MicroBitUARTService::send) only transmits if
    // a connected client has enabled indications on the TX channel; in any
    // other case it discards the line immediately. That is why sending is
    // NOT conditioned on the "connected" event: transmission does not depend
    // on the order in which BLE events arrive (Android, reconnections).
    function _send(values: number[], ms: number): void {
        const m = _ensureUart()
        m.setPeriod(ms)
        // "\n" instead of "\r\n": one byte less per BLE packet
        bluetooth.uartWriteString(m.line(values) + "\n")
        m.wait()
    }

    function _sendWithoutTime(values: number[]): void {
        const m = _ensureUart()
        bluetooth.uartWriteString(m.line(values, false) + "\n")
    }

    // =========================================================================
    // STEP 1: START — first block of "on start"
    // =========================================================================

    /**
     * Starts Bluetooth ready to connect to fisicabit.com.
     * Place in "on start" as the FIRST block.
     *
     * What it does: turns on the UART service that fisicabit.com looks for,
     * raises the transmit power to maximum and shows a target (◎) on the
     * screen while waiting and a heart (♥) when the page connects.
     *
     * Example: [on start] → [start Bluetooth for fisicabit.com]
     * Then on fisicabit.com: Bluetooth → Connect → "BBC micro:bit [xxxxx]".
     */
    //% block="start Bluetooth for fisicabit.com"
    //% blockId=fisicabit_bt_inicio_rapido
    //% group="1. Start (in on start)"
    //% weight=110
    export function quickStart(): void {
        _ensureUart()
        _showIcons = true
        basic.showIcon(IconNames.Target)
    }

    // =========================================================================
    // STEP 2: SEND — a single block inside "forever"
    // =========================================================================

    /**
     * Sends to fisicabit.com via Bluetooth the time (ms) and one measured
     * value, then waits until the next sample. Place inside "forever".
     * Only transmits while the page is connected. Line: time,value
     *
     * Example: [send to fisicabit.com via Bluetooth time and (acceleration x) every (100) ms]
     *   → 10 samples per second, time from 0 on every connection.
     * On fisicabit.com: Bluetooth, 1 variable, "micro:bit sends timestamp" enabled.
     * Over Bluetooth 50 ms or more is recommended (up to 20 samples per second).
     *
     * @param value measured value (sensor, variable or calculation)
     * @param ms time between samples in ms (100 = 10 per second), eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time and %value every %ms ms"
    //% blockId=fisicabit_bt_enviar_1
    //% group="2. Send (inside forever)"
    //% weight=100
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send1(value: number, ms: number): void {
        _send([value], ms)
    }

    /**
     * Sends to fisicabit.com via Bluetooth the time (ms) and two measured
     * values, then waits until the next sample. Place inside "forever".
     * Line: time,value1,value2
     *
     * Example: acceleration x and y every 100 ms.
     * On fisicabit.com: Bluetooth, 2 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %value1 and %value2 every %ms ms"
    //% blockId=fisicabit_bt_enviar_2
    //% group="2. Send (inside forever)"
    //% weight=95
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send2(value1: number, value2: number, ms: number): void {
        _send([value1, value2], ms)
    }

    /**
     * Sends to fisicabit.com via Bluetooth the time (ms) and three measured
     * values, then waits until the next sample. Place inside "forever".
     * Line: time,value1,value2,value3
     *
     * Example: acceleration x, y, z every 100 ms.
     * On fisicabit.com: Bluetooth, 3 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %value1 , %value2 and %value3 every %ms ms"
    //% blockId=fisicabit_bt_enviar_3
    //% group="2. Send (inside forever)"
    //% weight=90
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send3(value1: number, value2: number, value3: number, ms: number): void {
        _send([value1, value2, value3], ms)
    }

    /**
     * DEPRECATED: fisicabit.com accepts up to 3 variables and discards lines
     * with 4 values. Use the 3-value block. Kept only so that old programs
     * keep compiling (hidden from the toolbox).
     *
     * Sends to fisicabit.com via Bluetooth the time (ms) and four measured
     * values, then waits until the next sample. Place inside "forever".
     * Line: time,value1,value2,value3,value4
     *
     * On fisicabit.com: Bluetooth, 4 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param value4 fourth measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com via Bluetooth time, %value1 , %value2 , %value3 and %value4 every %ms ms"
    //% blockId=fisicabit_bt_enviar_4
    //% deprecated=true
    //% group="2. Send (inside forever)"
    //% weight=85
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send4(value1: number, value2: number, value3: number, value4: number, ms: number): void {
        _send([value1, value2, value3, value4], ms)
    }

    // =========================================================================
    // SENDING DATA WITHOUT TIME — only the measured values, no waiting
    // =========================================================================

    /**
     * Sends to fisicabit.com via Bluetooth ONLY one measured value, without
     * the micro:bit time and without waiting: it is sent the moment the block
     * runs. Use it on a button press, in any event, or inside "forever" with
     * the pause you want. Line sent: value
     * The page adds the time using the browser clock.
     * Only transmits while the page is connected.
     *
     * Example: [on button A pressed] → [send to fisicabit.com without time (temperature)]
     * On fisicabit.com: Bluetooth, 1 variable, "micro:bit sends timestamp" DISABLED.
     *
     * @param value measured value
     */
    //% block="send to fisicabit.com via Bluetooth without time %value"
    //% blockId=fisicabit_bt_enviar_st_1
    //% group="Send without time"
    //% weight=83
    //% inlineInputMode=inline
    export function sendWithoutTime1(value: number): void {
        _sendWithoutTime([value])
    }

    /**
     * Sends to fisicabit.com via Bluetooth ONLY two measured values, without
     * the micro:bit time and without waiting: they are sent the moment the
     * block runs. Use it on a button press, in any event, or inside "forever"
     * with the pause you want. Line sent: value1,value2
     * The page adds the time using the browser clock.
     * Only transmits while the page is connected.
     *
     * Example: [forever] → [send to fisicabit.com without time (acceleration x) and (acceleration y)] + [pause 200 ms]
     * On fisicabit.com: Bluetooth, 2 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     */
    //% block="send to fisicabit.com via Bluetooth without time %value1 and %value2"
    //% blockId=fisicabit_bt_enviar_st_2
    //% group="Send without time"
    //% weight=82
    //% inlineInputMode=inline
    export function sendWithoutTime2(value1: number, value2: number): void {
        _sendWithoutTime([value1, value2])
    }

    /**
     * Sends to fisicabit.com via Bluetooth ONLY three measured values, without
     * the micro:bit time and without waiting: they are sent the moment the
     * block runs. Use it on a button press, in any event, or inside "forever"
     * with the pause you want. Line sent: value1,value2,value3
     * The page adds the time using the browser clock.
     * Only transmits while the page is connected.
     *
     * Example: [forever] → [send ... without time (acceleration x), (y) and (z)] + [pause 100 ms]
     * On fisicabit.com: Bluetooth, 3 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     */
    //% block="send to fisicabit.com via Bluetooth without time %value1 , %value2 and %value3"
    //% blockId=fisicabit_bt_enviar_st_3
    //% group="Send without time"
    //% weight=81
    //% inlineInputMode=inline
    export function sendWithoutTime3(value1: number, value2: number, value3: number): void {
        _sendWithoutTime([value1, value2, value3])
    }

    /**
     * DEPRECATED: fisicabit.com accepts up to 3 variables and discards lines
     * with 4 values. Use the 3-value block. Kept only so that old programs
     * keep compiling (hidden from the toolbox).
     *
     * Sends to fisicabit.com via Bluetooth ONLY four measured values, without
     * the micro:bit time and without waiting: they are sent the moment the
     * block runs. Use it on a button press, in any event, or inside "forever"
     * with the pause you want. Line sent: value1,value2,value3,value4
     * The page adds the time using the browser clock.
     * Only transmits while the page is connected.
     *
     * Example: four sensors in an event or in "forever" with a pause
     * On fisicabit.com: Bluetooth, 4 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param value4 fourth measured value
     */
    //% block="send to fisicabit.com via Bluetooth without time %value1 , %value2 , %value3 and %value4"
    //% blockId=fisicabit_bt_enviar_st_4
    //% deprecated=true
    //% group="Send without time"
    //% weight=80
    //% inlineInputMode=inline
    export function sendWithoutTime4(value1: number, value2: number, value3: number, value4: number): void {
        _sendWithoutTime([value1, value2, value3, value4])
    }

    // =========================================================================
    // STEP 3: OPTIONAL — connection state and time control
    // =========================================================================

    /**
     * True while fisicabit.com is connected over Bluetooth.
     *
     * Example: [if (Bluetooth connected?) then] → [show icon ♥]
     */
    //% block="Bluetooth connected?"
    //% blockId=fisicabit_bt_conectado
    //% group="3. Optional"
    //% weight=80
    export function isConnected(): boolean {
        _ensureUart()
        return _connected
    }

    /**
     * Runs the code when fisicabit.com connects over Bluetooth.
     *
     * Example: [on fisicabit.com Bluetooth connected] → [play tone C]
     * @param handler code to run on connection
     */
    //% block="on fisicabit.com Bluetooth connected"
    //% blockId=fisicabit_bt_al_conectar
    //% group="3. Optional"
    //% weight=78
    export function onConnected(handler: () => void): void {
        _ensureUart()
        _userOnConnected = handler
    }

    /**
     * Runs the code when fisicabit.com disconnects from Bluetooth.
     * @param handler code to run on disconnection
     */
    //% block="on fisicabit.com Bluetooth disconnected"
    //% blockId=fisicabit_bt_al_desconectar
    //% group="3. Optional"
    //% weight=77
    export function onDisconnected(handler: () => void): void {
        _ensureUart()
        _userOnDisconnected = handler
    }

    /**
     * Resets the time to 0. Useful to start a new measurement on a button
     * press: the next line sent starts at time 0.
     *
     * Example: [on button A pressed] → [reset Bluetooth time to 0]
     */
    //% block="reset Bluetooth time to 0"
    //% blockId=fisicabit_bt_reiniciar_tiempo
    //% group="3. Optional"
    //% weight=75
    export function resetTime(): void {
        _ensureUart().resetTime()
    }

    /**
     * Time in milliseconds since the last Bluetooth connection (starts at 0).
     * It is the same time that travels in every line sent.
     */
    //% block="Bluetooth time (ms)"
    //% blockId=fisicabit_bt_tiempo
    //% group="3. Optional"
    //% weight=70
    export function time(): number {
        return _ensureUart().time()
    }

    /**
     * Fast loop for fisicabit.com over Bluetooth: runs the inner code every
     * X ms with precise timing, without the hidden delay of "forever". Put
     * the "send to fisicabit.com via Bluetooth" block inside; its
     * "every ... ms" time is ignored inside the loop.
     * Over Bluetooth 50 ms or more is advisable.
     *
     * @param ms time between samples in ms, eg: 50
     * @param handler code to run on every sample
     */
    //% block="fisicabit.com Bluetooth fast loop every %ms ms"
    //% blockId=fisicabit_bt_bucle
    //% group="3. Optional"
    //% weight=65
    //% ms.min=5 ms.max=60000 ms.defl=50
    //% blockAllowMultiple=0
    export function sampleLoop(ms: number, handler: () => void): void {
        const m = _ensureUart()
        m.setPeriod(ms)
        m.loop(handler)
    }

    /**
     * Enables or disables the status icons on the LED screen
     * (target = waiting, heart = connected). Disable them if you want to
     * use the screen for something else.
     * @param show true = show icons (default)
     */
    //% block="Bluetooth show connection icons %show"
    //% blockId=fisicabit_bt_iconos
    //% group="3. Optional"
    //% weight=60
    //% show.shadow=toggleOnOff
    //% show.defl=true
    export function showIcons(show: boolean): void {
        _showIcons = show
        if (!show) basic.clearScreen()
    }

    // =========================================================================
    // ADVANCED
    // =========================================================================

    /**
     * Enables or disables sending the micro:bit time as the first column.
     * It must match the "micro:bit sends timestamp" option on fisicabit.com
     * (enabled by default).
     * @param enable true = send time (default), false = values only
     */
    //% block="Bluetooth send micro:bit timestamp %enable"
    //% blockId=fisicabit_bt_timestamp
    //% group="Advanced"
    //% weight=45
    //% enable.shadow=toggleOnOff
    //% enable.defl=true
    //% advanced=true
    export function sendTimestamp(enable: boolean): void {
        _ensureUart().sendTime = enable
    }

    /**
     * Number of decimal places used when sending non-integer values.
     * Fewer decimals = shorter lines = smoother Bluetooth.
     * @param decimals decimal places (0 to 6). Default 2.
     */
    //% block="Bluetooth set decimals %decimals"
    //% blockId=fisicabit_bt_decimales
    //% group="Advanced"
    //% weight=44
    //% decimals.min=0 decimals.max=6 decimals.defl=2
    //% advanced=true
    export function setDecimals(decimals: number): void {
        // Robust against out-of-range or non-numeric values (NaN → 2, clamp 0..6)
        let d = Math.round(decimals)
        if (d !== d) d = 2
        if (d < 0) d = 0
        if (d > 6) d = 6
        _ensureUart().decimals = d
    }

    /**
     * Sends a free text line over Bluetooth (no time, no waiting).
     * @param text text to send
     */
    //% block="Bluetooth send text %text"
    //% blockId=fisicabit_bt_enviar_texto
    //% group="Advanced"
    //% weight=43
    //% advanced=true
    export function sendText(text: string): void {
        _ensureUart()
        bluetooth.uartWriteLine(text)
    }

    /**
     * Starts Bluetooth with UART + all native BLE services
     * (accelerometer, temperature, magnetometer, buttons, LED, pins).
     * fisicabit.com only reads the UART and does NOT use the other services;
     * every extra service slows down the connection (especially on Windows
     * and phones). Use only if another app needs them.
     */
    //% block="start Bluetooth for fisicabit.com with all BLE services"
    //% blockId=fisicabit_bt_inicio_completo
    //% group="Advanced"
    //% weight=42
    //% advanced=true
    export function fullStart(): void {
        _ensureUart()
        bluetooth.startAccelerometerService()
        bluetooth.startTemperatureService()
        bluetooth.startMagnetometerService()
        bluetooth.startButtonService()
        bluetooth.startLEDService()
        bluetooth.startIOPinService()
        _showIcons = true
        basic.showIcon(IconNames.Target)
    }

    /**
     * Sets the interval between samples used by send blocks that do not
     * specify one. Normally not needed: the "send" block already has its
     * own "every ... ms".
     * @param rate sampling rate
     */
    //% block="set Bluetooth sampling rate %rate"
    //% blockId=fisicabit_bt_frecuencia
    //% group="Advanced"
    //% weight=30
    //% rate.defl=FbSampleRate.Hz10
    //% advanced=true
    export function setRate(rate: FbSampleRate): void {
        _ensureUart().setPeriod(rate)
    }

    /**
     * Sets the interval between samples in milliseconds (free value).
     * Normally not needed: the "send" block already has its own "every ... ms".
     * @param ms sampling interval in ms (5 to 60000)
     */
    //% block="set Bluetooth sampling interval %ms ms"
    //% blockId=fisicabit_bt_intervalo
    //% group="Advanced"
    //% weight=29
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% advanced=true
    export function setInterval(ms: number): void {
        _ensureUart().setPeriod(ms)
    }

    // =========================================================================
    // GROUP 5: INDIVIDUAL BLE SERVICES (advanced)
    // =========================================================================

    /**
     * Starts the BLE accelerometer service.
     */
    //% block="start BLE accelerometer service"
    //% blockId=fisicabit_bt_srv_accel
    //% group="BLE Services"
    //% weight=30
    //% advanced=true
    export function startAccelerometerService(): void {
        bluetooth.startAccelerometerService()
    }

    /**
     * Starts the BLE temperature service.
     */
    //% block="start BLE temperature service"
    //% blockId=fisicabit_bt_srv_temp
    //% group="BLE Services"
    //% weight=28
    //% advanced=true
    export function startTemperatureService(): void {
        bluetooth.startTemperatureService()
    }

    /**
     * Starts the BLE magnetometer (compass) service.
     */
    //% block="start BLE magnetometer service"
    //% blockId=fisicabit_bt_srv_mag
    //% group="BLE Services"
    //% weight=26
    //% advanced=true
    export function startMagnetometerService(): void {
        bluetooth.startMagnetometerService()
    }

    /**
     * Starts the BLE button service.
     */
    //% block="start BLE button service"
    //% blockId=fisicabit_bt_srv_btn
    //% group="BLE Services"
    //% weight=24
    //% advanced=true
    export function startButtonService(): void {
        bluetooth.startButtonService()
    }

    /**
     * Starts the BLE LED screen service.
     */
    //% block="start BLE LED service"
    //% blockId=fisicabit_bt_srv_led
    //% group="BLE Services"
    //% weight=22
    //% advanced=true
    export function startLedService(): void {
        bluetooth.startLEDService()
    }

    /**
     * Starts the BLE I/O pin service.
     */
    //% block="start BLE I/O pin service"
    //% blockId=fisicabit_bt_srv_io
    //% group="BLE Services"
    //% weight=20
    //% advanced=true
    export function startIoPinService(): void {
        bluetooth.startIOPinService()
    }

    // =========================================================================
    // LEGACY BLOCKS (deprecated) — kept so that old projects keep compiling.
    // They do not appear in the toolbox.
    // =========================================================================

    /**
     * (Deprecated) Use "start Bluetooth for fisicabit.com".
     */
    //% block="start Bluetooth UART"
    //% blockId=fisicabit_bt_iniciar
    //% group="Advanced"
    //% weight=10
    //% deprecated=true
    export function startUart(): void {
        _ensureUart()
        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.clearScreen()
    }

    /**
     * (Deprecated) "start Bluetooth for fisicabit.com" already shows the icons.
     */
    //% block="setup BT connection indicator"
    //% blockId=fisicabit_bt_indicador
    //% group="Advanced"
    //% weight=9
    //% deprecated=true
    export function setupConnectionIndicator(): void {
        _ensureUart()
        _showIcons = true
    }

    /**
     * (Deprecated) Use "send to fisicabit.com via Bluetooth" + "set Bluetooth sampling rate".
     * @param value measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="BT sample %value|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_1
    //% group="Advanced"
    //% weight=8
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample1(value: number, ms: number): void {
        _ensureUart()
        bluetooth.uartWriteLine("" + value)
        basic.pause(ms)
    }

    /**
     * (Deprecated) Use "send to fisicabit.com via Bluetooth" + "set Bluetooth sampling rate".
     * @param value1 first measured value
     * @param value2 second measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="BT sample %value1 and %value2|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_2
    //% group="Advanced"
    //% weight=7
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample2(value1: number, value2: number, ms: number): void {
        _ensureUart()
        bluetooth.uartWriteLine("" + value1 + "," + value2)
        basic.pause(ms)
    }

    /**
     * (Deprecated) Use "send to fisicabit.com via Bluetooth" + "set Bluetooth sampling rate".
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="BT sample %value1 , %value2 and %value3|every %ms ms"
    //% blockId=fisicabit_bt_muestrear_3
    //% group="Advanced"
    //% weight=6
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample3(value1: number, value2: number, value3: number, ms: number): void {
        _ensureUart()
        bluetooth.uartWriteLine("" + value1 + "," + value2 + "," + value3)
        basic.pause(ms)
    }

    // =========================================================================
    // Registration with the core extension
    // =========================================================================
    // Runs once when the program starts: the "send ... via [Bluetooth]"
    // blocks of kinematics, ToF and ultrasonic in fisicabit-sensores route
    // their data through these functions.
    fisicabitData.registerBluetooth(time, sendText, _send)
}
