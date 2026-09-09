// =============================================================================
//  hcsr04_sensores.ts — Sensor ultrasónico de distancia HC-SR04
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensor: HC-SR04 (distancia por ultrasonido)
//  Rango: 2 cm – 400 cm
//  Frecuencia: 40 kHz
//
//  CÓMO FUNCIONA:
//    1. Se envía un pulso HIGH de 10μs por el pin TRIG
//    2. El sensor emite 8 pulsos ultrasónicos a 40kHz
//    3. Los pulsos rebotan en el objeto y vuelven al sensor
//    4. El pin ECHO se pone HIGH durante el tiempo de ida y vuelta
//    5. distancia = (tiempo_μs × velocidad_sonido) / 2
//
//  CABLEADO:
//    ┌───────────────────────────────┐
//    │  HC-SR04                      │
//    │  ┌────────────────────┐       │
//    │  │  VCC  │──── 3V/5V │       │  ⚠ Algunos necesitan 5V
//    │  │  TRIG │──── P8    │       │  (pin de disparo)
//    │  │  ECHO │──── P12   │       │  (pin de respuesta)
//    │  │  GND  │──── GND   │       │
//    │  └────────────────────┘       │
//    └───────────────────────────────┘
//
//  NOTA: Si el HC-SR04 necesita 5V, usar divisor de voltaje
//        en el pin ECHO para no dañar el micro:bit (3.3V max)
//
//  RENDIMIENTO vs FILTRADO:
//    Ninguno (1 lectura):  ~25ms → hasta 40 Hz (rápido pero ruidoso)
//    Suave (mediana de 3): ~80ms → hasta 12 Hz (bueno para MRU/MRUV)
//    Medio (mediana de 5): ~135ms → hasta 7 Hz (muy suave)
//    Fuerte (mediana de 7): ~190ms → hasta 5 Hz (máxima suavidad)
// =============================================================================

// Sensor HC-SR04 como bloque independiente
//% weight=95
//% color=#FF8C00
//% icon="\uf2ce"
//% block="HC-SR04 — Ultrasonic Distance"
//% groups='["Configuration", "Measurement"]'
namespace FisicaBitHCSR04 {

    // ── Estado interno del filtro ultrasónico ──
    let _usFiltroMuestras = 3   // Mediana de 3 por defecto
    let _usUltimoValido = 0     // Último valor válido (fallback)
    let _usMinMm = 20           // Mínimo válido: 20 mm (2 cm)
    let _usMaxMm = 4000         // Máximo válido: 4000 mm (400 cm)
    let _usMaxCambioMm = 0      // Máx. cambio entre lecturas (0 = desactivado)

