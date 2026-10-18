// Programa de verificación de compilación (no forma parte de la extensión).
// Usa un bloque de cada módulo para que el compilador nativo emita todas las
// funciones C++: MakeCode admite como máximo 4 parámetros por función nativa y
// la extensión sola no lo detecta (sólo se emiten las funciones usadas).
// Compilar en un proyecto que dependa de la extensión: debe dar EXIT 0.

// Programa de verificación: usa un bloque de cada módulo para que el compilador
// nativo emita todas las funciones C++ (máx. 4 parámetros por función).
FisicaBitBT.inicioRapido()
FisicaBitCinematica.iniciar()
FisicaBitToF.tofIniciarPrecision(ModeloToF.TOF200C, DigitalPin.P20, DigitalPin.P19, DigitalPin.P8)
basic.forever(function () {
    FisicaBitSerial.enviar3(
        FisicaBitHCSR04.medirDistanciaUltrasonido(DigitalPin.P8, DigitalPin.P12, UnidadDistancia.Centimetros),
        FisicaBitToF.tofDistancia(ModeloToF.TOF400C, DigitalPin.P14, DigitalPin.P13, UnidadDistancia.Centimetros),
        FisicaBitDS18B20.temperatura(DigitalPin.P0, UnidadTemperatura.Celsius), 100)
    FisicaBitHCSR04.enviarDistanciaSRF05(DigitalPin.P1, DigitalPin.P2, UnidadDistancia.Centimetros, MedioEnvio.USB)
    FisicaBitToF.tofEnviarDistancia(ModeloToF.Auto, DigitalPin.P20, DigitalPin.P19, UnidadDistancia.Milimetros, MedioEnvio.Bluetooth)
    FisicaBitCinematica.enviarVelocidadAceleracion(EjeAceleracion.Magnitud, MedioEnvio.USB, 100)
    basic.showString(FisicaBitHCSR04.estadoUltrasonido(DigitalPin.P8, DigitalPin.P12))
    FisicaBitHCSR04.calibrarUltrasonido(DigitalPin.P8, DigitalPin.P12, 300)
    FisicaBitToF.tofCalibrarOffset(DigitalPin.P20, DigitalPin.P19, 100)
    basic.showNumber(FisicaBit.medirTiempoBarreraNativo(1, 2, ModoBarrera.Digital, 512, 512, 5000000))
    basic.showNumber(FisicaBitToF.tofFrecuenciaReal(DigitalPin.P20, DigitalPin.P19) + FisicaBitHCSR04.frecuenciaRealUltrasonido(DigitalPin.P8, DigitalPin.P12))
})
