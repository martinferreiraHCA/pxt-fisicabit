// =============================================================================
// nativeShims.ts — TypeScript declarations of the C++ helpers in shims.cpp
// =============================================================================
//
// Each function carries `//% shim=fisicabitNative::name`: on a micro:bit the
// C++ implementation in shims.cpp runs; in the MakeCode simulator the body
// below runs instead, so programs never throw "not implemented" when they use
// hardware that the simulator cannot emulate. The name after `shim=` must match
// the C++ function name exactly (namespace and function).
//
// Other native helpers (ultrasonic, ToF, DS18B20, HX711, photogate, internal
// microphone, accelerometer configuration) are declared the same way inside
// their own modules.
// =============================================================================

/** Internal namespace: bindings to the native C++ code in shims.cpp. */
namespace fisicabitNative {

    /**
     * Internal helper, not a block. Reads the ADC through CODAL with 12-bit
     * resolution (0-4095). Simulator: analog read of the matching pin, scaled.
     * @param channel ADC channel: 0 = P0, 1 = P1, 2 = P2
     */
    //% shim=fisicabitNative::readAdcNative
    export function readAdcNative(channel: number): number {
        const pin = channel == 1 ? AnalogPin.P1 : channel == 2 ? AnalogPin.P2 : AnalogPin.P0
        return pins.analogReadPin(pin) * 4
    }

    /**
     * Internal helper, not a block. Measures the duration of a digital pulse in
     * microseconds using the CODAL pulse capture. Simulator: always 0.
     * @param pin pin number (0-20)
     * @param high true to time a HIGH pulse, false for a LOW pulse
     * @param timeoutUs maximum wait in microseconds
     */
    //% shim=fisicabitNative::measurePulseNative
    export function measurePulseNative(pin: number, high: boolean, timeoutUs: number): number {
        return 0
    }

    /**
     * Internal helper, not a block. Averages several ADC readings (oversampling).
     * @param channel ADC channel: 0 = P0, 1 = P1, 2 = P2
     * @param samples number of samples to average (1-64)
     */
    //% shim=fisicabitNative::readAdcAveraged
    export function readAdcAveraged(channel: number, samples: number): number {
        return readAdcNative(channel)
    }

    /**
     * Internal helper, not a block. Measures one period of the TCS3200 output
     * (rising edge to rising edge) in microseconds. Simulator: 0 (no signal).
     * @param pin pin number of the sensor OUT line
     * @param timeoutUs maximum wait in microseconds
     */
    //% shim=fisicabitNative::tcs3200ReadPeriodUs
    export function tcs3200ReadPeriodUs(pin: number, timeoutUs: number): number {
        return 0
    }

    /**
     * Internal helper, not a block. Measures N consecutive TCS3200 periods and
     * returns the average in microseconds. Simulator: 0 (no signal).
     * @param pin pin number of the sensor OUT line
     * @param samples number of periods to measure (1-50)
     * @param timeoutUs maximum wait in microseconds
     */
    //% shim=fisicabitNative::tcs3200ReadBurstUs
    export function tcs3200ReadBurstUs(pin: number, samples: number, timeoutUs: number): number {
        return 0
    }
}
