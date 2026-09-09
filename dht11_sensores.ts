// =============================================================================
//  dht11_sensores.ts — Sensor de temperatura y humedad DHT11
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensor: DHT11 (también compatible con DHT22/AM2302 con ajuste)
//  Protocolo: Single-wire bidireccional (propietario)
//  Alimentación: 3.3V – 5V
//
//  CABLEADO:
//    ┌──────────────────────────────────┐
//    │  DHT11 (3 o 4 pines)            │
//    │  ┌──────────────────────┐        │
//    │  │  VCC  │──── 3V       │        │
//    │  │  DATA │──── P0       │        │  (cualquier pin digital)
//    │  │  GND  │──── GND      │        │
//    │  └──────────────────────┘        │
//    └──────────────────────────────────┘
//
//    ⚠ Se recomienda una resistencia pull-up de 4.7kΩ – 10kΩ
//      entre DATA y VCC. Algunos módulos la incluyen en la PCB.
//
//  PROTOCOLO:
//    1. MCU envía señal de inicio: LOW ≥18ms, luego HIGH ~30μs
//    2. DHT11 responde: LOW ~80μs, HIGH ~80μs
//    3. DHT11 envía 40 bits (5 bytes):
//       - Byte 1: Humedad parte entera
//       - Byte 2: Humedad parte decimal (siempre 0 en DHT11)
//       - Byte 3: Temperatura parte entera
//       - Byte 4: Temperatura parte decimal (siempre 0 en DHT11)
//       - Byte 5: Checksum (suma de bytes 1-4)
//    4. Cada bit: LOW ~50μs, luego HIGH 26-28μs=0, HIGH 70μs=1
//
//  PRECISIÓN:
//    DHT11: Humedad ±5%RH, Temperatura ±2°C
//           Rango: 20-90%RH, 0-50°C
//           Muestreo: máx 1 lectura/segundo
//
//  NOTA: El protocolo requiere timing preciso (<50μs).
//        Usamos el shim C++ medirPulsoNativo para las mediciones
//        críticas, pero la decodificación completa se hace en TS
//        midiendo los pulsos HIGH para cada bit.
// =============================================================================

// Sensor DHT11 como bloque independiente
//% weight=88
//% color=#FF6347
//% icon="\uf043"
//% block="DHT11 — Humedad/Temperatura"
//% groups='["Medición", "Lectura Completa", "Diagnóstico"]'
namespace FisicaBitDHT11 {

    // ── Estado DHT11 ──
    let _dhtUltHumedad = 0      // Última humedad válida (%RH × 10)
    let _dhtUltTemperatura = 0  // Última temperatura válida (°C × 10)
    let _dhtUltLectura = 0      // Timestamp de última lectura (ms)
    let _dhtOk = false          // ¿Última lectura válida?

    // =========================================================================
    // Lectura del protocolo DHT11
    // =========================================================================

    /**
     * Lee los 40 bits del DHT11 usando pulseIn de MakeCode.
     * Retorna true si la lectura es válida (checksum correcto).
     */
    function _dhtLeer(pin: DigitalPin): boolean {
        // ── Señal de inicio ──
        // MCU: LOW por ≥18ms → HIGH → soltar pin (input)
        pins.digitalWritePin(pin, 0)
        basic.pause(20)
        pins.digitalWritePin(pin, 1)
        control.waitMicros(30)
        pins.setPull(pin, PinPullMode.PullUp)

        // ── Respuesta del DHT11 ──
        // DHT11 tira LOW ~80μs, luego HIGH ~80μs
        // Esperamos a que pase la respuesta
        let respLow = pins.pulseIn(pin, PulseValue.Low, 500)
        if (respLow == 0) return false
        let respHigh = pins.pulseIn(pin, PulseValue.High, 500)
        if (respHigh == 0) return false

        // ── Leer 40 bits ──
        // Cada bit: LOW ~50μs (sincronización), luego HIGH
        //   HIGH ~26-28μs → bit 0
        //   HIGH ~70μs    → bit 1
        // Umbral: si HIGH > 40μs → bit 1
        let datos: number[] = [0, 0, 0, 0, 0]

        for (let i = 0; i < 40; i++) {
            // Esperar pulso LOW de sincronización
            let syncLow = pins.pulseIn(pin, PulseValue.Low, 200)
            if (syncLow == 0) return false

            // Medir pulso HIGH (determina el bit)
            let pulseHigh = pins.pulseIn(pin, PulseValue.High, 200)
            if (pulseHigh == 0) return false

            // Decodificar bit
            let byteIdx = i >> 3  // i / 8
            datos[byteIdx] = datos[byteIdx] << 1
            if (pulseHigh > 40) {
                datos[byteIdx] = datos[byteIdx] | 1
            }
        }

        // ── Verificar checksum ──
        let checksum = (datos[0] + datos[1] + datos[2] + datos[3]) & 0xFF
        if (checksum != datos[4]) return false

        // ── Almacenar valores ──
        // DHT11: datos[0] = humedad entera, datos[1] = 0
        //        datos[2] = temp entera, datos[3] = 0
        _dhtUltHumedad = datos[0] * 10 + datos[1]   // %RH × 10
        _dhtUltTemperatura = datos[2] * 10 + datos[3] // °C × 10

        return true
    }

