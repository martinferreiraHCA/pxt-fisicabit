// =============================================================================
//  cinematica.ts — "FisicaBit Kinematics": acelerómetro de precisión
// =============================================================================
//  Proyecto: FisicaBit.com
//
//  QUÉ HAY DENTRO DEL micro:bit v2 (investigado en la hoja de datos del
//  LSM303AGR, DocID027765 Rev 9, y en el driver CODAL LSM303Accelerometer.cpp):
//  ─────────────────────────────────────────────────────────────────────────
//  • Sensor: LSM303AGR (ST), MEMS capacitivo de 3 ejes. NO tiene giróscopo.
//  • Rango ±2 g por defecto (también ±4/±8/±16 g).
//  • Modos: normal (10 bits, 3,9 mg/LSB) y ALTA RESOLUCIÓN (12 bits,
//    0,98 mg/LSB, ruido 3 mg RMS a 100 Hz, ancho de banda ODR/9).
//  • Frecuencias de muestreo (ODR): 1, 10, 25, 50, 100, 200, 400 Hz…
//  • Error de cero (offset) por eje: ±40 mg típico, hasta ±80 mg.
//    → 0,4 m/s² de sesgo si no se calibra. Deriva ±0,5 mg/°C.
//  • Tolerancia de sensibilidad ±7 % (típ. mucho mejor), 0,01 %/°C.
//
//  CÓMO LO USA MAKECODE (lo que hace el firmware por defecto):
//  ─────────────────────────────────────────────────────────────
//  • CODAL configura el chip en modo NORMAL (10 bits) a 50 Hz, ±2 g, y
//    decodifica raw16/32·rango. Resultado: `input.acceleration` devuelve
//    1024 CUENTAS POR g (no 1000): en reposo z ≈ −1024, y en modo normal
//    los valores saltan de a 4 cuentas (3,9 mg).
//  • Consecuencia: convertir con 9,81/1000 introduce +2,4 % de error.
//  • Cada muestra nueva dispara el evento DATA_UPDATE (id 5, valor 1).
//
//  QUÉ HACE ESTE MÓDULO PARA MEDIR CON PRECISIÓN:
//  ─────────────────────────────────────────────────
//  1. Pone el chip en ALTA RESOLUCIÓN (bit HR de CTRL_REG4_A) y a 200 Hz
//     (shim nativo en shims.cpp). Resolución 4× mejor y menos ruido.
//  2. Procesa CADA muestra del sensor en segundo plano (evento DATA_UPDATE),
//     con el instante real de cada una (control.micros()).
//  3. Calibra la escala con la gravedad medida en reposo: |g| medido en
//     cuentas ↔ g local (9,80665 m/s² por defecto). Corrige de una vez el
//     factor 1024 y la tolerancia de sensibilidad del chip.
//  4. Resta el vector gravedad de referencia (aprendido en reposo) para
//     obtener aceleración LINEAL respecto al suelo. Cuando la placa queda
//     quieta, la referencia se corrige sola (y el sesgo de offset también).
//  5. Promedio móvil (10 muestras = 50 ms) para la lectura: ruido /√10.
//  6. Velocidad: integra cada muestra (trapecio, dt real) y se pone en 0
//     automáticamente cuando detecta reposo (ZUPT), lo que elimina la
//     deriva acumulada entre movimientos.
//  7. Calibración en 6 posiciones (avanzado) para offset y escala por eje.
//
//  LÍMITE FÍSICO QUE NO SE PUEDE SALTAR: sin giróscopo, el sensor no puede
//  distinguir gravedad de aceleración cuando la placa GIRA mientras se
//  mueve. Para mediciones precisas mantener la orientación fija durante el
//  movimiento (carrito en riel, caída libre, ascensor). En reposo puede
//  cambiarse la orientación: la referencia se vuelve a aprender sola.
// =============================================================================

//% weight=97
//% color=#1E88E5
//% icon=""
//% block="FisicaBit Kinematics"
//% groups="['1. Start (in on start)', '2. Measure', '3. Send to fisicabit.com', '4. Optional', 'Advanced']"
namespace FisicaBitCinematica {

    // =========================================================================
    // Shims nativos (cuerpo TS = simulador)
    // =========================================================================

    //% shim=fisicabit_native::acelConfigurar
    function _hwConfigurar(periodoMs: number, rangoG: number, altaRes: number): number {
        return periodoMs
    }

    //% shim=fisicabit_native::acelAsegurarHR
    function _hwAsegurarHR(altaRes: number): number {
        return -1
    }

    // =========================================================================
    // Constantes y estado
    // =========================================================================
    const G_STD = 9.80665
    const CUENTAS_G = 1024                 // MakeCode: raw16/16 → 1024 cuentas ≈ 1 g
    const ID_ACEL = 5                      // DAL.DEVICE_ID_ACCELEROMETER
    const EVT_DATA_UPDATE = 1              // ACCELEROMETER_EVT_DATA_UPDATE
    const MAX_VENTANA = 40
    const REPOSO_VENTANA = 40              // muestras para detectar reposo (0,2 s a 200 Hz)
    const REPOSO_RANGO = 16                // cuentas: |a| casi constante (≈0,15 m/s²)
    const REPOSO_LINEAL = 40               // cuentas: |a_lineal| media pequeña (≈0,4 m/s²)
    const REPOSO_MS_ZUPT = 400             // ms quieto antes de poner v = 0
    const REPOSO_MS_REF = 800              // ms quieto antes de corregir la referencia
    const DEADBAND_MS2 = 0.02              // m/s² (sólo en la lectura mostrada)

