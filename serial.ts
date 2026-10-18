// =============================================================================
//  serial.ts — "FisicaBit USB": sending data to fisicabit.com over USB
// =============================================================================
//  Project: FisicaBit.com
//  Description: Blocks to send sensor data to fisicabit.com through the USB
//               serial port (Web Serial, 115200 baud).
//
//  MINIMAL SEQUENCE (a single block):
//    forever:
//      [send to fisicabit.com time and (acceleration x) every (100) ms]
//
//  On every iteration that block:
//    1. Takes the micro:bit time in ms (starts at 0)
//    2. Sends the CSV line  "time,value"  (the format the page expects)
//    3. Waits until the given ms have elapsed since the previous sample
//       ("deadline" timing: the actual period matches the configured one
//       even though "forever" adds its hidden ~20 ms delay)
//
//  On fisicabit.com: USB connection, number of variables = number of values
//  in the block (not counting time) and "micro:bit sends timestamp" enabled.
//
//  For 50-100 Hz use the block "fisicabit.com fast loop every ... ms",
//  which avoids the hidden delay of "forever".
//
//  Note: Bluetooth and Radio cannot coexist in the same program, but USB
//  serial does work together with Bluetooth.
// =============================================================================

/** Send sensor data to fisicabit.com over the USB serial port (Web Serial). */
//% weight=99
//% color=#5C6BC0
//% icon=""
//% block="FisicaBit USB"
//% groups='["1. Send (inside forever)", "Send without time", "2. Optional", "Advanced"]'
namespace fisicabitSerial {

    let _sampler: fisicabitData.Sampler = null
    let _started = false

    function _ensure(): fisicabitData.Sampler {
        if (!_sampler) _sampler = new fisicabitData.Sampler()
        if (!_started) {
            _started = true
            // fisicabit.com opens the port at 115200 baud
            serial.setBaudRate(BaudRate.BaudRate115200)
            _sampler.resetTime()
        }
        return _sampler
    }

    function _send(values: number[], ms: number): void {
        const m = _ensure()
        m.setPeriod(ms)
        serial.writeLine(m.line(values))
        m.wait()
    }

    function _sendWithoutTime(values: number[]): void {
        const m = _ensure()
        serial.writeLine(m.line(values, false))
    }

    // =========================================================================
    // STEP 1: SEND — a single block inside "forever"
    // =========================================================================

    /**
     * Sends to fisicabit.com the time (ms) and one measured value, then waits
     * until the next sample. Place inside "forever".
     * Line sent: time,value
     *
     * Example: [send to fisicabit.com time and (acceleration x) every (100) ms]
     *   → 10 samples per second with the micro:bit time starting at 0.
     * On fisicabit.com: USB, 1 variable, "micro:bit sends timestamp" enabled.
     *
     * @param value measured value (sensor, variable or calculation)
     * @param ms time between samples in ms (100 = 10 per second), eg: 100
     */
    //% block="send to fisicabit.com time and %value every %ms ms"
    //% blockId=fisicabit_usb_enviar_1
    //% group="1. Send (inside forever)"
    //% weight=100
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send1(value: number, ms: number): void {
        _send([value], ms)
    }

    /**
     * Sends to fisicabit.com the time (ms) and two measured values, then
     * waits until the next sample. Place inside "forever".
     * Line sent: time,value1,value2
     *
     * Example: [send to fisicabit.com time, (acceleration x) and (acceleration y) every (100) ms]
     * On fisicabit.com: USB, 2 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com time, %value1 and %value2 every %ms ms"
    //% blockId=fisicabit_usb_enviar_2
    //% group="1. Send (inside forever)"
    //% weight=95
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function send2(value1: number, value2: number, ms: number): void {
        _send([value1, value2], ms)
    }

    /**
     * Sends to fisicabit.com the time (ms) and three measured values, then
     * waits until the next sample. Place inside "forever".
     * Line sent: time,value1,value2,value3
     *
     * Example: acceleration x, y, z every 100 ms.
     * On fisicabit.com: USB, 3 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com time, %value1 , %value2 and %value3 every %ms ms"
    //% blockId=fisicabit_usb_enviar_3
    //% group="1. Send (inside forever)"
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
     * Sends to fisicabit.com the time (ms) and four measured values, then
     * waits until the next sample. Place inside "forever".
     * Line sent: time,value1,value2,value3,value4
     *
     * On fisicabit.com: USB, 4 variables, "micro:bit sends timestamp" enabled.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param value4 fourth measured value
     * @param ms time between samples in ms, eg: 100
     */
    //% block="send to fisicabit.com time, %value1 , %value2 , %value3 and %value4 every %ms ms"
    //% blockId=fisicabit_usb_enviar_4
    //% deprecated=true
    //% group="1. Send (inside forever)"
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
     * Sends to fisicabit.com over USB ONLY one measured value, without the
     * micro:bit time and without waiting: it is sent the moment the block
     * runs. Use it on a button press, in any event, or inside "forever" with
     * the pause you want. Line sent: value
     * The page adds the time using the browser clock.
     *
     * Example: [on button A pressed] → [send to fisicabit.com without time (temperature)]
     * On fisicabit.com: USB, 1 variable, "micro:bit sends timestamp" DISABLED.
     *
     * @param value measured value
     */
    //% block="send to fisicabit.com without time %value"
    //% blockId=fisicabit_usb_enviar_st_1
    //% group="Send without time"
    //% weight=83
    //% inlineInputMode=inline
    export function sendWithoutTime1(value: number): void {
        _sendWithoutTime([value])
    }

