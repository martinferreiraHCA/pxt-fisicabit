// =============================================================================
//  hcsr04_sensores.ts — Sensores ultrasónicos HC-SR04 y HY-SRF05
// =============================================================================
//  Proyecto: FisicaBit.com
//  Sensores: HC-SR04 (4 pines) y HY-SRF05 (5 pines; con OUT libre se comporta
//            igual que el HC-SR04; con OUT a GND usa un solo cable TRIG/ECHO).
//  Rango: 2 cm – 400 cm (≈1,5–2 m alimentados a 3 V). Frecuencia: 40 kHz.
//
//  CÓMO FUNCIONA:
//    1. Se envía un pulso HIGH de 10 µs por TRIG.
//    2. El sensor emite 8 pulsos a 40 kHz y pone ECHO en alto hasta que
//       vuelve el rebote: ancho del pulso = tiempo de ida y vuelta.
//    3. distancia = ancho × velocidad del sonido / 2 (la velocidad depende
//       de la temperatura del aire: 331,3 + 0,606·T m/s).
//
//  CABLEADO (igual para los dos; en el simulador se ve el sensor y los cables):
//    VCC → 3V · GND → GND · TRIG → P8 · ECHO → P12   (HY-SRF05: OUT libre)
//    Kit de expansión: cabezales 8 y 12 (G·V·S). Con 5 V en VCC poner un
//    divisor 1 kΩ / 2 kΩ en ECHO (el micro:bit sólo tolera 3,3 V).
//    Segundo sensor: TRIG P1 · ECHO P2. Tercero: TRIG P15 · ECHO P16.
//
//  ADQUISICIÓN (muestreador en C++, shims.cpp):
//    El disparo y la medida del eco los hace código nativo: el TRIG se
//    dispara a período fijo y los flancos de ECHO se capturan por
//    interrupción con timestamp de microsegundos. Cada muestra lleva el
//    instante real en que el sonido tocó el objeto. El período se ajusta
//    solo al alcance elegido (alcance 3 m → ≈38 Hz; 1,5 m → ≈55 Hz) y el
//    bloque "enviar distancia ..." manda una línea por eco con ese tiempo.
//    Filtro: mediana deslizante (no baja la frecuencia) + rechazo de saltos.
// =============================================================================

//% weight=95
//% color=#FF8C00
//% icon=""
//% block="Ultrasonic — HC-SR04 / HY-SRF05"
//% groups='["Measurement", "Configuration", "Diagnostics"]'
namespace FisicaBitHCSR04 {

    // ── Shims nativos (cuerpo TS = simulador) ──
    //% shim=fisicabit_native::usIniciar
    function _hwIniciar(idx: number, trig: number, echo: number, maxMm: number, periodoMs: number, velMmPorS: number): number {
        return 0
    }
    //% shim=fisicabit_native::usDetener
    function _hwDetener(idx: number): number {
        return 0
    }
    //% shim=fisicabit_native::usConfigurar
    function _hwConfigurar(idx: number, maxMm: number, periodoMs: number, velMmPorS: number): number {
        return 0
    }
    //% shim=fisicabit_native::usSeq
    function _hwSeq(idx: number): number {
        return 0
    }
    //% shim=fisicabit_native::usDist
    function _hwDist(idx: number): number {
        return -1
    }
    //% shim=fisicabit_native::usEco
    function _hwEco(idx: number): number {
        return 0
    }
    //% shim=fisicabit_native::usTiempoDecimas
    function _hwTiempoDecimas(idx: number): number {
        return 0
    }
    //% shim=fisicabit_native::usEstadistica
    function _hwEstadistica(idx: number, cual: number): number {
        return 0
    }

    // ── Configuración global ──
    const MAX_SENSORES = 3
    let _filtroN = 3            // mediana deslizante de N lecturas
    let _minMm = 20
    let _maxMm = 3000           // alcance máximo: define el tiempo de espera y la frecuencia
    let _periodoMs = 0          // 0 = automático según el alcance
    let _maxCambioMm = 0        // rechazo de saltos (0 = desactivado)
    let _tempC = 20             // temperatura del aire para la velocidad del sonido

    function _velMmPorS(): number {
        return Math.round((331.3 + 0.606 * _tempC) * 1000)
    }

