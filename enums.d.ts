// Enumerations for the FisicaBit extension (global, prefixed "Fb")

/** Built-in micro:bit sensors that can be read as a single value. */
declare const enum FbInternalSensor {
    //% block="temperature"
    Temperature = 0,
    //% block="accelerometer X"
    AccelerometerX = 1,
    //% block="accelerometer Y"
    AccelerometerY = 2,
    //% block="accelerometer Z"
    AccelerometerZ = 3,
    //% block="light level"
    LightLevel = 4,
    //% block="compass (heading)"
    Compass = 5,
    //% block="sound level (v2)"
    SoundLevel = 6,
    //% block="force G"
    GForce = 7
}

/** External sensors supported by the extension. */
declare const enum FbExternalSensor {
    //% block="potentiometer (analog)"
    Potentiometer = 0,
    //% block="LDR - light (analog)"
    LDR = 1,
    //% block="NTC temp sensor (analog)"
    NTC = 2,
    //% block="ultrasonic HC-SR04"
    Ultrasonic = 3,
    //% block="DHT11 temp+humidity"
    DHT11 = 4,
    //% block="PIR motion sensor"
    PIR = 5,
    //% block="infrared sensor"
    Infrared = 6,
    //% block="DS18B20 temperature"
    DS18B20 = 7,
    //% block="MAX6675 thermocouple K"
    MAX6675 = 8
}

/** Temperature units. */
declare const enum FbTemperatureUnit {
    //% block="°C (Celsius)"
    Celsius = 0,
    //% block="°F (Fahrenheit)"
    Fahrenheit = 1,
    //% block="K (Kelvin)"
    Kelvin = 2
}

/** DS18B20 conversion resolution (value = number of bits). */
declare const enum FbDS18B20Resolution {
    //% block="9 bits (0.5 °C, 94 ms)"
    Bits9 = 9,
    //% block="10 bits (0.25 °C, 188 ms)"
    Bits10 = 10,
    //% block="11 bits (0.125 °C, 375 ms)"
    Bits11 = 11,
    //% block="12 bits (0.0625 °C, 750 ms)"
    Bits12 = 12
}

/** Distance units. */
declare const enum FbDistanceUnit {
    //% block="cm"
    Centimeters = 0,
    //% block="inches"
    Inches = 1,
    //% block="mm"
    Millimeters = 2,
    //% block="m"
    Meters = 3
}

/** Median filter strength for ultrasonic readings (value = window size). */
declare const enum FbUltrasonicFilter {
    //% block="none (1 reading)"
    None = 1,
    //% block="light (median of 3)"
    Light = 3,
    //% block="medium (median of 5)"
    Medium = 5,
    //% block="strong (median of 7)"
    Strong = 7
}

/** Analog-capable edge connector pins. */
declare const enum FbAnalogPin {
    //% block="P0"
    P0 = 0,
    //% block="P1"
    P1 = 1,
    //% block="P2"
    P2 = 2
}

/** Accelerometer full-scale range (value = g). */
declare const enum FbAccelerometerRange {
    //% block="±2g"
    Range2G = 2,
    //% block="±4g"
    Range4G = 4,
    //% block="±8g"
    Range8G = 8
}

/** Accelerometer sample rate (value = period in ms). */
declare const enum FbAccelerometerRate {
    //% block="100 Hz (10 ms)"
    Hz100 = 10,
    //% block="200 Hz (5 ms, recommended)"
    Hz200 = 5,
    //% block="400 Hz (2.5 ms, fast impacts)"
    Hz400 = 2
}

/** Moving-average smoothing for the accelerometer (value = number of samples). */
declare const enum FbAccelerometerSmoothing {
    //% block="none (raw sample)"
    None = 1,
    //% block="light (5 samples)"
    Light = 5,
    //% block="medium (10 samples, recommended)"
    Medium = 10,
    //% block="strong (20 samples)"
    Strong = 20,
    //% block="very strong (40 samples)"
    VeryStrong = 40
}

/** Channel used to send data to fisicabit.com. */
declare const enum FbChannel {
    //% block="USB"
    USB = 0,
    //% block="Bluetooth"
    Bluetooth = 1
}

/** Acceleration axis or derived quantity. */
declare const enum FbAccelerationAxis {
    //% block="X (left/right)"
    X = 0,
    //% block="Y (front/back)"
    Y = 1,
    //% block="Z (up/down)"
    Z = 2,
    //% block="|a| magnitude"
    Magnitude = 3,
    //% block="vertical (along gravity)"
    Vertical = 4
}

/** How a photogate (light barrier) output is read. */
declare const enum FbGateMode {
    //% block="digital"
    Digital = 0,
    //% block="analog"
    Analog = 1
}

/** Photogate hardware type. */
declare const enum FbPhotogateType {
    //% block="FC-33 (slot module)"
    FC33 = 0,
    //% block="IR DIY (emitter+receiver LED)"
    IRDIY = 1
}

/** Signal edge that triggers a photogate event. */
declare const enum FbGateEdge {
    //% block="falling (object enters)"
    Falling = 0,
    //% block="rising (object exits)"
    Rising = 1
}

/** Time units. */
declare const enum FbTimeUnit {
    //% block="μs (microseconds)"
    Microseconds = 0,
    //% block="ms (milliseconds)"
    Milliseconds = 1,
    //% block="s (seconds)"
    Seconds = 2
}