    /**
     * Sends to fisicabit.com over USB ONLY two measured values, without the
     * micro:bit time and without waiting: they are sent the moment the block
     * runs. Use it on a button press, in any event, or inside "forever" with
     * the pause you want. Line sent: value1,value2
     * The page adds the time using the browser clock.
     *
     * Example: [forever] → [send to fisicabit.com without time (acceleration x) and (acceleration y)] + [pause 200 ms]
     * On fisicabit.com: USB, 2 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     */
    //% block="send to fisicabit.com without time %value1 and %value2"
    //% blockId=fisicabit_usb_enviar_st_2
    //% group="Send without time"
    //% weight=82
    //% inlineInputMode=inline
    export function sendWithoutTime2(value1: number, value2: number): void {
        _sendWithoutTime([value1, value2])
    }

    /**
     * Sends to fisicabit.com over USB ONLY three measured values, without the
     * micro:bit time and without waiting: they are sent the moment the block
     * runs. Use it on a button press, in any event, or inside "forever" with
     * the pause you want. Line sent: value1,value2,value3
     * The page adds the time using the browser clock.
     *
     * Example: [forever] → [send ... without time (acceleration x), (y) and (z)] + [pause 100 ms]
     * On fisicabit.com: USB, 3 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     */
    //% block="send to fisicabit.com without time %value1 , %value2 and %value3"
    //% blockId=fisicabit_usb_enviar_st_3
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
     * Sends to fisicabit.com over USB ONLY four measured values, without the
     * micro:bit time and without waiting: they are sent the moment the block
     * runs. Use it on a button press, in any event, or inside "forever" with
     * the pause you want. Line sent: value1,value2,value3,value4
     * The page adds the time using the browser clock.
     *
     * Example: four sensors in an event or in "forever" with a pause
     * On fisicabit.com: USB, 4 variables, "micro:bit sends timestamp" DISABLED.
     *
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param value4 fourth measured value
     */
    //% block="send to fisicabit.com without time %value1 , %value2 , %value3 and %value4"
    //% blockId=fisicabit_usb_enviar_st_4
    //% deprecated=true
    //% group="Send without time"
    //% weight=80
    //% inlineInputMode=inline
    export function sendWithoutTime4(value1: number, value2: number, value3: number, value4: number): void {
        _sendWithoutTime([value1, value2, value3, value4])
    }

    // =========================================================================
    // STEP 2: OPTIONAL — high speed and time control
    // =========================================================================

    /**
     * Fast loop for fisicabit.com: runs the inner code every X ms with
     * precise timing, without the hidden delay of "forever". Use instead of
     * "forever" for 50-100 Hz (free fall, collisions, springs). Put the
     * "send to fisicabit.com" block inside; its "every ... ms" time is
     * ignored inside the loop.
     *
     * Example: [fast loop every (20) ms] with [send to fisicabit.com time and (acceleration z) every (20) ms] → 50 Hz.
     *
     * @param ms time between samples in ms (20 = 50 per second, 10 = 100 per second), eg: 20
     * @param handler code to run on every sample
     */
    //% block="fisicabit.com fast loop every %ms ms"
    //% blockId=fisicabit_usb_bucle
    //% group="2. Optional"
    //% weight=80
    //% ms.min=5 ms.max=60000 ms.defl=20
    //% blockAllowMultiple=0
    export function sampleLoop(ms: number, handler: () => void): void {
        const m = _ensure()
        m.setPeriod(ms)
        m.loop(handler)
    }

    /**
     * Resets the time to 0. Useful to start a new measurement on a button
     * press: the next line sent starts at time 0.
     *
     * Example: [on button A pressed] → [reset USB time to 0]
     */
    //% block="reset USB time to 0"
    //% blockId=fisicabit_usb_reiniciar_tiempo
    //% group="2. Optional"
    //% weight=75
    export function resetTime(): void {
        _ensure().resetTime()
    }