    /**
     * Intenta leer el DHT11, con reintentos si falla.
     * Respeta el intervalo mínimo de 1 segundo entre lecturas.
     */
    function _dhtLeerConReintento(pin: DigitalPin): void {
        // El DHT11 necesita mínimo 1s entre lecturas
        let ahora = input.runningTime()
        if (ahora - _dhtUltLectura < 1100) {
            return  // usar últimos valores en caché
        }

        // Intentar hasta 3 veces
        for (let intento = 0; intento < 3; intento++) {
            if (_dhtLeer(pin)) {
                _dhtOk = true
                _dhtUltLectura = input.runningTime()
                return
            }
            basic.pause(100)
        }
        _dhtOk = false
    }

    // =========================================================================
    // BLOQUES PÚBLICOS — DHT11 Sensor
    // =========================================================================

    /**
     * Lee la humedad relativa del sensor DHT11 (%).
     * Rango: 20 – 90 %RH. Precisión: ±5 %RH.
     * Muestreo: máximo 1 lectura por segundo.
     *
     * Conexión física DHT11 → micro:bit:
     *   VCC (o +)  → 3V
     *   GND (o -)  → GND
     *   DATA (o S) → P16
     *
     * @param pin Pin digital donde está conectado DATA
     */
    //% blockId=fisicabit_dht11_humedad
    //% block="DHT11 humedad (%) en %pin"
    //% group="Medición"
    //% weight=90
    //% pin.defl=DigitalPin.P16
    export function dht11Humedad(pin: DigitalPin): number {
        _dhtLeerConReintento(pin)
        return _dhtUltHumedad / 10
    }

    /**
     * Lee la temperatura del sensor DHT11.
     * Rango: 0 – 50 °C. Precisión: ±2 °C.
     * @param pin Pin digital donde está conectado DATA
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_dht11_temperatura
    //% block="DHT11 temperatura en %pin en %unidad"
    //% group="Medición"
    //% weight=89
    //% pin.defl=DigitalPin.P16
    //% unidad.defl=UnidadTemperatura.Celsius
    export function dht11Temperatura(pin: DigitalPin, unidad: UnidadTemperatura): number {
        _dhtLeerConReintento(pin)
        let tempC = _dhtUltTemperatura / 10.0
        switch (unidad) {
            case UnidadTemperatura.Celsius:
                return Math.round(tempC * 10) / 10
            case UnidadTemperatura.Fahrenheit:
                return Math.round((tempC * 9 / 5 + 32) * 10) / 10
            case UnidadTemperatura.Kelvin:
                return Math.round((tempC + 273.15) * 10) / 10
            default:
                return Math.round(tempC * 10) / 10
        }
    }

    /**
     * Lee humedad y temperatura del DHT11 de una sola vez.
     * Más eficiente que llamar humedad y temperatura por separado
     * ya que una sola lectura del bus devuelve ambos valores.
     * Usa los bloques "DHT11 last humidity" y "DHT11 last temperature"
     * para obtener los valores después de esta lectura.
     * @param pin Pin digital donde está conectado DATA
     */
    //% blockId=fisicabit_dht11_leer
    //% block="DHT11 leer todo en %pin"
    //% group="Lectura Completa"
    //% weight=88
    //% pin.defl=DigitalPin.P16
    export function dht11Leer(pin: DigitalPin): void {
        _dhtLeerConReintento(pin)
    }

    /**
     * Obtiene la última humedad leída (después de dht11Leer).
     */
    //% blockId=fisicabit_dht11_ult_humedad
    //% block="DHT11 última humedad (%)"
    //% group="Lectura Completa"
    //% weight=87
    export function dht11UltHumedad(): number {
        return _dhtUltHumedad / 10
    }

    /**
     * Obtiene la última temperatura leída (después de dht11Leer).
     * @param unidad Unidad de temperatura
     */
    //% blockId=fisicabit_dht11_ult_temp
    //% block="DHT11 última temperatura en %unidad"
    //% group="Lectura Completa"
    //% weight=86
    //% unidad.defl=UnidadTemperatura.Celsius
    export function dht11UltTemperatura(unidad: UnidadTemperatura): number {
        let tempC = _dhtUltTemperatura / 10.0
        switch (unidad) {
            case UnidadTemperatura.Celsius:
                return Math.round(tempC * 10) / 10
            case UnidadTemperatura.Fahrenheit:
                return Math.round((tempC * 9 / 5 + 32) * 10) / 10
            case UnidadTemperatura.Kelvin:
                return Math.round((tempC + 273.15) * 10) / 10
            default:
                return Math.round(tempC * 10) / 10
        }
    }

    /**
     * Indica si la última lectura del DHT11 fue válida.
     * Puede fallar si: cable suelto, sensor no conectado,
     * interferencia eléctrica, o lectura demasiado rápida (<1s).
     */
    //% blockId=fisicabit_dht11_valido
    //% block="DHT11 lectura válida"
    //% group="Diagnóstico"
    //% weight=80
    export function dht11Valido(): boolean {
        return _dhtOk
    }
}
