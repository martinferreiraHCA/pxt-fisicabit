// =============================================================================
// compat-bt.ts — Legacy Spanish API of the fisicabit-bt package (fisicabit.com)
// =============================================================================
// Only shipped in the "bluetooth" package generated for fisicabit.com by
// tools/mirror-site.py. The site injects FisicaBitBT.inicioRapido() and
// FisicaBitBT.enviar1(...) into new Bluetooth projects; these forwarders keep
// those programs compiling. No blocks are defined here.
// =============================================================================

/** Legacy names of the FisicaBit BT package; forwards to fisicabitBluetooth. */
namespace FisicaBitBT {
    /** Legacy alias of fisicabitBluetooth.quickStart. */
    export function inicioRapido(): void { fisicabitBluetooth.quickStart() }
    /** Legacy alias of fisicabitBluetooth.fullStart. */
    export function inicioCompleto(): void { fisicabitBluetooth.fullStart() }
    /** Legacy alias of fisicabitBluetooth.send1. */
    export function enviar1(valor: number, ms: number): void { fisicabitBluetooth.send1(valor, ms) }
    /** Legacy alias of fisicabitBluetooth.send2. */
    export function enviar2(valor1: number, valor2: number, ms: number): void { fisicabitBluetooth.send2(valor1, valor2, ms) }
    /** Legacy alias of fisicabitBluetooth.send3. */
    export function enviar3(valor1: number, valor2: number, valor3: number, ms: number): void { fisicabitBluetooth.send3(valor1, valor2, valor3, ms) }
    /** Legacy alias of fisicabitBluetooth.send4. */
    export function enviar4(valor1: number, valor2: number, valor3: number, valor4: number, ms: number): void { fisicabitBluetooth.send4(valor1, valor2, valor3, valor4, ms) }
    /** Legacy alias of fisicabitBluetooth.sendWithoutTime1. */
    export function enviarSinTiempo1(valor: number): void { fisicabitBluetooth.sendWithoutTime1(valor) }
    /** Legacy alias of fisicabitBluetooth.sendWithoutTime2. */
    export function enviarSinTiempo2(valor1: number, valor2: number): void { fisicabitBluetooth.sendWithoutTime2(valor1, valor2) }
    /** Legacy alias of fisicabitBluetooth.sendWithoutTime3. */
    export function enviarSinTiempo3(valor1: number, valor2: number, valor3: number): void { fisicabitBluetooth.sendWithoutTime3(valor1, valor2, valor3) }
    /** Legacy alias of fisicabitBluetooth.sendWithoutTime4. */
    export function enviarSinTiempo4(valor1: number, valor2: number, valor3: number, valor4: number): void { fisicabitBluetooth.sendWithoutTime4(valor1, valor2, valor3, valor4) }
    /** Legacy alias of fisicabitBluetooth.sendText. */
    export function enviarTexto(texto: string): void { fisicabitBluetooth.sendText(texto) }
    /** Legacy alias of fisicabitBluetooth.sendTimestamp. */
    export function enviarTimestamp(activar: boolean): void { fisicabitBluetooth.sendTimestamp(activar) }
    /** Legacy alias of fisicabitBluetooth.isConnected. */
    export function estaConectado(): boolean { return fisicabitBluetooth.isConnected() }
    /** Legacy alias of fisicabitBluetooth.setDecimals. */
    export function fijarDecimales(decimales: number): void { fisicabitBluetooth.setDecimals(decimales) }
    /** Legacy alias of fisicabitBluetooth.showIcons. */
    export function mostrarIconos(mostrar: boolean): void { fisicabitBluetooth.showIcons(mostrar) }
    /** Legacy alias of fisicabitBluetooth.resetTime. */
    export function reiniciarTiempo(): void { fisicabitBluetooth.resetTime() }
    /** Legacy alias of fisicabitBluetooth.time. */
    export function tiempo(): number { return fisicabitBluetooth.time() }
    /** Legacy alias of fisicabitBluetooth.sampleLoop. */
    export function bucleMuestreo(ms: number, cuerpo: () => void): void { fisicabitBluetooth.sampleLoop(ms, cuerpo) }
}