    /**
     * Time in milliseconds since USB sending started (starts at 0). It is
     * the same time that travels in every line. Useful to show it on the
     * screen or for your own calculations.
     */
    //% block="USB time (ms)"
    //% blockId=fisicabit_serial_tiempo
    //% group="2. Optional"
    //% weight=70
    export function time(): number {
        return _ensure().time()
    }

    // =========================================================================
    // ADVANCED
    // =========================================================================

    /**
     * Enables or disables sending the micro:bit time as the first column.
     * It must match the "micro:bit sends timestamp" option on fisicabit.com
     * (enabled by default). If you disable it, the page uses the browser
     * clock.
     * @param enable true = send time (default), false = values only
     */
    //% block="USB send micro:bit timestamp %enable"
    //% blockId=fisicabit_usb_timestamp
    //% group="Advanced"
    //% weight=50
    //% enable.shadow=toggleOnOff
    //% enable.defl=true
    //% advanced=true
    export function sendTimestamp(enable: boolean): void {
        _ensure().sendTime = enable
    }

    /**
     * Number of decimal places used when sending non-integer values.
     * @param decimals decimal places (0 to 6). Default 2.
     */
    //% block="USB set decimals %decimals"
    //% blockId=fisicabit_usb_decimales
    //% group="Advanced"
    //% weight=45
    //% decimals.min=0 decimals.max=6 decimals.defl=2
    //% advanced=true
    export function setDecimals(decimals: number): void {
        // Robust against out-of-range or non-numeric values (NaN → 2, clamp 0..6)
        let d = Math.round(decimals)
        if (d !== d) d = 2
        if (d < 0) d = 0
        if (d > 6) d = 6
        _ensure().decimals = d
    }

    /**
     * Sends a free text line over USB (no time, no waiting).
     * @param text text to send
     */
    //% block="USB send line %text"
    //% blockId=fisicabit_usb_linea
    //% group="Advanced"
    //% weight=40
    //% advanced=true
    export function sendLine(text: string): void {
        _ensure()
        serial.writeLine(text)
    }

    /**
     * Sets the interval between samples used by send blocks that do not
     * specify one. Normally not needed: the "send" block already has its
     * own "every ... ms".
     * @param rate sampling rate
     */
    //% block="set sampling rate %rate"
    //% blockId=fisicabit_usb_frecuencia
    //% group="Advanced"
    //% weight=30
    //% rate.defl=FbSampleRate.Hz10
    //% advanced=true
    export function setRate(rate: FbSampleRate): void {
        _ensure().setPeriod(rate)
    }

    /**
     * Sets the interval between samples in milliseconds (free value).
     * Normally not needed: the "send" block already has its own "every ... ms".
     * @param ms sampling interval in ms (5 to 60000)
     */
    //% block="set sampling interval %ms ms"
    //% blockId=fisicabit_usb_intervalo
    //% group="Advanced"
    //% weight=29
    //% ms.min=5 ms.max=60000 ms.defl=100
    //% advanced=true
    export function setInterval(ms: number): void {
        _ensure().setPeriod(ms)
    }

    // =========================================================================
    // LEGACY BLOCKS (deprecated) — kept so that old projects keep compiling.
    // They do not appear in the toolbox.
    // =========================================================================

    /**
     * (Deprecated) Use "send to fisicabit.com time and ... every ... ms".
     * @param value measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="serial sample %value|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_1
    //% group="Advanced"
    //% weight=10
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample1(value: number, ms: number): void {
        _ensure()
        serial.writeLine("" + value)
        basic.pause(ms)
    }

    /**
     * (Deprecated) Use "send to fisicabit.com time, ... and ... every ... ms".
     * @param value1 first measured value
     * @param value2 second measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="serial sample %value1 and %value2|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_2
    //% group="Advanced"
    //% weight=9
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample2(value1: number, value2: number, ms: number): void {
        _ensure()
        serial.writeLine("" + value1 + "," + value2)
        basic.pause(ms)
    }

    /**
     * (Deprecated) Use "send to fisicabit.com time, ... , ... and ... every ... ms".
     * @param value1 first measured value
     * @param value2 second measured value
     * @param value3 third measured value
     * @param ms pause after sending, in ms, eg: 100
     */
    //% block="serial sample %value1 , %value2 and %value3|every %ms ms"
    //% blockId=fisicabit_serial_muestrear_3
    //% group="Advanced"
    //% weight=8
    //% ms.min=10 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    //% deprecated=true
    export function sample3(value1: number, value2: number, value3: number, ms: number): void {
        _ensure()
        serial.writeLine("" + value1 + "," + value2 + "," + value3)
        basic.pause(ms)
    }
}
