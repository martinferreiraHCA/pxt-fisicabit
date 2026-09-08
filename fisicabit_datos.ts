// =============================================================================
//  fisicabit_datos.ts — Núcleo compartido de muestreo y formato de datos
// =============================================================================
//  Proyecto: FisicaBit.com
//  Descripción: Lógica común usada por "FisicaBit USB" (serial_sensores.ts)
//               y "FisicaBit Bluetooth" (bluetooth_sensores.ts):
//
//    • Formato de números compacto (ASCII, pocos decimales) → líneas cortas.
//      Por Bluetooth cada paquete UART BLE lleva 20 bytes como máximo, así
//      que una línea corta viaja en UN solo paquete y llega más rápido.
//    • Muestreador con temporización por "deadline": el bloque de envío
//      espera hasta el próximo instante de muestreo en lugar de hacer una
//      pausa fija. Así el período real coincide con el configurado aunque
//      el bucle "para siempre" agregue su retardo oculto de ~20 ms.
//
//  FORMATO ESPERADO POR fisicabit.com (una línea por muestra, CSV):
//    tiempo,valor1,valor2,...   (opción "Micro:bit envía timestamp" activada)
//    valor1,valor2,...          (sin timestamp: la página usa su reloj)
//
//  Este archivo NO define bloques; sólo código de apoyo.
// =============================================================================

namespace FisicaBitDatos {

    export const PERIODO_MIN_MS = 5
    export const PERIODO_MAX_MS = 60000

    /**
     * Convierte un número a texto compacto para enviar a fisicabit.com.
     * - Enteros se envían tal cual ("-1023").
     * - Decimales se redondean a `decimales` cifras y se quitan los ceros
     *   finales ("3.50" → "3.5", "2.001" → "2" con 2 decimales).
     * - Nunca produce "-0".
     */
    export function formatear(v: number, decimales: number): string {
        // NaN o infinito: dejar la conversión estándar
        if (v !== v || v === Infinity || v === -Infinity) return "" + v
        if (v === Math.floor(v)) return "" + v
        if (decimales <= 0) return "" + Math.round(v)
        if (decimales > 6) decimales = 6

        const neg = v < 0
        let a = neg ? -v : v
        // Valores enormes: la aritmética entera de abajo perdería precisión
        if (a >= 10000000) return "" + Math.round(v)

        let pot = 1
        for (let i = 0; i < decimales; i++) pot *= 10
        const esc = Math.round(a * pot)
        const ip = Math.idiv(esc, pot)
        const fp = esc - ip * pot

        if (fp === 0) {
            return "" + (neg ? -ip : ip)
        }
        let fs = "" + fp
        while (fs.length < decimales) fs = "0" + fs
        while (fs.length > 1 && fs.charAt(fs.length - 1) === "0") {
            fs = fs.substr(0, fs.length - 1)
        }
        return (neg ? "-" : "") + ip + "." + fs
    }

    /**
     * Muestreador: mantiene el período configurado, el origen de tiempo y
     * arma las líneas CSV. Hay una instancia para USB y otra para Bluetooth.
     */
    export class Muestreador {
        periodoMs: number
        enviarTiempo: boolean
        decimales: number
        enBucle: boolean
        private _proximo: number
        private _origen: number

        constructor() {
            this.periodoMs = 100
            this.enviarTiempo = true
            this.decimales = 2
            this.enBucle = false
            this._proximo = 0
            this._origen = input.runningTime()
        }

        /** Milisegundos desde el origen de tiempo (arranca en 0). */
        tiempo(): number {
            return input.runningTime() - this._origen
        }

        /** Vuelve el tiempo a 0 y resincroniza el muestreo. */
        reiniciarTiempo(): void {
            this._origen = input.runningTime()
            this._proximo = 0
        }

        /** Fija el período de muestreo en ms (acotado a un rango seguro). */
        fijarPeriodo(ms: number): void {
            if (ms !== ms || ms < PERIODO_MIN_MS) ms = PERIODO_MIN_MS
            if (ms > PERIODO_MAX_MS) ms = PERIODO_MAX_MS
            this.periodoMs = Math.round(ms)
            this._proximo = 0
        }

        /** Arma la línea CSV: [tiempo,]v1,v2,... */
        linea(valores: number[]): string {
            let s = this.enviarTiempo ? ("" + this.tiempo()) : ""
            for (let i = 0; i < valores.length; i++) {
                if (s.length > 0) s += ","
                s += formatear(valores[i], this.decimales)
            }
            return s
        }

        /**
         * Espera hasta el próximo instante de muestreo.
         * Si el programa se atrasó más de un período (p. ej. Bluetooth lento),
         * se resincroniza en vez de "correr" para recuperar muestras perdidas.
         * Dentro del bucle de muestreo (enBucle) no espera: el bucle ya lo hace.
         */
        esperar(): void {
            if (this.enBucle) return
            this.esperarSiempre()
        }

        esperarSiempre(): void {
            const ahora = input.runningTime()
            if (this._proximo === 0 || ahora - this._proximo > this.periodoMs) {
                this._proximo = ahora + this.periodoMs
            } else {
                this._proximo += this.periodoMs
            }
            const espera = this._proximo - ahora
            if (espera > 0) {
                basic.pause(espera)
            } else {
                // Atrasados: ceder el procesador igual para no bloquear otros hilos
                basic.pause(1)
            }
        }

        /**
         * Ejecuta `cuerpo` en segundo plano con el período configurado,
         * sin el retardo oculto de "para siempre".
         */
        bucle(cuerpo: () => void): void {
            control.inBackground(() => {
                this._proximo = 0
                while (true) {
                    this.enBucle = true
                    cuerpo()
                    this.enBucle = false
                    this.esperarSiempre()
                }
            })
        }
    }
}
