// =============================================================================
// enums.d.ts — Enumeraciones para la extensión FisicaBit
// =============================================================================
// Estas enumeraciones se usan tanto en TypeScript como en los bloques MakeCode.
// MakeCode las reconoce automáticamente y las muestra como desplegables en el editor.
// =============================================================================

// -----------------------------------------------------------------------------
// TipoSensorInterno: Sensores que ya vienen integrados en la placa micro:bit
// -----------------------------------------------------------------------------
// micro:bit v1: tiene acelerómetro y magnetómetro (brújula)
// micro:bit v2: añade micrófono, altavoz, sensor táctil (logo), temperatura
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// TipoSensorExterno: Sensores comunes que se conectan a los pines GPIO
// -----------------------------------------------------------------------------
// Cada sensor usa un protocolo diferente:
//   - Analógico: lectura directa del voltaje (0-1023) en pines P0, P1, P2
//   - Digital: lectura HIGH/LOW en cualquier pin GPIO
//   - I2C: bus de datos compartido (pines P19=SCL, P20=SDA)
//   - OneWire: protocolo de un solo cable (cualquier pin digital)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// UnidadTemperatura: Para conversión de unidades
// -----------------------------------------------------------------------------
declare const enum UnidadTemperatura {
    //% block="°C (Celsius)"
    Celsius = 0,
    //% block="°F (Fahrenheit)"
    Fahrenheit = 1,
    //% block="K (Kelvin)"
    Kelvin = 2
}

// -----------------------------------------------------------------------------
// UnidadDistancia: Para el sensor ultrasónico
// -----------------------------------------------------------------------------
declare const enum UnidadDistancia {
    //% block="cm"
    Centimetros = 0,
    //% block="pulgadas"
    Pulgadas = 1,
    //% block="mm"
    Milimetros = 2
}

// -----------------------------------------------------------------------------
// PinAnalogico: Pines que soportan lectura analógica en micro:bit
// -----------------------------------------------------------------------------
// Solo P0, P1 y P2 tienen conversor analógico-digital (ADC)
// Los demás pines solo son digitales
// -----------------------------------------------------------------------------
declare const enum PinAnalogico {
    //% block="P0"
    P0 = 0,
    //% block="P1"
    P1 = 1,
    //% block="P2"
    P2 = 2
}

// -----------------------------------------------------------------------------
// RangoMedicion: Rango del acelerómetro configurable
// -----------------------------------------------------------------------------
declare const enum RangoAcelerometro {
    //% block="±2g"
    Rango2G = 2,
    //% block="±4g"
    Rango4G = 4,
    //% block="±8g"
    Rango8G = 8
}

// -----------------------------------------------------------------------------
// ModoBarrera: Cómo leer la señal de la barrera óptica
// -----------------------------------------------------------------------------
// DIGITAL: El sensor tiene salida digital (HIGH/LOW con comparador integrado)
//          Ejemplo: FC-33 (tiene potenciómetro de ajuste en la placa)
// ANALOGICO: Lectura cruda del fototransistor/fotodiodo (0-1023)
//            Ejemplo: LED IR emisor + receptor con divisor de voltaje
//            Permite ajustar el umbral por software desde MakeCode
// -----------------------------------------------------------------------------
declare const enum ModoBarrera {
    //% block="Digital"
    Digital = 0,
    //% block="Analógico"
    Analogico = 1
}

// -----------------------------------------------------------------------------
// TipoBarreraOptica: Modelo de sensor utilizado
// -----------------------------------------------------------------------------
// FC_33:   Módulo comercial con comparador LM393 integrado
//          - Tiene ranura de 10mm para paso de objetos
//          - Salida digital (con ajuste por potenciómetro HW)
//          - Alimentación: 3.3V-5V
//          - Pin OUT: LOW cuando se interrumpe el haz
//
// IR_DIY:  Montaje casero con LED IR + fototransistor
//          - Distancia ajustable entre emisor y receptor
//          - Señal analógica proporcional a la luz recibida
//          - Necesita divisor de voltaje para leer con ADC
//          - Más flexible, ideal para experimentos de física
// -----------------------------------------------------------------------------
declare const enum TipoBarreraOptica {
    //% block="FC-33 (módulo ranura)"
    FC_33 = 0,
    //% block="IR DIY (LED emisor+receptor)"
    IR_DIY = 1
}

// -----------------------------------------------------------------------------
// FlancoBarrera: Qué transición activa la barrera
// -----------------------------------------------------------------------------
// Cuando un objeto pasa por la barrera:
//   - FC-33:  la señal va HIGH→LOW (objeto bloquea el haz)
//   - IR DIY: la señal analógica BAJA (menos luz llega al receptor)
//
// DESCENDENTE = el objeto ENTRA en la barrera (bloquea luz)
// ASCENDENTE  = el objeto SALE de la barrera (luz se restaura)
// -----------------------------------------------------------------------------
declare const enum FlancoBarrera {
    //% block="Descendente (objeto entra)"
    Descendente = 0,
    //% block="Ascendente (objeto sale)"
    Ascendente = 1
}

// -----------------------------------------------------------------------------
// UnidadTiempo: Unidades para mostrar el tiempo medido
// -----------------------------------------------------------------------------
declare const enum UnidadTiempo {
    //% block="μs (microsegundos)"
    Microsegundos = 0,
    //% block="ms (milisegundos)"
    Milisegundos = 1,
    //% block="s (segundos)"
    Segundos = 2
}