    let _gLocal = G_STD
    let _periodoMs = 5                     // 200 Hz
    let _rangoG = 2
    let _altaRes = true
    let _ventana = 10
    let _refFija = false
    let _zupt = true
    let _iniciado = false
    let _hr = -1                           // último resultado de _hwAsegurarHR

    // Calibración 6 posiciones (cuentas): a_cal = (raw − off) · esc
    let _offX = 0, _offY = 0, _offZ = 0
    let _escX = 1, _escY = 1, _escZ = 1
    let _cal6 = false

    // Referencia de gravedad (cuentas calibradas) y factor cuentas → m/s²
    let _gx = 0, _gy = 0, _gz = -CUENTAS_G
    let _gMod = CUENTAS_G
    let _gRefValida = false
    let _factor = G_STD / CUENTAS_G

    // Última muestra calibrada (cuentas) y lineal instantánea (cuentas)
    let _ax = 0, _ay = 0, _az = -CUENTAS_G
    let _lx = 0, _ly = 0, _lz = 0

    // Promedio móvil de la aceleración lineal y de la cruda calibrada
    let _bLx: number[] = []
    let _bLy: number[] = []
    let _bLz: number[] = []
    let _bAx: number[] = []
    let _bAy: number[] = []
    let _bAz: number[] = []
    let _bIdx = 0
    let _bN = 0
    let _sLx = 0, _sLy = 0, _sLz = 0
    let _sAx = 0, _sAy = 0, _sAz = 0

    // Detección de reposo: ventana de |a| cruda
    let _bMod: number[] = []
    let _mIdx = 0
    let _mN = 0
    let _reposo = false
    let _reposoDesdeMs = 0

    // Velocidad (m/s)
    let _vx = 0, _vy = 0, _vz = 0, _vV = 0
    let _tUltUs = 0
    let _aPrevX = 0, _aPrevY = 0, _aPrevZ = 0, _aPrevV = 0

    // Estadísticas del muestreador
    let _muestras = 0
    let _ultimoEventoMs = 0

    // =========================================================================
    // Muestreador en segundo plano
    // =========================================================================

    function _reiniciarBuffers(): void {
        _bLx = []; _bLy = []; _bLz = []; _bAx = []; _bAy = []; _bAz = []
        for (let i = 0; i < MAX_VENTANA; i++) {
            _bLx.push(0); _bLy.push(0); _bLz.push(0)
            _bAx.push(0); _bAy.push(0); _bAz.push(0)
        }
        _bIdx = 0; _bN = 0
        _sLx = 0; _sLy = 0; _sLz = 0; _sAx = 0; _sAy = 0; _sAz = 0
        _bMod = []
        for (let i = 0; i < REPOSO_VENTANA; i++) _bMod.push(0)
        _mIdx = 0; _mN = 0
    }

    function _configurarHardware(): void {
        const real = _hwConfigurar(_periodoMs, _rangoG, _altaRes ? 1 : 0)
        if (real > 0) _periodoMs = real
        _hr = _hwAsegurarHR(_altaRes ? 1 : 0)
        // Al pasar a HR el chip necesita 7/ODR para asentarse
        basic.pause(60)
    }