    /**
     * Realiza UNA medición cruda del HC-SR04 y devuelve la distancia en mm.
     * Retorna -1 si la lectura es inválida (timeout, fuera de rango,
     * o cambio excesivo respecto a la última lectura válida).
     */
    function _usLecturaCrudaMm(pinTrig: DigitalPin, pinEcho: DigitalPin): number {
        pins.digitalWritePin(pinTrig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(pinTrig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(pinTrig, 0)

        let duracion = pins.pulseIn(pinEcho, PulseValue.High, 25000)

        if (duracion <= 0) return -1

        let distMm = Math.idiv(duracion * 343, 2000)

        if (distMm < _usMinMm || distMm > _usMaxMm) return -1

        if (_usMaxCambioMm > 0 && _usUltimoValido > 0) {
            let cambio = Math.abs(distMm - _usUltimoValido)
            if (cambio > _usMaxCambioMm) return -1
        }

        return distMm
    }

    /**
     * Insertion sort para arrays pequeños (eficiente para N ≤ 7).
     */
    function _usOrdenar(arr: number[], len: number): void {
        for (let i = 1; i < len; i++) {
            let clave = arr[i]
            let j = i - 1
            while (j >= 0 && arr[j] > clave) {
                arr[j + 1] = arr[j]
                j--
            }
            arr[j + 1] = clave
        }
    }

    /**
     * Convierte una distancia en mm a la unidad solicitada.
     */
    function _usConvertir(mm: number, unidad: UnidadDistancia): number {
        switch (unidad) {
            case UnidadDistancia.Milimetros:
                return mm
            case UnidadDistancia.Centimetros:
                return Math.idiv(mm, 10)
            case UnidadDistancia.Pulgadas:
                return Math.idiv(mm * 10, 254)
            default:
                return Math.idiv(mm, 10)
        }
    }

    /**
     * Configura el filtro del sensor ultrasónico.
     *
     * Para MRU/MRUV: filtro "suave" (mediana de 3) da buen equilibrio.
     * Para caída libre: filtro "ninguno" si necesitas máxima frecuencia.
     *
     * @param filtro Intensidad del filtro (más muestras = más suave pero más lento)
     */
    //% block="set ultrasonic filter to %filtro"
    //% blockId=fisicabit_us_configurar
    //% group="Configuration"
    //% weight=82
    //% filtro.defl=FiltroUltrasonido.Suave
    export function configurarFiltroUltrasonido(filtro: FiltroUltrasonido): void {
        _usFiltroMuestras = filtro
    }

    /**
     * Configura el rango válido de distancia para el sensor ultrasónico.
     * Las lecturas fuera de este rango se descartan como inválidas.
     *
     * @param minMm Distancia mínima válida en milímetros (defecto: 20 mm)
     * @param maxMm Distancia máxima válida en milímetros (defecto: 4000 mm)
     */
    //% block="set ultrasonic range from %minMm to %maxMm mm"
    //% blockId=fisicabit_us_rango
    //% group="Configuration"
    //% weight=81
    //% minMm.defl=20 minMm.min=10
    //% maxMm.defl=4000 maxMm.min=20 maxMm.max=4000
    //% inlineInputMode=inline
    export function configurarRangoUltrasonido(minMm: number, maxMm: number): void {
        _usMinMm = Math.max(10, minMm)
        _usMaxMm = Math.min(4000, maxMm)
    }

    /**
     * Configura el máximo cambio permitido entre lecturas consecutivas (en mm).
     * Usar 0 para desactivar este filtro.
     *
     * @param maxCambioMm Máximo cambio permitido en mm (0 = desactivado)
     */
    //% block="set ultrasonic max step %maxCambioMm mm"
    //% blockId=fisicabit_us_max_cambio
    //% group="Configuration"
    //% weight=79
    //% maxCambioMm.defl=0 maxCambioMm.min=0
    export function configurarMaxCambioUltrasonido(maxCambioMm: number): void {
        _usMaxCambioMm = maxCambioMm
    }

    /**
     * Mide la distancia con un sensor ultrasónico HC-SR04.
     * Incluye filtro de mediana para eliminar picos espurios.
     *
     * Conexión física HC-SR04 → micro:bit:
     *   VCC  → 3V (o 5V según módulo)
     *   GND  → GND
     *   TRIG → P8
     *   ECHO → P12
     *
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad de medida deseada
     * @returns Distancia medida en la unidad seleccionada
     */
    //% block="HC-SR04 distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido
    //% group="Measurement"
    //% weight=80
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Centimetros
    export function medirDistanciaUltrasonido(
        pinTrig: DigitalPin,
        pinEcho: DigitalPin,
        unidad: UnidadDistancia
    ): number {
        let n = _usFiltroMuestras

        if (n <= 1) {
            let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
            if (mm > 0) {
                _usUltimoValido = mm
                return _usConvertir(mm, unidad)
            }
            return _usConvertir(_usUltimoValido, unidad)
        }

        let lecturas: number[] = []
        let validas = 0

        for (let i = 0; i < n; i++) {
            let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
            if (mm > 0) {
                lecturas.push(mm)
                validas++
            }
            if (i < n - 1) {
                control.waitMicros(2500)
            }
        }

        if (validas === 0) {
            return _usConvertir(_usUltimoValido, unidad)
        }

        _usOrdenar(lecturas, validas)
        let medianaMm = lecturas[Math.idiv(validas, 2)]

        _usUltimoValido = medianaMm
        return _usConvertir(medianaMm, unidad)
    }

    /**
     * Mide la distancia con el HC-SR04 sin ningún filtro.
     * Máxima velocidad de muestreo (~40 Hz).
     *
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad de medida deseada
     * @returns Distancia cruda en la unidad seleccionada, 0 si falla
     */
    //% block="HC-SR04 raw distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido_crudo
    //% group="Measurement"
    //% weight=78
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Milimetros
    export function medirDistanciaUltrasonidoCrudo(
        pinTrig: DigitalPin,
        pinEcho: DigitalPin,
        unidad: UnidadDistancia
    ): number {
        let mm = _usLecturaCrudaMm(pinTrig, pinEcho)
        if (mm <= 0) return 0
        return _usConvertir(mm, unidad)
    }
}
