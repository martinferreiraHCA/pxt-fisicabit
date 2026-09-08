// Enumerations for the FisicaBit extension

declare const enum TipoSensorInterno {
    //% block="temperature"
    Temperatura = 0,
    //% block="accelerometer X"
    AcelerometroX = 1,
    //% block="accelerometer Y"
    AcelerometroY = 2,
    //% block="accelerometer Z"
    AcelerometroZ = 3,
    //% block="light level"
    NivelLuz = 4,
    //% block="compass (heading)"
    Brujula = 5,
    //% block="sound level (v2)"
    NivelSonido = 6,
    //% block="force G"
    FuerzaG = 7
}

declare const enum TipoSensorExterno {
    //% block="potentiometer (analog)"
    Potenciometro = 0,
    //% block="LDR - light (analog)"
    LDR = 1,
    //% block="NTC temp sensor (analog)"
    NTC = 2,
    //% block="ultrasonic HC-SR04"
    Ultrasonido = 3,
    //% block="DHT11 temp+humidity"
    DHT11 = 4,
    //% block="PIR motion sensor"
    PIR = 5,
    //% block="infrared sensor"
    Infrarrojo = 6,
    //% block="DS18B20 temperature"
    DS18B20 = 7
}

declare const enum UnidadTemperatura {
    //% block="°C (Celsius)"
    Celsius = 0,
    //% block="°F (Fahrenheit)"
    Fahrenheit = 1,
    //% block="K (Kelvin)"
    Kelvin = 2
}

declare const enum UnidadDistancia {
    //% block="cm"
    Centimetros = 0,
    //% block="inches"
    Pulgadas = 1,
    //% block="mm"
    Milimetros = 2
}

declare const enum FiltroUltrasonido {
    //% block="none (1 reading)"
    Ninguno = 1,
    //% block="light (median of 3)"
    Suave = 3,
    //% block="medium (median of 5)"
    Medio = 5,
    //% block="strong (median of 7)"
    Fuerte = 7
}

declare const enum PinAnalogico {
    //% block="P0"
    P0 = 0,
    //% block="P1"
    P1 = 1,
    //% block="P2"
    P2 = 2
}

declare const enum RangoAcelerometro {
    //% block="±2g"
    Rango2G = 2,
    //% block="±4g"
    Rango4G = 4,
    //% block="±8g"
    Rango8G = 8
}

declare const enum EjeAceleracion {
    //% block="X (left/right)"
    X = 0,
    //% block="Y (front/back)"
    Y = 1,
    //% block="Z (up/down)"
    Z = 2,
    //% block="|a| magnitude"
    Magnitud = 3,
    //% block="vertical (along gravity)"
    Vertical = 4
}

declare const enum ModoBarrera {
    //% block="digital"
    Digital = 0,
    //% block="analog"
    Analogico = 1
}

declare const enum TipoBarreraOptica {
    //% block="FC-33 (slot module)"
    FC_33 = 0,
    //% block="IR DIY (emitter+receiver LED)"
    IR_DIY = 1
}

declare const enum FlancoBarrera {
    //% block="falling (object enters)"
    Descendente = 0,
    //% block="rising (object exits)"
    Ascendente = 1
}

declare const enum UnidadTiempo {
    //% block="μs (microseconds)"
    Microsegundos = 0,
    //% block="ms (milliseconds)"
    Milisegundos = 1,
    //% block="s (seconds)"
    Segundos = 2
}

declare const enum FrecuenciaMuestreo {
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

declare const enum ModeloToF {
    //% block="TOF050C (50 cm)"
    TOF050C = 0,
    //% block="TOF200C (2 m)"
    TOF200C = 1,
    //% block="TOF400C (4 m)"
    TOF400C = 2
}

declare const enum FiltroToF {
    //% block="none"
    Ninguno = 1,
    //% block="low (median of 3)"
    Bajo = 3,
    //% block="medium (median of 5)"
    Medio = 5,
    //% block="high (median of 7)"
    Alto = 7
}

declare const enum ModoToF {
    //% block="stable (accurate)"
    Estable = 0,
    //% block="fast (high speed)"
    Rapida = 1
}

declare const enum UnidadPresion {
    //% block="hPa (hectopascal)"
    hPa = 0,
    //% block="Pa (pascal)"
    Pa = 1,
    //% block="mmHg"
    mmHg = 2,
    //% block="atm"
    Atm = 3
}

declare const enum DireccionBME280 {
    //% block="0x76 (SDO→GND)"
    Addr76 = 0x76,
    //% block="0x77 (SDO→VCC)"
    Addr77 = 0x77
}

declare const enum DatosDHT11 {
    //% block="humidity (%)"
    Humedad = 0,
    //% block="temperature (°C)"
    Temperatura = 1
}

declare const enum CanalTCS230 {
    //% block="Red"
    Rojo = 0,
    //% block="Green"
    Verde = 1,
    //% block="Blue"
    Azul = 2,
    //% block="Clear"
    Clear = 3
}

declare const enum EscaladoTCS230 {
    //% block="off (0%)"
    Apagado = 0,
    //% block="2%"
    Dos = 1,
    //% block="20%"
    Veinte = 2,
    //% block="100%"
    Cien = 3
}

declare const enum FuenteMicrofono {
    //% block="external electret (P0)"
    ExternoP0 = 0,
    //% block="external electret (P1)"
    ExternoP1 = 1,
    //% block="external electret (P2)"
    ExternoP2 = 2,
    //% block="internal microphone (v2, level only)"
    InternoV2 = 3
}

declare const enum MetodoFrecuencia {
    //% block="zero-crossing (fast)"
    CrucesCero = 0,
    //% block="autocorrelation (precise, single tone)"
    Autocorrelacion = 1,
    //% block="Goertzel (locked to target Hz)"
    Goertzel = 2
}

declare const enum TasaMuestreoAudio {
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

declare const enum TamanoBufferAudio {
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

declare const enum UnidadMasa {
    //% block="g (grams)"
    Gramos = 0,
    //% block="kg (kilograms)"
    Kilogramos = 1
}

declare const enum GananciaHX711 {
    //% block="128 (channel A, default)"
    G128 = 25,
    //% block="64 (channel A)"
    G64 = 27,
    //% block="32 (channel B)"
    G32 = 26
}

declare const enum VariableDoppler {
    //% block="source velocity (+ approaching)"
    VelocidadFuente = 0,
    //% block="observer velocity (+ approaching)"
    VelocidadObservador = 1
}

declare const enum UnidadVelocidad {
    //% block="m/s"
    MetrosPorSegundo = 0,
    //% block="km/h"
    KilometrosPorHora = 1
}