/** Sample rate presets for sending data (value = period in ms). */
declare const enum FbSampleRate {
    //% block="1 Hz (1 sample per second)"
    Hz1 = 1000,
    //% block="2 Hz"
    Hz2 = 500,
    //% block="5 Hz"
    Hz5 = 200,
    //% block="10 Hz (recommended)"
    Hz10 = 100,
    //% block="20 Hz"
    Hz20 = 50,
    //% block="50 Hz (USB, fast loop)"
    Hz50 = 20,
    //% block="100 Hz (USB, fast loop)"
    Hz100 = 10
}

/** Time-of-flight laser distance module models. */
declare const enum FbToFModel {
    //% block="TOF050C (VL6180X, 2-50 cm)"
    TOF050C = 0,
    //% block="TOF200C (VL53L0X, 3-200 cm)"
    TOF200C = 1,
    //% block="TOF400C (VL53L1X, 4-400 cm)"
    TOF400C = 2,
    //% block="GY-VL53L0XV2 (VL53L0X, 3-200 cm)"
    VL53L0XV2 = 3,
    //% block="auto-detect module"
    Auto = 4
}

/** Median filter strength for ToF readings (value = window size). */
declare const enum FbToFFilter {
    //% block="none"
    None = 1,
    //% block="low (median of 3)"
    Low = 3,
    //% block="medium (median of 5)"
    Medium = 5,
    //% block="high (median of 7)"
    High = 7
}

/** ToF ranging mode (speed vs. noise trade-off). */
declare const enum FbToFMode {
    //% block="stable (30 Hz, full range)"
    Stable = 0,
    //% block="fast (50 Hz)"
    Fast = 1,
    //% block="precise (10 Hz, lowest noise)"
    Precise = 2
}

/** Pressure units. */
declare const enum FbPressureUnit {
    //% block="hPa (hectopascal)"
    hPa = 0,
    //% block="Pa (pascal)"
    Pa = 1,
    //% block="mmHg"
    mmHg = 2,
    //% block="atm"
    Atm = 3
}

/** BME280 I2C address (selected by the SDO pin). */
declare const enum FbBME280Address {
    //% block="0x76 (SDO→GND)"
    Addr76 = 0x76,
    //% block="0x77 (SDO→VCC)"
    Addr77 = 0x77
}

/** Quantities provided by the DHT11 sensor. */
declare const enum FbDHT11Data {
    //% block="humidity (%)"
    Humidity = 0,
    //% block="temperature (°C)"
    Temperature = 1
}

/** TCS230/TCS3200 color filter channel. */
declare const enum FbTCS230Channel {
    //% block="red"
    Red = 0,
    //% block="green"
    Green = 1,
    //% block="blue"
    Blue = 2,
    //% block="clear"
    Clear = 3
}

/** TCS230/TCS3200 output frequency scaling (S0/S1 pins). */
declare const enum FbTCS230Scaling {
    //% block="off (0%)"
    Off = 0,
    //% block="2%"
    Scale2 = 1,
    //% block="20%"
    Scale20 = 2,
    //% block="100%"
    Scale100 = 3
}

/** Microphone input used for sound measurements. */
declare const enum FbMicrophoneSource {
    //% block="external electret (P0)"
    ExternalP0 = 0,
    //% block="external electret (P1)"
    ExternalP1 = 1,
    //% block="external electret (P2)"
    ExternalP2 = 2,
    //% block="internal microphone (v2, level only)"
    InternalV2 = 3
}

/** Frequency estimation algorithm. */
declare const enum FbFrequencyMethod {
    //% block="zero-crossing (fast)"
    ZeroCrossing = 0,
    //% block="autocorrelation (precise, single tone)"
    Autocorrelation = 1,
    //% block="Goertzel (locked to target Hz)"
    Goertzel = 2
}

/** Audio sample rate (value = Hz). */
declare const enum FbAudioSampleRate {
    //% block="2 kHz (low freq, DC–800 Hz)"
    F2kHz = 2000,
    //% block="4 kHz (40–1600 Hz)"
    F4kHz = 4000,
    //% block="8 kHz (recommended, 80–3200 Hz)"
    F8kHz = 8000,
    //% block="11 kHz (voice, 110–4400 Hz)"
    F11kHz = 11000,
    //% block="16 kHz (wide, 160–6400 Hz)"
    F16kHz = 16000
}

/** Audio capture buffer size (value = number of samples). */
declare const enum FbAudioBufferSize {
    //% block="64 samples (fast)"
    N64 = 64,
    //% block="128 samples"
    N128 = 128,
    //% block="256 samples (recommended)"
    N256 = 256,
    //% block="512 samples"
    N512 = 512,
    //% block="1024 samples (max precision)"
    N1024 = 1024
}

/** Mass units. */
declare const enum FbMassUnit {
    //% block="g (grams)"
    Grams = 0,
    //% block="kg (kilograms)"
    Kilograms = 1
}

/** HX711 gain / channel selection (value = number of extra clock pulses + 24). */
declare const enum FbHX711Gain {
    //% block="128 (channel A, default)"
    G128 = 25,
    //% block="64 (channel A)"
    G64 = 27,
    //% block="32 (channel B)"
    G32 = 26
}

/** Unknown variable to solve for in the Doppler equation. */
declare const enum FbDopplerVariable {
    //% block="source velocity (+ approaching)"
    SourceVelocity = 0,
    //% block="observer velocity (+ approaching)"
    ObserverVelocity = 1
}

/** Speed units. */
declare const enum FbSpeedUnit {
    //% block="m/s"
    MetersPerSecond = 0,
    //% block="km/h"
    KilometersPerHour = 1
}
