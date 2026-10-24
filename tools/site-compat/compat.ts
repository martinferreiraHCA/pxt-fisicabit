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

/** Legacy names of the FisicaBit USB package; forwards to fisicabitSerial, fisicabit and fisicabitUltrasonic. */
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

    // ── Sensors (old package kept them in this namespace) ────────────────────
    /** Legacy alias of fisicabit.readInternalSensor. */
    export function leerSensorInterno(sensor: number): number { return fisicabit.readInternalSensor(sensor as FbInternalSensor) }
    /** Legacy alias of fisicabit.readAnalogSensor. */
    export function leerSensorAnalogico(pin: number): number { return fisicabit.readAnalogSensor(pin as FbAnalogPin) }
    /** Legacy alias of fisicabit.readDigitalSensor. */
    export function leerSensorDigital(pin: number): number { return fisicabit.readDigitalSensor(pin) }
    /** Legacy alias of fisicabit.readNtcTemperature. */
    export function leerTemperaturaNTC(pin: number, unidad: number): number { return fisicabit.readNtcTemperature(pin as FbAnalogPin, unidad as FbTemperatureUnit) }

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
