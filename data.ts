// =============================================================================
//  data.ts — Shared sampling and number-formatting core
// =============================================================================
//  Project: FisicaBit.com
//  Description: Common logic used by "FisicaBit USB" (serial.ts) and
//               "FisicaBit Bluetooth" (bluetooth.ts):
//
//    • Compact number formatting (ASCII, few decimals) → short lines.
//      Over Bluetooth each BLE UART packet carries at most 20 bytes, so a
//      short line travels in ONE packet and arrives faster.
//    • Sampler with "deadline" timing: the send block waits until the next
//      sampling instant instead of pausing a fixed amount. This way the
//      actual period matches the configured one even though the "forever"
//      loop adds its hidden ~20 ms delay.
//
//  FORMAT EXPECTED BY fisicabit.com (one line per sample, CSV):
//    time,value1,value2,...   (option "micro:bit sends timestamp" enabled)
//    value1,value2,...        (without timestamp: the page uses its own clock)
//
//  This file does NOT define blocks; support code only.
// =============================================================================

/** Shared sampling and number-formatting helpers for the USB and Bluetooth blocks (no blocks). */
namespace fisicabitData {

    /** Internal helper, not a block. Minimum sampling period in ms. */
    export const MIN_PERIOD_MS = 5
    /** Internal helper, not a block. Maximum sampling period in ms. */
    export const MAX_PERIOD_MS = 60000

    /**
     * Internal helper, not a block.
     * Converts a number to compact text to send to fisicabit.com.
     * - Integers are sent as they are ("-1023").
     * - Non-integers are rounded to `decimals` digits and trailing zeros are
     *   removed ("3.50" → "3.5", "2.001" → "2" with 2 decimals).
     * - Never produces "-0".
     * @param v number to format
     * @param decimals number of decimal places (0 to 6)
     */
    export function format(v: number, decimals: number): string {
        // NaN or infinity: leave the standard conversion
        if (v !== v || v === Infinity || v === -Infinity) return "" + v
        if (v === Math.floor(v)) return "" + v
        if (decimals <= 0) return "" + Math.round(v)
        if (decimals > 6) decimals = 6

        const neg = v < 0
        let a = neg ? -v : v
        // Huge values: the integer arithmetic below would lose precision
        if (a >= 10000000) return "" + Math.round(v)

        let pow = 1
        for (let i = 0; i < decimals; i++) pow *= 10
        const scaled = Math.round(a * pow)
        const intPart = Math.idiv(scaled, pow)
        const fracPart = scaled - intPart * pow

        if (fracPart === 0) {
            return "" + (neg ? -intPart : intPart)
        }
        let fracStr = "" + fracPart
        while (fracStr.length < decimals) fracStr = "0" + fracStr
        while (fracStr.length > 1 && fracStr.charAt(fracStr.length - 1) === "0") {
            fracStr = fracStr.substr(0, fracStr.length - 1)
        }
        return (neg ? "-" : "") + intPart + "." + fracStr
    }

    /**
     * Internal helper, not a block.
     * Sampler: keeps the configured period and the time origin, and builds
     * the CSV lines. There is one instance for USB and another for Bluetooth.
     */
    export class Sampler {
        periodMs: number
        sendTime: boolean
        decimals: number
        inLoop: boolean
        private _next: number
        private _origin: number

        constructor() {
            this.periodMs = 100
            this.sendTime = true
            this.decimals = 2
            this.inLoop = false
            this._next = 0
            this._origin = input.runningTime()
        }

        /** Milliseconds since the time origin (starts at 0). */
        time(): number {
            return input.runningTime() - this._origin
        }

        /** Resets the time to 0 and resynchronizes the sampling. */
        resetTime(): void {
            this._origin = input.runningTime()
            this._next = 0
        }

        /** Sets the sampling period in ms (clamped to a safe range). */
        setPeriod(ms: number): void {
            if (ms !== ms || ms < MIN_PERIOD_MS) ms = MIN_PERIOD_MS
            if (ms > MAX_PERIOD_MS) ms = MAX_PERIOD_MS
            ms = Math.round(ms)
            // Only resynchronize if the period changed (the send block calls
            // this on every sample with the same value).
            if (ms !== this.periodMs) {
                this.periodMs = ms
                this._next = 0
            }
        }