    class SensorUS {
        idx: number
        trig: DigitalPin
        echo: DigitalPin
        unCable: boolean
        nativo: boolean
        listo: boolean
        ultSeq: number
        ultIntentoMs: number
        hist: number[]
        ultVal: number          // última distancia válida (mm, con offset)
        ultOk: boolean
        offsetMm: number
        constructor(trig: DigitalPin, echo: DigitalPin) {
            this.idx = -1
            this.trig = trig
            this.echo = echo
            this.unCable = (trig == echo)
            this.nativo = false
            this.listo = false
            this.ultSeq = 0
            this.ultIntentoMs = -100000
            this.hist = []
            this.ultVal = 0
            this.ultOk = false
            this.offsetMm = 0
        }
    }
    let _sensores: SensorUS[] = []

    function _obtener(trig: DigitalPin, echo: DigitalPin): SensorUS {
        for (let i = 0; i < _sensores.length; i++) {
            const t = _sensores[i]
            if (t.trig == trig && t.echo == echo) return t
        }
        const s = new SensorUS(trig, echo)
        s.idx = _sensores.length < MAX_SENSORES ? _sensores.length : -1
        _sensores.push(s)
        return s
    }

    function _asegurar(s: SensorUS): void {
        if (s.listo) return
        const ahora = control.millis()
        if (ahora - s.ultIntentoMs < 500) return
        s.ultIntentoMs = ahora
        if (s.idx >= 0) {
            s.nativo = _hwIniciar(s.idx, s.trig, s.echo, _maxMm, _periodoMs, _velMmPorS()) == 1
        }
        s.listo = true
        s.ultSeq = 0
    }

    function _reconfigurarTodos(): void {
        for (let i = 0; i < _sensores.length; i++) {
            const s = _sensores[i]
            if (s.nativo) _hwConfigurar(s.idx, _maxMm, _periodoMs, _velMmPorS())
        }
    }