    function _asegurarIniciado(): void {
        if (_iniciado) return
        _iniciado = true
        _reiniciarBuffers()
        _configurarHardware()
        // Cada muestra nueva del sensor dispara este evento
        control.onEvent(ID_ACEL, EVT_DATA_UPDATE, function () {
            _ultimoEventoMs = control.millis()
            _procesar(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z), control.micros())
        })
        // Respaldo: si no llegan eventos (simulador), muestrear por sondeo.
        // Además reafirma el modo HR cada 2 s (CODAL lo pierde al reconfigurar).
        control.inBackground(function () {
            let cuenta = 0
            while (true) {
                basic.pause(_periodoMs)
                if (control.millis() - _ultimoEventoMs > 250) {
                    _procesar(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z), control.micros())
                }
                cuenta++
                if (cuenta * _periodoMs >= 2000) {
                    cuenta = 0
                    _hr = _hwAsegurarHR(_altaRes ? 1 : 0)
                }
            }
        })
    }

    function _procesar(rx: number, ry: number, rz: number, tUs: number): void {
        // 1) Calibración de offset/escala por eje
        const ax = (rx - _offX) * _escX
        const ay = (ry - _offY) * _escY
        const az = (rz - _offZ) * _escZ
        _ax = ax; _ay = ay; _az = az
        _muestras++

        // 2) Referencia inicial: primera muestra (se corrige sola en reposo)
        if (!_gRefValida) {
            _fijarReferencia(ax, ay, az)
        }

        // 3) Aceleración lineal instantánea (cuentas)
        const lx = ax - _gx
        const ly = ay - _gy
        const lz = az - _gz
        _lx = lx; _ly = ly; _lz = lz

        // 4) Promedios móviles (ventana _ventana)
        if (_bN >= _ventana) {
            const j = (_bIdx - _ventana + MAX_VENTANA) % MAX_VENTANA
            _sLx -= _bLx[j]; _sLy -= _bLy[j]; _sLz -= _bLz[j]
            _sAx -= _bAx[j]; _sAy -= _bAy[j]; _sAz -= _bAz[j]
        } else {
            _bN++
        }
        _bLx[_bIdx] = lx; _bLy[_bIdx] = ly; _bLz[_bIdx] = lz
        _bAx[_bIdx] = ax; _bAy[_bIdx] = ay; _bAz[_bIdx] = az
        _sLx += lx; _sLy += ly; _sLz += lz
        _sAx += ax; _sAy += ay; _sAz += az
        _bIdx = (_bIdx + 1) % MAX_VENTANA

        // 5) Detección de reposo: |a| casi constante y lineal media pequeña
        const mod = Math.sqrt(ax * ax + ay * ay + az * az)
        _bMod[_mIdx] = mod
        _mIdx = (_mIdx + 1) % REPOSO_VENTANA
        if (_mN < REPOSO_VENTANA) _mN++
        let quieto = false
        if (_mN >= REPOSO_VENTANA) {
            let mn = _bMod[0], mx = _bMod[0]
            for (let i = 1; i < REPOSO_VENTANA; i++) {
                const v = _bMod[i]
                if (v < mn) mn = v
                if (v > mx) mx = v
            }
            const n = _bN > 0 ? _bN : 1
            const mlx = _sLx / n, mly = _sLy / n, mlz = _sLz / n
            const linMedia = Math.sqrt(mlx * mlx + mly * mly + mlz * mlz)
            quieto = (mx - mn) < REPOSO_RANGO && linMedia < REPOSO_LINEAL
        }
        const ahoraMs = control.millis()
        if (quieto) {
            if (!_reposo) { _reposo = true; _reposoDesdeMs = ahoraMs }
            const quietoMs = ahoraMs - _reposoDesdeMs
            if (_zupt && quietoMs >= REPOSO_MS_ZUPT) {
                _vx = 0; _vy = 0; _vz = 0; _vV = 0
            }
            if (!_refFija && quietoMs >= REPOSO_MS_REF) {
                // Corrección lenta de la referencia con la media de la ventana
                const n = _bN > 0 ? _bN : 1
                const k = 0.02
                _gx += k * (_sAx / n - _gx)
                _gy += k * (_sAy / n - _gy)
                _gz += k * (_sAz / n - _gz)
                _actualizarFactor()
            }
        } else {
            _reposo = false
        }

        // 6) Integración de velocidad (trapecio, dt real, m/s²)
        if (_tUltUs !== 0) {
            let dtUs = tUs - _tUltUs
            const nominal = _periodoMs * 1000
            if (dtUs <= 0 || dtUs > nominal * 10) dtUs = nominal
            if (dtUs < nominal / 2) dtUs = nominal / 2
            const dt = dtUs / 1000000
            const fx = lx * _factor, fy = ly * _factor, fz = lz * _factor
            const fV = -(lx * _gx + ly * _gy + lz * _gz) / _gMod * _factor
            if (!(_reposo && _zupt && (ahoraMs - _reposoDesdeMs) >= REPOSO_MS_ZUPT)) {
                _vx += (fx + _aPrevX) * 0.5 * dt
                _vy += (fy + _aPrevY) * 0.5 * dt
                _vz += (fz + _aPrevZ) * 0.5 * dt
                _vV += (fV + _aPrevV) * 0.5 * dt
            }
            _aPrevX = fx; _aPrevY = fy; _aPrevZ = fz; _aPrevV = fV
        }
        _tUltUs = tUs
    }

    function _fijarReferencia(gx: number, gy: number, gz: number): void {
        _gx = gx; _gy = gy; _gz = gz
        _gRefValida = true
        _actualizarFactor()
    }

    function _actualizarFactor(): void {
        _gMod = Math.sqrt(_gx * _gx + _gy * _gy + _gz * _gz)
        if (_gMod < 700 || _gMod > 1400) {
            // Referencia poco creíble (movimiento o rango saturado): usar nominal
            _factor = _gLocal / CUENTAS_G
            if (_gMod < 1) _gMod = CUENTAS_G
        } else {
            _factor = _gLocal / _gMod
        }
    }

    function _redondear2(v: number): number {
        return Math.round(v * 100) / 100
    }

    function _mediaLineal(): number[] {
        const n = _bN > 0 ? _bN : 1
        return [_sLx / n, _sLy / n, _sLz / n]
    }

    function _mediaCruda(): number[] {
        const n = _bN > 0 ? _bN : 1
        return [_sAx / n, _sAy / n, _sAz / n]
    }

    function _componente(v: number[], eje: EjeAceleracion): number {
        switch (eje) {
            case EjeAceleracion.X: return v[0]
            case EjeAceleracion.Y: return v[1]
            case EjeAceleracion.Z: return v[2]
            case EjeAceleracion.Magnitud:
                return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
            case EjeAceleracion.Vertical:
                return -(v[0] * _gx + v[1] * _gy + v[2] * _gz) / _gMod
            default: return 0
        }
    }

    // =========================================================================
    // PASO 1: INICIAR
    // =========================================================================

    /**
     * Inicia el acelerómetro de precisión: alta resolución (12 bits),
     * 200 muestras por segundo, medición en segundo plano y calibración
     * automática en reposo. Colocar en "al iniciar" con la placa quieta.
     * (Los bloques de medición lo inician solos si te olvidás.)
     *
     * Ejemplo: [al iniciar] → [iniciar acelerómetro de precisión]
     *          [para siempre] → [enviar a fisicabit.com tiempo y (aceleración vertical) cada 50 ms]
     */
    //% block="start precision accelerometer"
    //% blockId=fisicabit_cin_iniciar
    //% group="1. Start (in on start)"
    //% weight=100
    export function iniciar(): void {
        _asegurarIniciado()
        calibrarEnReposo()
    }

    // =========================================================================
    // PASO 2: MEDIR
    // =========================================================================

    /**
     * Aceleración LINEAL del cuerpo respecto al suelo, en m/s² (sin la
     * gravedad). En reposo da 0,00. "Vertical" es positiva hacia arriba
     * y funciona con la placa inclinada; "magnitud" es |a|.
     * Promedio de las últimas 10 muestras (50 ms) para bajar el ruido.
     *
     * Ejemplo: ascensor arrancando hacia arriba → vertical ≈ +1 m/s².
     * @param eje Eje: vertical, X, Y, Z o magnitud
     */
    //% block="acceleration (m/s²) %eje"
    //% blockId=fisicabit_cin_accel_lineal
    //% group="2. Measure"
    //% weight=100
    //% eje.defl=EjeAceleracion.Vertical
    export function leerAceleracionLineal(eje: EjeAceleracion): number {
        _asegurarIniciado()
        let v = _componente(_mediaLineal(), eje) * _factor
        if (v < DEADBAND_MS2 && v > -DEADBAND_MS2) v = 0
        return _redondear2(v)
    }

    /**
     * Velocidad instantánea en m/s, integrando la aceleración de CADA
     * muestra del sensor en segundo plano (no hace falta llamarlo seguido).
     * Se pone en 0 sola cuando la placa queda quieta, así la deriva no se
     * acumula. Mantener la orientación de la placa fija mientras se mueve.
     *
     * Ejemplo: carrito en riel: [enviar a fisicabit.com tiempo y (velocidad instantánea X) cada 50 ms]
     * @param eje Eje: vertical, X, Y, Z o magnitud
     */
    //% block="instantaneous velocity (m/s) %eje"
    //% blockId=fisicabit_cin_velocidad
    //% group="2. Measure"
    //% weight=95
    //% eje.defl=EjeAceleracion.Vertical
    export function velocidadInstantanea(eje: EjeAceleracion): number {
        _asegurarIniciado()
        switch (eje) {
            case EjeAceleracion.X: return _redondear2(_vx)
            case EjeAceleracion.Y: return _redondear2(_vy)
            case EjeAceleracion.Z: return _redondear2(_vz)
            case EjeAceleracion.Magnitud:
                return _redondear2(Math.sqrt(_vx * _vx + _vy * _vy + _vz * _vz))
            case EjeAceleracion.Vertical: return _redondear2(_vV)
            default: return 0
        }
    }

    /**
     * Pone la velocidad en 0 en todos los ejes. Usarlo al empezar cada
     * medición con el cuerpo quieto (por ejemplo al apretar el botón A).
     */
    //% block="reset velocity to 0"
    //% blockId=fisicabit_cin_reset
    //% group="2. Measure"
    //% weight=90
    export function reiniciarVelocidad(): void {
        _vx = 0; _vy = 0; _vz = 0; _vV = 0
        _aPrevX = 0; _aPrevY = 0; _aPrevZ = 0; _aPrevV = 0
    }

    /**
     * Verdadero cuando la placa está quieta (aceleración casi constante
     * durante 0,2 s). Con eso el módulo pone la velocidad en 0 y ajusta
     * la referencia de gravedad.
     */
    //% block="at rest?"
    //% blockId=fisicabit_cin_reposo
    //% group="2. Measure"
    //% weight=85
    export function enReposo(): boolean {
        _asegurarIniciado()
        return _reposo
    }

    /**
     * Aceleración PROPIA (la que "siente" el sensor), en m/s², SIN restar
     * la gravedad: en reposo vale ≈9,81 hacia arriba, en caída libre ≈0.
     * @param eje Eje: vertical, X, Y, Z o magnitud
     */
    //% block="proper acceleration (m/s²) %eje"
    //% blockId=fisicabit_cin_accel_propia
    //% group="2. Measure"
    //% weight=80
    //% eje.defl=EjeAceleracion.Magnitud
    export function leerAceleracionPropia(eje: EjeAceleracion): number {
        _asegurarIniciado()
        return _redondear2(_componente(_mediaCruda(), eje) * _factor)
    }

    /**
     * Verdadero si el cuerpo está en caída libre: la aceleración propia
     * es menor que el umbral (por defecto 300 mg ≈ 3 m/s²).
     * @param umbralMg Umbral en miligravedades, eg: 300
     */
    //% block="free fall? (below %umbralMg mg)"
    //% blockId=fisicabit_cin_caida_libre
    //% group="2. Measure"
    //% weight=75
    //% umbralMg.min=50 umbralMg.max=800 umbralMg.defl=300
    export function esCaidaLibre(umbralMg: number): boolean {
        _asegurarIniciado()
        const m = _mediaCruda()
        const mod = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2])
        return mod < umbralMg * CUENTAS_G / 1000
    }

    /**
     * Cabeceo (pitch) de la placa en grados: inclinación adelante/atrás.
     */
    //% block="pitch (°)"
    //% blockId=fisicabit_cin_pitch
    //% group="2. Measure"
    //% weight=70
    export function pitch(): number {
        _asegurarIniciado()
        const m = _mediaCruda()
        const yz = Math.sqrt(m[1] * m[1] + m[2] * m[2])
        return Math.round(Math.atan2(-m[0], yz) * 180 / Math.PI * 10) / 10
    }

    /**
     * Alabeo (roll) de la placa en grados: inclinación izquierda/derecha.
     */
    //% block="roll (°)"
    //% blockId=fisicabit_cin_roll
    //% group="2. Measure"
    //% weight=69
    export function roll(): number {
        _asegurarIniciado()
        const m = _mediaCruda()
        return Math.round(Math.atan2(m[1], m[2]) * 180 / Math.PI * 10) / 10
    }

    // =========================================================================
    // PASO 3: ENVIAR A fisicabit.com — velocidad y aceleración a intervalos
    // =========================================================================

    function _enviar(medio: MedioEnvio, valores: number[], ms: number): void {
        if (medio === MedioEnvio.Bluetooth) {
            if (valores.length === 1) FisicaBitBT.enviar1(valores[0], ms)
            else FisicaBitBT.enviar2(valores[0], valores[1], ms)
        } else {
            if (valores.length === 1) FisicaBitSerial.enviar1(valores[0], ms)
            else FisicaBitSerial.enviar2(valores[0], valores[1], ms)
        }
    }

    /**
     * Envía a fisicabit.com el tiempo y la VELOCIDAD (m/s) cada X ms, por
     * USB o Bluetooth. Colocar dentro de "para siempre". Ideal para MRUV:
     * en la página, la gráfica velocidad-tiempo es una recta y su
     * pendiente es la aceleración.
     * Línea enviada: tiempo,velocidad. En fisicabit.com: 1 variable,
     * "Micro:bit envía timestamp" activado. Por Bluetooth, poner antes
     * "iniciar Bluetooth para fisicabit.com" en "al iniciar".
     *
     * Ejemplo: carrito en un plano inclinado, placa fija al carrito:
     *   [para siempre] → [enviar velocidad X por Bluetooth cada 100 ms]
     * @param eje Eje del movimiento: X, Y, Z, vertical o magnitud
     * @param medio USB o Bluetooth
     * @param ms Tiempo entre envíos en ms (100 = 10 por segundo), eg: 100
     */
    //% block="send velocity %eje via %medio every %ms ms"
    //% blockId=fisicabit_cin_enviar_v
    //% group="3. Send to fisicabit.com"
    //% weight=100
    //% eje.defl=EjeAceleracion.X
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarVelocidad(eje: EjeAceleracion, medio: MedioEnvio, ms: number): void {
        _enviar(medio, [velocidadInstantanea(eje)], ms)
    }

    /**
     * Envía a fisicabit.com el tiempo, la VELOCIDAD (m/s) y la
     * ACELERACIÓN (m/s²) cada X ms, por USB o Bluetooth. Colocar dentro
     * de "para siempre". Permite comparar en la misma gráfica la pendiente
     * de v(t) con la aceleración medida.
     * Línea enviada: tiempo,velocidad,aceleración. En fisicabit.com: 2
     * variables, "Micro:bit envía timestamp" activado.
     * @param eje Eje del movimiento: X, Y, Z, vertical o magnitud
     * @param medio USB o Bluetooth
     * @param ms Tiempo entre envíos en ms, eg: 100
     */
    //% block="send velocity and acceleration %eje via %medio every %ms ms"
    //% blockId=fisicabit_cin_enviar_va
    //% group="3. Send to fisicabit.com"
    //% weight=95
    //% eje.defl=EjeAceleracion.X
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarVelocidadAceleracion(eje: EjeAceleracion, medio: MedioEnvio, ms: number): void {
        _enviar(medio, [velocidadInstantanea(eje), leerAceleracionLineal(eje)], ms)
    }

    /**
     * Envía a fisicabit.com el tiempo y la ACELERACIÓN (m/s²) cada X ms,
     * por USB o Bluetooth. Colocar dentro de "para siempre".
     * Línea enviada: tiempo,aceleración. En fisicabit.com: 1 variable,
     * "Micro:bit envía timestamp" activado.
     * @param eje Eje: vertical, X, Y, Z o magnitud
     * @param medio USB o Bluetooth
     * @param ms Tiempo entre envíos en ms, eg: 100
     */
    //% block="send acceleration %eje via %medio every %ms ms"
    //% blockId=fisicabit_cin_enviar_a
    //% group="3. Send to fisicabit.com"
    //% weight=90
    //% eje.defl=EjeAceleracion.Vertical
    //% ms.min=20 ms.max=60000 ms.defl=100
    //% inlineInputMode=inline
    export function enviarAceleracion(eje: EjeAceleracion, medio: MedioEnvio, ms: number): void {
        _enviar(medio, [leerAceleracionLineal(eje)], ms)
    }

    // =========================================================================
    // PASO 4: OPCIONAL
    // =========================================================================

    /**
     * Calibración rápida: con la placa QUIETA durante 1 segundo, mide la
     * gravedad, fija la referencia de reposo (aceleración lineal = 0) y la
     * escala real del sensor, y pone la velocidad en 0. Se hace sola al
     * iniciar; repetirla si se cambió la orientación de la placa.
     *
     * Ejemplo: [al presionar botón A] → [calibrar en reposo (1 s)]
     */
    //% block="calibrate at rest (hold still 1 s)"
    //% blockId=fisicabit_cin_calibrar
    //% group="4. Optional"
    //% weight=100
    export function calibrarEnReposo(): void {
        _asegurarIniciado()
        let sx = 0, sy = 0, sz = 0, n = 0
        const t0 = control.millis()
        while (control.millis() - t0 < 1000) {
            sx += _ax; sy += _ay; sz += _az; n++
            basic.pause(_periodoMs)
        }
        if (n > 0) _fijarReferencia(sx / n, sy / n, sz / n)
        reiniciarVelocidad()
        _reposo = true
        _reposoDesdeMs = control.millis()
    }

    /**
     * (Compatibilidad) Calibración en reposo promediando N muestras.
     * @param muestras Número de muestras, eg: 200
     */
    //% block="calibrate accelerometer at rest (%muestras samples)"
    //% blockId=fisicabit_cin_calibrar_n
    //% group="4. Optional"
    //% weight=99
    //% muestras.min=50 muestras.max=500 muestras.defl=200
    //% deprecated=true
    export function calibrarAcelerometro(muestras: number): void {
        calibrarEnReposo()
    }

    /**
     * Frecuencia de muestreo del sensor. 200 Hz por defecto. 400 Hz para
     * golpes y choques muy breves; 100 Hz si el programa hace muchas otras
     * cosas a la vez.
     * @param tasa Frecuencia de muestreo
     */
    //% block="set accelerometer sampling %tasa"
    //% blockId=fisicabit_cin_tasa
    //% group="4. Optional"
    //% weight=90
    //% tasa.defl=TasaAcelerometro.Hz200
    export function fijarTasa(tasa: TasaAcelerometro): void {
        _periodoMs = tasa
        if (_iniciado) _configurarHardware()
    }

    /**
     * Suavizado de la lectura de aceleración: cuántas muestras se
     * promedian. Más muestras = menos ruido pero más retardo
     * (10 muestras = 50 ms a 200 Hz). No afecta a la velocidad, que
     * integra cada muestra sin promediar.
     * @param suavizado Nivel de suavizado
     */
    //% block="set acceleration smoothing %suavizado"
    //% blockId=fisicabit_cin_suavizado
    //% group="4. Optional"
    //% weight=85
    //% suavizado.defl=SuavizadoAcelerometro.Medio
    export function fijarSuavizado(suavizado: SuavizadoAcelerometro): void {
        let n = suavizado
        if (n < 1) n = 1
        if (n > MAX_VENTANA) n = MAX_VENTANA
        _ventana = n
        _reiniciarBuffers()
    }

    /**
     * Rango del acelerómetro. ±2 g (por defecto) da la mejor resolución;
     * usar ±4 g u ±8 g sólo si la medición satura (golpes, choques).
     * @param rango Rango de medición
     */
    //% block="set accelerometer range %rango"
    //% blockId=fisicabit_cin_rango
    //% group="4. Optional"
    //% weight=80
    //% rango.defl=RangoAcelerometro.Rango2G
    export function fijarRangoAcelerometro(rango: RangoAcelerometro): void {
        _rangoG = rango
        if (_iniciado) {
            _configurarHardware()
            _gRefValida = false
        }
    }

    /**
     * Mantiene fija la referencia de gravedad (no se corrige sola en
     * reposo). Activarlo si el experimento tiene pausas largas con la
     * placa inclinada respecto a la posición de calibración.
     * @param fija true = referencia fija, false = se corrige sola (por defecto)
     */
    //% block="keep gravity reference fixed %fija"
    //% blockId=fisicabit_cin_ref_fija
    //% group="4. Optional"
    //% weight=75
    //% fija.shadow=toggleOnOff
    //% fija.defl=false
    export function fijarReferenciaFija(fija: boolean): void {
        _refFija = fija
    }

    /**
     * Puesta a cero automática de la velocidad cuando la placa está
     * quieta (activada por defecto). Desactivarla sólo para movimientos
     * muy suaves a velocidad constante (riel de aire) donde el sensor no
     * distingue "quieto" de "deslizando sin vibrar".
     * @param activar true = poner v = 0 en reposo (por defecto)
     */
    //% block="auto-zero velocity at rest %activar"
    //% blockId=fisicabit_cin_zupt
    //% group="4. Optional"
    //% weight=70
    //% activar.shadow=toggleOnOff
    //% activar.defl=true
    export function fijarAutoCeroVelocidad(activar: boolean): void {
        _zupt = activar
    }

    /**
     * Valor de la gravedad local usado para convertir a m/s²
     * (por defecto 9,80665; Montevideo ≈ 9,797).
     * @param g Gravedad local en m/s², eg: 9.80665
     */
    //% block="set local gravity %g m/s²"
    //% blockId=fisicabit_cin_g_local
    //% group="4. Optional"
    //% weight=65
    //% g.min=9.7 g.max=9.9 g.defl=9.80665
    export function fijarGravedadLocal(g: number): void {
        if (g > 9 && g < 11) _gLocal = g
        _actualizarFactor()
    }

    /**
     * Gravedad medida por el sensor en reposo, en cuentas del chip
     * (≈1024 por g). Sirve para verificar la calibración: con la placa
     * quieta debería dar un valor estable cerca de 1024.
     */
    //% block="measured gravity (counts, ≈1024)"
    //% blockId=fisicabit_cin_mod_gravedad
    //% group="4. Optional"
    //% weight=60
    export function moduloGravedadEstimada(): number {
        _asegurarIniciado()
        return Math.round(_gMod)
    }

    /**
     * Estado del sensor: 1 = alta resolución activa (micro:bit v2),
     * 0 = modo normal, -1 = sensor no reconocido o simulador.
     */
    //% block="high-resolution mode status"
    //% blockId=fisicabit_cin_estado_hr
    //% group="4. Optional"
    //% weight=55
    export function estadoAltaResolucion(): number {
        _asegurarIniciado()
        return _hr
    }

    // =========================================================================
    // AVANZADO
    // =========================================================================

    function _mostrarPaso6(paso: number): void {
        if (paso === 0) basic.showIcon(IconNames.Square)
        else if (paso === 1) basic.showIcon(IconNames.SmallSquare)
        else if (paso === 2) basic.showLeds(`
            . . # . .
            . # # # .
            # . # . #
            . . # . .
            . . # . .`)
        else if (paso === 3) basic.showLeds(`
            . . # . .
            . . # . .
            # . # . #
            . # # # .
            . . # . .`)
        else if (paso === 4) basic.showLeds(`
            . . # . .
            . # . . .
            # # # # #
            . # . . .
            . . # . .`)
        else basic.showLeds(`
            . . # . .
            . . . # .
            # # # # #
            . . . # .
            . . # . .`)
    }

    /**
     * Calibración de fábrica en 6 posiciones (offset y escala de cada
     * eje). La pantalla muestra una flecha: apoyar la placa con ese lado
     * hacia ARRIBA, quieta, y apretar A. Seis veces. Al final muestra ✓.
     * Corrige el error de cero del chip (hasta ±80 mg) y la sensibilidad.
     */
    //% block="calibrate 6 positions (press A at each)"
    //% blockId=fisicabit_cin_cal6
    //% group="Advanced"
    //% weight=100
    //% advanced=true
    export function calibrar6Posiciones(): void {
        _asegurarIniciado()
        // Pantalla por paso: cuadrado = pantalla arriba, cuadrado chico =
        // pantalla abajo, flechas = logo arriba / logo abajo / borde
        // izquierdo arriba / borde derecho arriba
        let px = 0, nx = 0, py = 0, ny = 0, pz = 0, nz = 0
        let okx = 0, oky = 0, okz = 0
        for (let paso = 0; paso < 6; paso++) {
            _mostrarPaso6(paso)
            while (input.buttonIsPressed(Button.A)) basic.pause(20)
            while (!input.buttonIsPressed(Button.A)) basic.pause(20)
            basic.clearScreen()
            basic.pause(300)
            let sx = 0, sy = 0, sz = 0, n = 0
            const t0 = control.millis()
            while (control.millis() - t0 < 1000) {
                sx += input.acceleration(Dimension.X)
                sy += input.acceleration(Dimension.Y)
                sz += input.acceleration(Dimension.Z)
                n++
                basic.pause(_periodoMs)
            }
            const mx = sx / n, my = sy / n, mz = sz / n
            const ax = Math.abs(mx), ay = Math.abs(my), az = Math.abs(mz)
            // El eje dominante define qué cara está arriba
            if (ax >= ay && ax >= az) { if (mx > 0) { px = mx; okx |= 1 } else { nx = mx; okx |= 2 } }
            else if (ay >= ax && ay >= az) { if (my > 0) { py = my; oky |= 1 } else { ny = my; oky |= 2 } }
            else { if (mz > 0) { pz = mz; okz |= 1 } else { nz = mz; okz |= 2 } }
            basic.showIcon(IconNames.Yes)
            basic.pause(400)
        }
        if (okx === 3 && oky === 3 && okz === 3) {
            _offX = (px + nx) / 2; _escX = CUENTAS_G / ((px - nx) / 2)
            _offY = (py + ny) / 2; _escY = CUENTAS_G / ((py - ny) / 2)
            _offZ = (pz + nz) / 2; _escZ = CUENTAS_G / ((pz - nz) / 2)
            _cal6 = true
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
        }
        basic.pause(800)
        basic.clearScreen()
        _gRefValida = false
        reiniciarVelocidad()
    }

    /**
     * Carga una calibración de 6 posiciones guardada (ver "send
     * calibration via serial").
     */
    //% block="set calibration offX %ox offY %oy offZ %oz scaleX %sx scaleY %sy scaleZ %sz"
    //% blockId=fisicabit_cin_cal_manual
    //% group="Advanced"
    //% weight=95
    //% advanced=true
    //% sx.defl=1 sy.defl=1 sz.defl=1
    export function calibracionManual(ox: number, oy: number, oz: number, sx: number, sy: number, sz: number): void {
        _offX = ox; _offY = oy; _offZ = oz
        _escX = sx > 0 ? sx : 1; _escY = sy > 0 ? sy : 1; _escZ = sz > 0 ? sz : 1
        _cal6 = true
        _gRefValida = false
    }

    /**
     * Envía por USB la calibración actual como una línea
     * "FB_CAL,offX,offY,offZ,scX,scY,scZ" para anotarla y volver a
     * cargarla con "set calibration".
     */
    //% block="send calibration via serial"
    //% blockId=fisicabit_cin_enviar_cal
    //% group="Advanced"
    //% weight=90
    //% advanced=true
    export function enviarCalibracionSerial(): void {
        serial.writeLine("FB_CAL," + _offX + "," + _offY + "," + _offZ + "," + _escX + "," + _escY + "," + _escZ)
    }

    /**
     * Activa o desactiva el modo de alta resolución del chip (activo por
     * defecto). Sólo para diagnóstico.
     * @param activar true = 12 bits (por defecto), false = 10 bits
     */
    //% block="use high-resolution mode %activar"
    //% blockId=fisicabit_cin_hr
    //% group="Advanced"
    //% weight=85
    //% advanced=true
    //% activar.shadow=toggleOnOff
    //% activar.defl=true
    export function fijarAltaResolucion(activar: boolean): void {
        _altaRes = activar
        if (_iniciado) _configurarHardware()
    }

    /**
     * Aceleración cruda del sensor en cuentas (≈1024 por g), promediada,
     * sin calibración ni resta de gravedad. Para diagnóstico.
     * @param eje Eje X, Y o Z
     */
    //% block="raw acceleration (counts) %eje"
    //% blockId=fisicabit_cin_cruda
    //% group="Advanced"
    //% weight=80
    //% advanced=true
    //% eje.defl=EjeAceleracion.Z
    export function aceleracionCruda(eje: EjeAceleracion): number {
        _asegurarIniciado()
        const m = _mediaCruda()
        return Math.round(_componente(m, eje) * 10) / 10
    }

    /**
     * Cantidad de muestras del sensor procesadas por segundo (diagnóstico:
     * debería coincidir con la frecuencia configurada).
     */
    //% block="samples per second"
    //% blockId=fisicabit_cin_sps
    //% group="Advanced"
    //% weight=75
    //% advanced=true
    export function muestrasPorSegundo(): number {
        _asegurarIniciado()
        const antes = _muestras
        basic.pause(500)
        return (_muestras - antes) * 2
    }

    /**
     * Convierte miligravedades (mg) a m/s² con la gravedad local.
     * @param mg Valor en mg
     */
    //% block="convert %mg mg → m/s²"
    //% blockId=fisicabit_cin_mg_a_ms2
    //% group="Advanced"
    //% weight=70
    //% advanced=true
    export function convertirMgAMs2(mg: number): number {
        return _redondear2(mg * _gLocal / 1000)
    }

    // ── Atajos por eje (compatibilidad con proyectos anteriores) ──────────
    //% block="acceleration X (m/s²)"
    //% blockId=fisicabit_cin_accel_x
    //% group="Advanced" weight=40 advanced=true
    export function aceleracionX(): number { return leerAceleracionLineal(EjeAceleracion.X) }
    //% block="acceleration Y (m/s²)"
    //% blockId=fisicabit_cin_accel_y
    //% group="Advanced" weight=39 advanced=true
    export function aceleracionY(): number { return leerAceleracionLineal(EjeAceleracion.Y) }
    //% block="acceleration Z (m/s²)"
    //% blockId=fisicabit_cin_accel_z
    //% group="Advanced" weight=38 advanced=true
    export function aceleracionZ(): number { return leerAceleracionLineal(EjeAceleracion.Z) }
    //% block="vertical acceleration (m/s²)"
    //% blockId=fisicabit_cin_accel_vert
    //% group="Advanced" weight=37 advanced=true
    export function aceleracionVertical(): number { return leerAceleracionLineal(EjeAceleracion.Vertical) }
    //% block="acceleration magnitude (m/s²)"
    //% blockId=fisicabit_cin_accel_mag
    //% group="Advanced" weight=36 advanced=true
    export function aceleracionMagnitud(): number { return leerAceleracionLineal(EjeAceleracion.Magnitud) }

    // ── Bloques anteriores (obsoletos): se mantienen para que compile ─────
    //% block="update gravity estimate"
    //% blockId=fisicabit_cin_actualizar_gravedad
    //% group="Advanced" weight=10 deprecated=true
    export function actualizarGravedad(): void { calibrarEnReposo() }
    //% block="set gravity filter α to %alfa"
    //% blockId=fisicabit_cin_fijar_alfa
    //% group="Advanced" weight=9 deprecated=true
    export function fijarAlfaGravedad(alfa: number): void { }
    //% block="unlock gravity tracking"
    //% blockId=fisicabit_cin_unlock
    //% group="Advanced" weight=8 deprecated=true
    export function desbloquearGravedad(): void { _refFija = false }
    //% block="calibrate magnetometer (rotate micro:bit)"
    //% blockId=fisicabit_cin_cal_mag
    //% group="Advanced" weight=7 deprecated=true
    export function calibrarMagnetometro(): void { input.calibrateCompass() }
    //% block="heading (°)"
    //% blockId=fisicabit_cin_heading
    //% group="Advanced" weight=6 deprecated=true
    export function heading(): number { return input.compassHeading() }
    //% block="magnetometer calibrated?"
    //% blockId=fisicabit_cin_mag_calibrado
    //% group="Advanced" weight=5 deprecated=true
    export function magnetometroCalibrado(): boolean { return true }
    //% block="enable dual mode (accelerometer + magnetometer)"
    //% blockId=fisicabit_cin_dual
    //% group="Advanced" weight=4 deprecated=true
    export function habilitarModoDual(): void { }
    //% block="magnetic disturbance detected?"
    //% blockId=fisicabit_cin_mag_disturbed
    //% group="Advanced" weight=3 deprecated=true
    export function magnetometroAlterado(): boolean { return false }
}
