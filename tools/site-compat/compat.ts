// =============================================================================
// compat.ts — Legacy Spanish API of the fisicabit-usb package (fisicabit.com)
// =============================================================================
// Only shipped in the packages generated for fisicabit.com by
// tools/mirror-site.py. Programs saved on the site, and the sample programs
// the site injects into new projects, were written against the old names
// (FisicaBitSerial.enviar1, FisicaBitSerial.leerSensorInterno, ...). These
// forwarders keep them compiling; they define no blocks (the toolbox shows
// the English API only) and add nothing at run time but one call.
// =============================================================================

/** Legacy names of the FisicaBit USB package; forwards to fisicabitSerial and fisicabitUltrasonic. */
namespace FisicaBitSerial {
    // ── Sending over USB ─────────────────────────────────────────────────────
    /** Legacy alias of fisicabitSerial.send1. */
    export function enviar1(valor: number, ms: number): void { fisicabitSerial.send1(valor, ms) }
    /** Legacy alias of fisicabitSerial.send2. */
    export function enviar2(valor1: number, valor2: number, ms: number): void { fisicabitSerial.send2(valor1, valor2, ms) }
    /** Legacy alias of fisicabitSerial.send3. */
    export function enviar3(valor1: number, valor2: number, valor3: number, ms: number): void { fisicabitSerial.send3(valor1, valor2, valor3, ms) }
    /** Legacy alias of fisicabitSerial.send4. */
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number, ms: number): void { fisicabitSerial.send4(valor1, valor2, valor3, valor4, ms) }
    /** Legacy alias of fisicabitSerial.sendWithoutTime1. */
    export function enviarSinTiempo1(valor: number): void { fisicabitSerial.sendWithoutTime1(valor) }
    /** Legacy alias of fisicabitSerial.sendWithoutTime2. */
    export function enviarSinTiempo2(valor1: number, valor2: number): void { fisicabitSerial.sendWithoutTime2(valor1, valor2) }
    /** Legacy alias of fisicabitSerial.sendWithoutTime3. */
    export function enviarSinTiempo3(valor1: number, valor2: number, valor3: number): void { fisicabitSerial.sendWithoutTime3(valor1, valor2, valor3) }
    /** Legacy alias of fisicabitSerial.sendWithoutTime4. */
    export function enviarSinTiempo4(valor1: number, valor2: number, valor3: number, valor4: number): void { fisicabitSerial.sendWithoutTime4(valor1, valor2, valor3, valor4) }
    /** Legacy alias of fisicabitSerial.sendLine. */
    export function enviarLinea(texto: string): void { fisicabitSerial.sendLine(texto) }
    /** Legacy alias of fisicabitSerial.sendTimestamp. */
    export function enviarTimestamp(activar: boolean): void { fisicabitSerial.sendTimestamp(activar) }
    /** Legacy alias of fisicabitSerial.setDecimals. */
    export function fijarDecimales(decimales: number): void { fisicabitSerial.setDecimals(decimales) }
    /** Legacy alias of fisicabitSerial.resetTime. */
    export function reiniciarTiempo(): void { fisicabitSerial.resetTime() }
    /** Legacy alias of fisicabitSerial.time. */
    export function tiempoSerial(): number { return fisicabitSerial.time() }
    /** Legacy alias of fisicabitSerial.sampleLoop. */
    export function bucleMuestreo(ms: number, cuerpo: () => void): void { fisicabitSerial.sampleLoop(ms, cuerpo) }

    // ── Sensors (the old package kept them in this namespace; the site
    //    package does not ship the "FisicaBit sensors" category, so they are
    //    implemented here with the micro:bit API) ───────────────────────────
    /** Internal micro:bit sensor: 0 temperature, 1-3 acceleration X/Y/Z (mg), 4 light, 5 compass heading, 6 sound level, 7 |a| (mg). */
    export function leerSensorInterno(sensor: number): number {
        switch (sensor) {
            case 0: return input.temperature()
            case 1: return input.acceleration(Dimension.X)
            case 2: return input.acceleration(Dimension.Y)
            case 3: return input.acceleration(Dimension.Z)
            case 4: return input.lightLevel()
            case 5: return input.compassHeading()
            case 6: return input.soundLevel()
            case 7: return input.acceleration(Dimension.Strength)
            default: return 0
        }
    }
    function _analog(pin: number): number {
        if (pin == 1) return pins.analogReadPin(AnalogPin.P1)
        if (pin == 2) return pins.analogReadPin(AnalogPin.P2)
        return pins.analogReadPin(AnalogPin.P0)
    }
    /** Analog reading 0-1023 of P0, P1 or P2 (0, 1, 2). */
    export function leerSensorAnalogico(pin: number): number { return _analog(pin) }
    /** Digital reading 0/1 of pin number 0-20. */
    export function leerSensorDigital(pin: number): number { return pins.digitalReadPin(pin as DigitalPin) }
    /** 10 kΩ NTC (β = 3950) in a divider with 10 kΩ to 3V: temperature in °C (0), °F (1) or K (2). */
    export function leerTemperaturaNTC(pin: number, unidad: number): number {
        let reading = _analog(pin)
        if (reading <= 0) reading = 1
        if (reading >= 1023) reading = 1022
        const rNtc = 10000.0 * reading / (1023 - reading)
        const invT = 1.0 / 298.15 + (1.0 / 3950) * Math.log(rNtc / 10000)
        const tempC = 1.0 / invT - 273.15
        if (unidad == 1) return Math.round((tempC * 9 / 5 + 32) * 10) / 10
        if (unidad == 2) return Math.round((tempC + 273.15) * 10) / 10
        return Math.round(tempC * 10) / 10
    }

    // ── Ultrasonic ───────────────────────────────────────────────────────────
    /** Legacy alias of fisicabitUltrasonic.distance. */
    export function medirDistanciaUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: number): number { return fisicabitUltrasonic.distance(pinTrig, pinEcho, unidad as FbDistanceUnit) }
    /** Legacy alias of fisicabitUltrasonic.distanceSRF05. */
    export function medirDistanciaSRF05(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: number): number { return fisicabitUltrasonic.distanceSRF05(pinTrig, pinEcho, unidad as FbDistanceUnit) }
    /** Legacy alias of fisicabitUltrasonic.rawDistance. */
    export function medirDistanciaUltrasonidoCruda(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: number): number { return fisicabitUltrasonic.rawDistance(pinTrig, pinEcho, unidad as FbDistanceUnit) }
    /** Legacy alias of fisicabitUltrasonic.sendDistance over USB. */
    export function enviarDistanciaUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: number): void { fisicabitUltrasonic.sendDistance(pinTrig, pinEcho, unidad as FbDistanceUnit, FbChannel.USB) }
    /** Legacy alias of fisicabitUltrasonic.sendDistanceSRF05 over USB. */
    export function enviarDistanciaSRF05(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: number): void { fisicabitUltrasonic.sendDistanceSRF05(pinTrig, pinEcho, unidad as FbDistanceUnit, FbChannel.USB) }
    /** Legacy alias of fisicabitUltrasonic.calibrate. */
    export function calibrarUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin, distanciaMm: number): void { fisicabitUltrasonic.calibrate(pinTrig, pinEcho, distanciaMm) }
    /** Legacy alias of fisicabitUltrasonic.echoValid. */
    export function ecoUltrasonidoValido(): boolean { return fisicabitUltrasonic.echoValid() }
    /** Legacy alias of fisicabitUltrasonic.status. */
    export function estadoUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin): string { return fisicabitUltrasonic.status(pinTrig, pinEcho) }
    /** Legacy alias of fisicabitUltrasonic.setRange. */
    export function fijarAlcanceUltrasonido(cm: number): void { fisicabitUltrasonic.setRange(cm) }
    /** Legacy alias of fisicabitUltrasonic.setFilter. */
    export function fijarFiltroUltrasonido(filtro: number): void { fisicabitUltrasonic.setFilter(filtro as FbUltrasonicFilter) }
    /** Legacy alias of fisicabitUltrasonic.setSampleRate. */
    export function fijarFrecuenciaUltrasonido(hz: number): void { fisicabitUltrasonic.setSampleRate(hz) }
    /** Legacy alias of fisicabitUltrasonic.setLimits. */
    export function fijarRangoUltrasonido(minMm: number, maxMm: number): void { fisicabitUltrasonic.setLimits(minMm, maxMm) }
    /** Legacy alias of fisicabitUltrasonic.setMaxStep. */
    export function fijarSaltoMaximoUltrasonido(saltoMaxMm: number): void { fisicabitUltrasonic.setMaxStep(saltoMaxMm) }
    /** Legacy alias of fisicabitUltrasonic.setAirTemperature. */
    export function fijarTemperaturaAireUltrasonido(gradosC: number): void { fisicabitUltrasonic.setAirTemperature(gradosC) }
    /** Legacy alias of fisicabitUltrasonic.actualSampleRate. */
    export function frecuenciaRealUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin): number { return fisicabitUltrasonic.actualSampleRate(pinTrig, pinEcho) }
    /** Legacy alias of fisicabitUltrasonic.lastEchoTime. */
    export function tiempoUltimoEcoUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin): number { return fisicabitUltrasonic.lastEchoTime(pinTrig, pinEcho) }
}

/** Legacy name of fisicabitData (old packages). */
namespace FisicaBitDatos {
    /** Legacy alias of fisicabitData.format. */
    export function formatear(v: number, decimales: number): string { return fisicabitData.format(v, decimales) }
}
