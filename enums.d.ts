// Enumerations for the FisicaBit extension

declare const enum TipoSensorInterno {
    //% block="Temperatura"
    Temperatura = 0,
    //% block="Acelerómetro X"
    AcelerometroX = 1,
    //% block="Acelerómetro Y"
    AcelerometroY = 2,
    //% block="Acelerómetro Z"
    AcelerometroZ = 3,
    //% block="Nivel de Luz"
    NivelLuz = 4,
    //% block="Brújula (heading)"
    Brujula = 5,
    //% block="Nivel Sonido (v2)"
    NivelSonido = 6,
    //% block="Fuerza G"
    FuerzaG = 7
}

declare const enum TipoSensorExterno {
    //% block="Potenciómetro (Analógico)"
    Potenciometro = 0,
    //% block="LDR - Luz (Analógico)"
    LDR = 1,
    //% block="Sensor Temp NTC (Analógico)"
    NTC = 2,
    //% block="Ultrasonido HC-SR04"
    Ultrasonido = 3,
    //% block="DHT11 Temp+Humedad"
    DHT11 = 4,
    //% block="Sensor PIR Movimiento"
    PIR = 5,
    //% block="Sensor Infrarrojo"
    Infrarrojo = 6,
    //% block="DS18B20 Temperatura"
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
    //% block="pulgadas"
    Pulgadas = 1,
    //% block="mm"
    Milimetros = 2
}

declare const enum FiltroUltrasonido {
    //% block="ninguno (1 lectura)"
    Ninguno = 1,
    //% block="suave (mediana de 3)"
    Suave = 3,
    //% block="medio (mediana de 5)"
    Medio = 5,
    //% block="fuerte (mediana de 7)"
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
    //% block="X (izquierda/derecha)"
    X = 0,
    //% block="Y (adelante/atrás)"
    Y = 1,
    //% block="Z (arriba/abajo)"
    Z = 2,
    //% block="|a| módulo"
    Magnitud = 3,
    //% block="vertical (según la gravedad)"
    Vertical = 4
}

declare const enum ModoBarrera {
    //% block="Digital"
    Digital = 0,
    //% block="Analógico"
    Analogico = 1
}

declare const enum TipoBarreraOptica {
    //% block="FC-33 (módulo ranura)"
    FC_33 = 0,
    //% block="IR DIY (LED emisor+receptor)"
    IR_DIY = 1
}

declare const enum FlancoBarrera {
    //% block="Descendente (objeto entra)"
    Descendente = 0,
    //% block="Ascendente (objeto sale)"
    Ascendente = 1
}

declare const enum UnidadTiempo {
    //% block="μs (microsegundos)"
    Microsegundos = 0,
    //% block="ms (milisegundos)"
    Milisegundos = 1,
    //% block="s (segundos)"
    Segundos = 2
}

declare const enum FrecuenciaMuestreo {
    //% block="1 Hz (1 muestra por segundo)"
    Hz1 = 1000,
    //% block="2 Hz"
    Hz2 = 500,
    //% block="5 Hz"
    Hz5 = 200,
    //% block="10 Hz (recomendado)"
    Hz10 = 100,
    //% block="20 Hz"
    Hz20 = 50,
    //% block="50 Hz (USB, bucle rápido)"
    Hz50 = 20,
    //% block="100 Hz (USB, bucle rápido)"
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
    //% block="ninguno"
    Ninguno = 1,
    //% block="bajo (mediana de 3)"
    Bajo = 3,
    //% block="medio (mediana de 5)"
    Medio = 5,
    //% block="alto (mediana de 7)"
    Alto = 7
}

declare const enum ModoToF {
    //% block="estable (preciso)"
    Estable = 0,
    //% block="rápida (alta velocidad)"
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
    //% block="humedad (%)"
    Humedad = 0,
    //% block="temperatura (°C)"
    Temperatura = 1
}

declare const enum CanalTCS230 {
    //% block="Rojo"
    Rojo = 0,
    //% block="Verde"
    Verde = 1,
    //% block="Azul"
    Azul = 2,
    //% block="Clear"
    Clear = 3
}

declare const enum EscaladoTCS230 {
    //% block="apagado (0%)"
    Apagado = 0,
    //% block="2%"
    Dos = 1,
    //% block="20%"
    Veinte = 2,
    //% block="100%"
    Cien = 3
}

declare const enum FuenteMicrofono {
    //% block="electret externo (P0)"
    ExternoP0 = 0,
    //% block="electret externo (P1)"
    ExternoP1 = 1,
    //% block="electret externo (P2)"
    ExternoP2 = 2,
    //% block="micrófono interno (v2, sólo nivel)"
    InternoV2 = 3
}

declare const enum MetodoFrecuencia {
    //% block="cruces por cero (rápido)"
    CrucesCero = 0,
    //% block="autocorrelación (preciso, tono único)"
    Autocorrelacion = 1,
    //% block="Goertzel (fijado a Hz objetivo)"
    Goertzel = 2
}

declare const enum TasaMuestreoAudio {
    //% block="2 kHz (baja frecuencia, DC–800 Hz)"
    F2kHz = 2000,
    //% block="4 kHz (40–1600 Hz)"
    F4kHz = 4000,
    //% block="8 kHz (recomendado, 80–3200 Hz)"
    F8kHz = 8000,
    //% block="11 kHz (voz, 110–4400 Hz)"
    F11kHz = 11000,
    //% block="16 kHz (amplio, 160–6400 Hz)"
    F16kHz = 16000
}

declare const enum TamanoBufferAudio {
    //% block="64 muestras (rápido)"
    N64 = 64,
    //% block="128 muestras"
    N128 = 128,
    //% block="256 muestras (recomendado)"
    N256 = 256,
    //% block="512 muestras"
    N512 = 512,
    //% block="1024 muestras (máxima precisión)"
    N1024 = 1024
}

declare const enum UnidadMasa {
    //% block="g (gramos)"
    Gramos = 0,
    //% block="kg (kilogramos)"
    Kilogramos = 1
}

declare const enum GananciaHX711 {
    //% block="128 (canal A, por defecto)"
    G128 = 25,
    //% block="64 (canal A)"
    G64 = 27,
    //% block="32 (canal B)"
    G32 = 26
}

declare const enum VariableDoppler {
    //% block="velocidad de la fuente (+ acercándose)"
    VelocidadFuente = 0,
    //% block="velocidad del observador (+ acercándose)"
    VelocidadObservador = 1
}

declare const enum UnidadVelocidad {
    //% block="m/s"
    MetrosPorSegundo = 0,
    //% block="km/h"
    KilometrosPorHora = 1
}