    /** Lectura cruda por TypeScript (simulador o sin muestreador): una medición bloqueante. */
    function _lecturaTS(s: SensorUS): number {
        pins.digitalWritePin(s.trig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(s.trig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(s.trig, 0)
        const timeout = Math.idiv(_maxMm * 2 * 1000000, _velMmPorS()) + 3000
        const dur = pins.pulseIn(s.echo, PulseValue.High, timeout)
        if (dur <= 0) return -1
        return Math.idiv(dur * _velMmPorS(), 2000000)
    }

    /**
     * Lee UNA muestra nueva (nativa o TS). -2 = todavía no hay muestra nueva;
     * -1 = eco inválido; ≥0 = distancia cruda en mm.
     */
    function _leerCruda(s: SensorUS): number {
        _asegurar(s)
        if (s.nativo) {
            const seq = _hwSeq(s.idx)
            if (seq == s.ultSeq) return -2
            s.ultSeq = seq
            return _hwDist(s.idx)
        }
        return _lecturaTS(s)
    }

    function _ordenar(arr: number[], len: number): void {
        for (let i = 1; i < len; i++) {
            let clave = arr[i]
            let j = i - 1
            while (j >= 0 && arr[j] > clave) { arr[j + 1] = arr[j]; j-- }
            arr[j + 1] = clave
        }
    }

    /** Distancia filtrada (mm): mediana deslizante + rechazo de saltos + offset. */
    function _leerFiltrada(s: SensorUS): number {
        // Primera lectura tras arrancar: esperar el primer eco (≈30 ms) para
        // que el bloque ya devuelva una distancia real y no 0.
        if (!s.listo || (!s.ultOk && s.hist.length == 0)) _esperarMuestra(s, 150)
        let d = _leerCruda(s)
        if (d == -2) return s.ultVal
        if (d >= 0) d += s.offsetMm
        if (d < _minMm || d > _maxMm) d = -1
        if (d >= 0 && _maxCambioMm > 0 && s.ultOk && Math.abs(d - s.ultVal) > _maxCambioMm) d = -1
        if (d < 0) {
            s.ultOk = false
            return s.ultVal
        }
        s.ultOk = true
        if (_filtroN <= 1) {
            s.ultVal = d
            return d
        }
        s.hist.push(d)
        while (s.hist.length > _filtroN) s.hist.shift()
        let copia: number[] = []
        for (let i = 0; i < s.hist.length; i++) copia.push(s.hist[i])
        _ordenar(copia, copia.length)
        s.ultVal = copia[Math.idiv(copia.length, 2)]
        return s.ultVal
    }

    function _convertir(mm: number, unidad: UnidadDistancia): number {
        switch (unidad) {
            case UnidadDistancia.Milimetros: return mm
            case UnidadDistancia.Pulgadas: return Math.round(mm / 25.4 * 100) / 100
            default: return Math.round(mm) / 10          // cm con 1 decimal
        }
    }

    function _decimalesDe(unidad: UnidadDistancia): number {
        if (unidad == UnidadDistancia.Milimetros) return 0
        if (unidad == UnidadDistancia.Pulgadas) return 2
        return 1
    }

    /** Espera la próxima muestra (hasta maxMs). Devuelve false si no llegó. */
    function _esperarMuestra(s: SensorUS, maxMs: number): boolean {
        _asegurar(s)
        if (!s.nativo) return true
        let esperado = 0
        while (_hwSeq(s.idx) == s.ultSeq) {
            if (esperado >= maxMs) return false
            basic.pause(1)
            esperado++
        }
        return true
    }

    function _enviar(s: SensorUS, unidad: UnidadDistancia, medio: MedioEnvio): void {
        if (!_esperarMuestra(s, 600)) return
        const mm = _leerFiltrada(s)
        const baseMs = control.millis() - (medio == MedioEnvio.Bluetooth ? FisicaBitBT.tiempo() : FisicaBitSerial.tiempoSerial())
        let tMs = s.nativo ? _hwTiempoDecimas(s.idx) / 10 - baseMs : control.millis() - baseMs
        if (tMs < 0) tMs = 0
        const linea = FisicaBitDatos.formatear(tMs, 1) + "," + FisicaBitDatos.formatear(_convertir(mm, unidad), _decimalesDe(unidad))
        if (medio == MedioEnvio.Bluetooth) FisicaBitBT.enviarTexto(linea)
        else FisicaBitSerial.enviarLinea(linea)
    }

    // =========================================================================
    // MEDICIÓN
    // =========================================================================

    /**
     * Distancia medida con un HC-SR04. Se inicializa solo: el disparo y el
     * eco los mide código nativo en segundo plano, con tiempo de
     * microsegundos, y el bloque devuelve la última medición filtrada
     * (mediana deslizante). Si falla el eco, devuelve la última válida.
     *
     * Cableado: VCC → 3V, GND → GND, TRIG → P8, ECHO → P12 (el simulador lo
     * muestra). Con 5 V en VCC, divisor 1 kΩ / 2 kΩ en ECHO.
     *
     * Ejemplo (MRU): [para siempre] → [enviar a fisicabit.com tiempo y
     * (HC-SR04 distancia TRIG P8 ECHO P12 en cm) cada 50 ms]
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (respuesta)
     * @param unidad Unidad: cm (1 decimal), mm o pulgadas
     */
    //% block="HC-SR04 distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido
    //% group="Measurement"
    //% weight=100
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Centimetros
    export function medirDistanciaUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: UnidadDistancia): number {
        return _convertir(_leerFiltrada(_obtener(pinTrig, pinEcho)), unidad)
    }

    /**
     * Distancia medida con un HY-SRF05. Con OUT libre (modo 4 cables) se
     * cablea igual que el HC-SR04: VCC → 3V, GND → GND, TRIG → P8,
     * ECHO → P12. Modo de un solo cable (OUT a GND): poné el MISMO pin en
     * TRIG y ECHO. El resto funciona igual que el bloque del HC-SR04.
     * @param pinTrig Pin conectado a TRIG (disparo)
     * @param pinEcho Pin conectado a ECHO (o el mismo que TRIG en modo 1 cable)
     * @param unidad Unidad: cm (1 decimal), mm o pulgadas
     */
    //% block="HY-SRF05 distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_us_srf05
    //% group="Measurement"
    //% weight=99
    //% parts="hysrf05" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Centimetros
    export function medirDistanciaSRF05(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: UnidadDistancia): number {
        return _convertir(_leerFiltrada(_obtener(pinTrig, pinEcho)), unidad)
    }

    /**
     * Envía a fisicabit.com cada eco del HC-SR04 con el instante real en que
     * el sonido tocó el objeto: una línea "tiempo,distancia" por muestra, a
     * la frecuencia del sensor (≈38 Hz con alcance 3 m, ≈55 Hz con 1,5 m).
     * Poner dentro de "para siempre"; no hace falta "cada ... ms".
     *
     * Ejemplo (carrito en riel): [para siempre] → [enviar HC-SR04 distancia
     * TRIG P8 ECHO P12 en cm por USB]
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     * @param unidad Unidad: cm (1 decimal), mm o pulgadas
     * @param medio USB o Bluetooth
     */
    //% block="send HC-SR04 distance TRIG %pinTrig ECHO %pinEcho in %unidad via %medio"
    //% blockId=fisicabit_us_enviar_hcsr04
    //% group="Measurement"
    //% weight=98
    //% inlineInputMode=inline
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Centimetros
    //% medio.defl=MedioEnvio.USB
    export function enviarDistanciaHCSR04(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: UnidadDistancia, medio: MedioEnvio): void {
        _enviar(_obtener(pinTrig, pinEcho), unidad, medio)
    }

    /**
     * Envía a fisicabit.com cada eco del HY-SRF05 con el instante real en que
     * el sonido tocó el objeto (una línea por muestra, a la frecuencia del
     * sensor). Modo 1 cable: el mismo pin en TRIG y ECHO.
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     * @param unidad Unidad: cm (1 decimal), mm o pulgadas
     * @param medio USB o Bluetooth
     */
    //% block="send HY-SRF05 distance TRIG %pinTrig ECHO %pinEcho in %unidad via %medio"
    //% blockId=fisicabit_us_enviar_srf05
    //% group="Measurement"
    //% weight=97
    //% inlineInputMode=inline
    //% parts="hysrf05" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Centimetros
    //% medio.defl=MedioEnvio.USB
    export function enviarDistanciaSRF05(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: UnidadDistancia, medio: MedioEnvio): void {
        _enviar(_obtener(pinTrig, pinEcho), unidad, medio)
    }

    /**
     * Última distancia cruda (sin filtro ni offset) en la unidad elegida;
     * 0 si no hubo eco. Para ver el ruido real del sensor.
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     * @param unidad Unidad de medida
     */
    //% block="HC-SR04 raw distance TRIG %pinTrig ECHO %pinEcho in %unidad"
    //% blockId=fisicabit_ultrasonido_crudo
    //% group="Diagnostics"
    //% weight=78
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% unidad.defl=UnidadDistancia.Milimetros
    export function medirDistanciaUltrasonidoCrudo(pinTrig: DigitalPin, pinEcho: DigitalPin, unidad: UnidadDistancia): number {
        const s = _obtener(pinTrig, pinEcho)
        const d = _leerCruda(s)
        if (d < 0) return 0
        return _convertir(d, unidad)
    }

    // =========================================================================
    // CONFIGURACIÓN
    // =========================================================================

    /**
     * Alcance máximo que te interesa medir. Define cuánto se espera el eco y,
     * con eso, la frecuencia de muestreo: 150 cm → ≈55 Hz, 300 cm → ≈38 Hz,
     * 400 cm → ≈31 Hz. Para un carrito en un riel de 1,5 m usá 150 cm.
     * @param cm Alcance máximo en cm (20 a 600)
     */
    //% block="set ultrasonic max range %cm cm"
    //% blockId=fisicabit_us_alcance
    //% group="Configuration"
    //% weight=90
    //% cm.min=20 cm.max=600 cm.defl=300
    export function fijarAlcanceUltrasonido(cm: number): void {
        _maxMm = Math.max(200, Math.min(6000, Math.round(cm * 10)))
        _reconfigurarTodos()
    }

    /**
     * Temperatura del aire para calcular la velocidad del sonido
     * (331,3 + 0,606·T m/s). A 20 °C son 343,4 m/s; cada 5 °C cambian ≈1 %
     * las distancias. Podés conectar aquí la lectura de un DS18B20 o DHT11.
     * @param gradosC Temperatura del aire en °C
     */
    //% block="set air temperature for ultrasonic %gradosC °C"
    //% blockId=fisicabit_us_temperatura
    //% group="Configuration"
    //% weight=88
    //% gradosC.min=-20 gradosC.max=50 gradosC.defl=20
    export function fijarTemperaturaAire(gradosC: number): void {
        _tempC = gradosC
        _reconfigurarTodos()
    }

    /**
     * Suavizado: mediana de las últimas 3, 5 o 7 muestras. No baja la
     * frecuencia de muestreo; agrega un retardo de 1, 2 o 3 muestras.
     * Para MRU/MRUV: suave. Para choques o caída libre: ninguno.
     * @param filtro Intensidad del filtro
     */
    //% block="set ultrasonic filter to %filtro"
    //% blockId=fisicabit_us_configurar
    //% group="Configuration"
    //% weight=86
    //% filtro.defl=FiltroUltrasonido.Suave
    export function configurarFiltroUltrasonido(filtro: FiltroUltrasonido): void {
        _filtroN = filtro
        for (let i = 0; i < _sensores.length; i++) _sensores[i].hist = []
    }

    /**
     * Frecuencia de muestreo fija en Hz (0 = automática según el alcance).
     * Si pedís más de lo que permite el alcance, el eco de una medición
     * puede contaminar la siguiente: usalo con alcances cortos.
     * @param hz Muestras por segundo (0 = automático, máx. 60)
     */
    //% block="set ultrasonic sampling rate %hz Hz (0 = auto)"
    //% blockId=fisicabit_us_frecuencia
    //% group="Configuration"
    //% weight=84
    //% hz.min=0 hz.max=60 hz.defl=0
    export function fijarFrecuenciaUltrasonido(hz: number): void {
        _periodoMs = hz <= 0 ? 0 : Math.max(15, Math.round(1000 / hz))
        _reconfigurarTodos()
    }

    /**
     * Rango válido: las lecturas fuera se descartan y se mantiene la última
     * válida. El máximo también fija el alcance (tiempo de espera del eco).
     * @param minMm Distancia mínima válida en mm (defecto 20)
     * @param maxMm Distancia máxima válida en mm (defecto 3000)
     */
    //% block="set ultrasonic range from %minMm to %maxMm mm"
    //% blockId=fisicabit_us_rango
    //% group="Configuration"
    //% weight=82
    //% minMm.defl=20 minMm.min=10
    //% maxMm.defl=3000 maxMm.min=50 maxMm.max=6000
    //% inlineInputMode=inline
    export function configurarRangoUltrasonido(minMm: number, maxMm: number): void {
        _minMm = Math.max(10, minMm)
        _maxMm = Math.max(50, Math.min(6000, maxMm))
        _reconfigurarTodos()
    }

    /**
     * Rechazo de saltos: si una muestra difiere de la anterior en más de
     * este valor se descarta (rebotes laterales, otra persona que cruza).
     * 0 = desactivado. Para un carrito a 1 m/s a 40 Hz el salto real es
     * de 25 mm por muestra: poné 100 mm.
     * @param maxCambioMm Salto máximo permitido en mm (0 = desactivado)
     */
    //% block="set ultrasonic max step %maxCambioMm mm"
    //% blockId=fisicabit_us_max_cambio
    //% group="Configuration"
    //% weight=80
    //% maxCambioMm.defl=0 maxCambioMm.min=0
    export function configurarMaxCambioUltrasonido(maxCambioMm: number): void {
        _maxCambioMm = maxCambioMm
    }

    /**
     * Calibra el offset del sensor: poné una superficie plana a una distancia
     * conocida (por ejemplo 300 mm medidos con cinta), ejecutá el bloque y
     * la extensión corrige todas las lecturas siguientes. Tarda ~1 s.
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     * @param distanciaMm Distancia real al objeto en mm
     */
    //% block="calibrate ultrasonic TRIG %pinTrig ECHO %pinEcho with target at %distanciaMm mm"
    //% blockId=fisicabit_us_calibrar
    //% group="Configuration"
    //% weight=78
    //% inlineInputMode=inline
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    //% distanciaMm.min=50 distanciaMm.max=4000 distanciaMm.defl=300
    export function calibrarUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin, distanciaMm: number): void {
        const s = _obtener(pinTrig, pinEcho)
        const previo = s.offsetMm
        s.offsetMm = 0
        let suma = 0, n = 0
        for (let i = 0; i < 40 && n < 20; i++) {
            if (!_esperarMuestra(s, 400)) break
            const d = _leerCruda(s)
            if (d >= 0) { suma += d; n++ }
            if (!s.nativo) basic.pause(40)
        }
        if (n >= 5) {
            s.offsetMm = Math.round(distanciaMm - suma / n)
            s.hist = []
            basic.showIcon(IconNames.Yes)
        } else {
            s.offsetMm = previo
            basic.showIcon(IconNames.No)
        }
        basic.pause(500)
        basic.clearScreen()
    }