        /** Builds the CSV line: [time,]v1,v2,... (no time if withTime=false) */
        line(values: number[], withTime: boolean = true): string {
            let s = (withTime && this.sendTime) ? ("" + this.time()) : ""
            for (let i = 0; i < values.length; i++) {
                if (s.length > 0) s += ","
                s += format(values[i], this.decimals)
            }
            return s
        }

        /**
         * Waits until the next sampling instant.
         * If the program fell behind by more than one period (e.g. slow
         * Bluetooth), it resynchronizes instead of "racing" to recover the
         * missed samples.
         * Inside the sampling loop (inLoop) it does not wait: the loop does.
         */
        wait(): void {
            if (this.inLoop) return
            this.waitForever()
        }

        /** Waits until the next sampling instant, regardless of inLoop. */
        waitForever(): void {
            const now = input.runningTime()
            if (this._next === 0 || now - this._next > this.periodMs) {
                this._next = now + this.periodMs
            } else {
                this._next += this.periodMs
            }
            const waitMs = this._next - now
            if (waitMs > 0) {
                basic.pause(waitMs)
            } else {
                // Behind schedule: still yield the processor so other fibers are not blocked
                basic.pause(1)
            }
        }

        /**
         * Runs `handler` in the background with the configured period,
         * without the hidden delay of "forever".
         */
        loop(handler: () => void): void {
            control.inBackground(() => {
                this._next = 0
                while (true) {
                    this.inLoop = true
                    handler()
                    this.inLoop = false
                    this.waitForever()
                }
            })
        }
    }

    // =========================================================================
    // Optional Bluetooth transport
    // =========================================================================
    // The separate "fisicabit-bluetooth" extension registers itself here when
    // the program starts. Blocks that offer a channel choice (USB / Bluetooth)
    // in kinematics, ToF and ultrasonic call these helpers; when the Bluetooth
    // extension is not installed they fall back to USB serial, so a program
    // never silently loses its data.
    let _btTime: () => number = null
    let _btSendText: (text: string) => void = null
    let _btSend: (values: number[], ms: number) => void = null

    /**
     * Internal helper, not a block. Registers the Bluetooth transport; called
     * once at start-up by the fisicabit-bluetooth extension.
     * @param time returns the Bluetooth session time in ms
     * @param sendText sends one text line over Bluetooth UART
     * @param send sends time + values and waits for the sampling period
     */
    export function registerBluetooth(time: () => number, sendText: (text: string) => void, send: (values: number[], ms: number) => void): void {
        _btTime = time
        _btSendText = sendText
        _btSend = send
    }

    /** Internal helper, not a block. True when the fisicabit-bluetooth extension is installed. */
    export function bluetoothAvailable(): boolean {
        return _btSend != null
    }

    /**
     * Internal helper, not a block. Session time of the chosen channel (ms since reset).
     * @param channel USB or Bluetooth
     */
    export function channelTime(channel: FbChannel): number {
        if (channel == FbChannel.Bluetooth && _btTime) return _btTime()
        return fisicabitSerial.time()
    }

    /**
     * Internal helper, not a block. Sends one CSV line over the chosen channel.
     * @param channel USB or Bluetooth
     * @param text the line to send (without newline)
     */
    export function channelSendText(channel: FbChannel, text: string): void {
        if (channel == FbChannel.Bluetooth && _btSendText) _btSendText(text)
        else fisicabitSerial.sendLine(text)
    }

    /**
     * Internal helper, not a block. Sends time + one or two values over the
     * chosen channel and waits for the sampling period.
     * @param channel USB or Bluetooth
     * @param values one or two measured values
     * @param ms sampling period in milliseconds
     */
    export function channelSend(channel: FbChannel, values: number[], ms: number): void {
        if (channel == FbChannel.Bluetooth && _btSend) { _btSend(values, ms); return }
        if (values.length == 1) fisicabitSerial.send1(values[0], ms)
        else fisicabitSerial.send2(values[0], values[1], ms)
    }
}
