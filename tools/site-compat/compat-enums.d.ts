// Legacy enum names of the old fisicabit-usb / fisicabit-bt packages used by
// fisicabit.com. Same numeric values as the Fb* enums of the extension, so a
// program written with these names keeps working; no blocks are defined here.

declare const enum TipoSensorInterno {
    Temperatura = 0,
    AcelerometroX = 1,
    AcelerometroY = 2,
    AcelerometroZ = 3,
    NivelLuz = 4,
    Brujula = 5,
    NivelSonido = 6,
    FuerzaG = 7
}

declare const enum UnidadTemperatura {
    Celsius = 0,
    Fahrenheit = 1,
    Kelvin = 2
}

declare const enum UnidadDistancia {
    Centimetros = 0,
    Pulgadas = 1,
    Milimetros = 2,
    Metros = 3
}

declare const enum FiltroUltrasonido {
    Ninguno = 1,
    Suave = 3,
    Medio = 5,
    Fuerte = 7
}

declare const enum PinAnalogico {
    P0 = 0,
    P1 = 1,
    P2 = 2
}