    // =========================================================================
    // DIAGNÓSTICO
    // =========================================================================

    /**
     * Estado del sensor en una palabra, para mostrar en pantalla o enviar
     * por USB y saber al instante si el cableado está bien:
     * "OK" = mide; "SIN ECO" = el sensor no responde (revisar VCC: muchos
     * HC-SR04 necesitan 5 V; GND; y que haya un objeto a menos del alcance);
     * "ECHO ALTO" = el pin ECHO quedó en alto (TRIG y ECHO cruzados o
     * módulo sin alimentación).
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     */
    //% block="ultrasonic status TRIG %pinTrig ECHO %pinEcho"
    //% blockId=fisicabit_us_estado
    //% group="Diagnostics"
    //% weight=86
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    export function estadoUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin): string {
        const s = _obtener(pinTrig, pinEcho)
        _asegurar(s)
        if (!s.nativo) return "SIM"
        const v0 = _hwEstadistica(s.idx, 0)
        basic.pause(400)
        if (_hwEstadistica(s.idx, 0) > v0) return "OK"
        if (_hwEstadistica(s.idx, 3) == 1) return "ECHO ALTO"
        return "SIN ECO"
    }

    /**
     * Verdadero si la última muestra tuvo un eco válido (objeto dentro del
     * alcance y sin salto rechazado).
     */
    //% block="ultrasonic echo valid?"
    //% blockId=fisicabit_us_valido
    //% group="Diagnostics"
    //% weight=84
    export function ecoValido(): boolean {
        for (let i = 0; i < _sensores.length; i++) if (_sensores[i].ultOk) return true
        return false
    }

    /**
     * Frecuencia real de muestreo del sensor (Hz), medida durante 1 segundo.
     * Alcance 3 m → ≈38 Hz; 1,5 m → ≈55 Hz.
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     */
    //% block="ultrasonic actual sampling rate (Hz) TRIG %pinTrig ECHO %pinEcho"
    //% blockId=fisicabit_us_hz
    //% group="Diagnostics"
    //% weight=82
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    export function frecuenciaRealUltrasonido(pinTrig: DigitalPin, pinEcho: DigitalPin): number {
        const s = _obtener(pinTrig, pinEcho)
        _asegurar(s)
        if (!s.nativo) return 0
        const antes = _hwEstadistica(s.idx, 0) + _hwEstadistica(s.idx, 1)
        basic.pause(1000)
        return _hwEstadistica(s.idx, 0) + _hwEstadistica(s.idx, 1) - antes
    }

    /**
     * Instante (ms desde el encendido, 1 decimal) en que el sonido tocó el
     * objeto en la última muestra (tiempo de hardware del eco).
     * @param pinTrig Pin conectado a TRIG
     * @param pinEcho Pin conectado a ECHO
     */
    //% block="ultrasonic last echo time (ms) TRIG %pinTrig ECHO %pinEcho"
    //% blockId=fisicabit_us_tiempo
    //% group="Diagnostics"
    //% weight=80
    //% parts="hcsr04" trackArgs=0,1
    //% pinTrig.defl=DigitalPin.P8
    //% pinEcho.defl=DigitalPin.P12
    export function tiempoUltimoEco(pinTrig: DigitalPin, pinEcho: DigitalPin): number {
        const s = _obtener(pinTrig, pinEcho)
        _asegurar(s)
        if (!s.nativo) return control.millis()
        return _hwTiempoDecimas(s.idx) / 10
    }
}
