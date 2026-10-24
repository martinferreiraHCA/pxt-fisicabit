# FisicaBit Bluetooth — extensión para micro:bit (V2)

> 🇬🇧 English version (main documentation): [README.md](https://github.com/martinferreiraHCA/pxt-fisicabit/blob/main/bluetooth/README.md)

Complemento de [fisicabit-sensores](https://github.com/martinferreiraHCA/pxt-fisicabit): envía tiempo y valores de sensores a [fisicabit.com](https://fisicabit.com) por Bluetooth Low Energy (servicio UART). Es una extensión aparte porque MakeCode no puede combinar `bluetooth` con la extensión `radio` que trae todo proyecto nuevo; separándola, `fisicabit-sensores` se puede usar en cualquier proyecto.

## ~ hint

#### Solo micro:bit (V2)

Funciona únicamente con la micro:bit V2 (depende de fisicabit-sensores, que usa el runtime de la V2 y código nativo; la compilación para V1 está desactivada).

## ~

## Cómo usar esta extensión

En MakeCode, abrí **Extensiones** y pegá:

```
github:martinferreiraHCA/pxt-fisicabit/bluetooth
```

Trae `fisicabit-sensores` consigo. MakeCode va a avisar que `radio` y `bluetooth` no pueden usarse juntas: elegí **Quitar radio**. En **⚙ Configuración → Configuración del proyecto** elegí **No se requiere emparejamiento**.

## Tutorial paso a paso

* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-bluetooth

## Bloques

### fisicabit Bluetooth: enviar a fisicabit.com sin cable

```blocks
fisicabitBluetooth.quickStart()
basic.forever(function () {
    fisicabitBluetooth.send1(input.acceleration(Dimension.X), 100)
})
```

| Paso | Bloque | Descripción |
|------|--------|-------------|
| 1. Iniciar | `iniciar Bluetooth para fisicabit.com` | **Primero** en `al iniciar`: servicio UART, potencia máxima, íconos ◎ / ♥ en la pantalla |
| 2. Enviar | `enviar a fisicabit.com por Bluetooth tiempo y [valor] cada [100] ms` | Dentro de `para siempre`. Variantes de 2 y 3 valores (fisicabit.com admite hasta 3 variables); sólo transmite mientras hay conexión. Por BLE, 50 ms o más |
| Envío de datos sin tiempo | `enviar a fisicabit.com por Bluetooth sin tiempo [valor]` | Manda sólo los valores medidos, sin tiempo y sin espera (variantes de 2, 3 y 4). En fisicabit.com desactivá "Micro:bit envía timestamp" |
| 3. Opcional | `¿Bluetooth conectado?`, `al conectar / al desconectar`, `reiniciar tiempo Bluetooth a 0`, `tiempo Bluetooth (ms)`, `bucle rápido ... por Bluetooth cada [50] ms`, `mostrar íconos de conexión` | Estado de la conexión y control del tiempo |
| Avanzado | `enviar tiempo del micro:bit`, `fijar decimales`, `enviar texto`, `iniciar con todos los servicios BLE`, `configurar frecuencia / intervalo` | Sólo si hace falta |

Por qué estos bloques conectan sin problemas:

* Sólo se inicia el servicio UART. Cada servicio BLE extra hace más lento el descubrimiento (sobre todo en Windows) y puede vencer el timeout de supervisión de 4 s del firmware.
* La potencia de transmisión se fija al máximo (7).
* Las líneas son cortas (tiempo desde 0, 2 decimales, terminador `\n`), así cada muestra entra en un único paquete BLE de 20 bytes.
* No se envía nada mientras no hay una página conectada; el muestreo mantiene su ritmo y los datos vuelven solos al reconectar. El tiempo arranca en 0 en cada conexión.
* Si BLE se atrasa, el muestreador se resincroniza en vez de mandar una ráfaga de muestras viejas.

## Cómo se integra con fisicabit-sensores

Al arrancar el programa, esta extensión registra su transporte con `fisicabitData.registerBluetooth`. Desde ese momento la opción `enviar ... vía [Bluetooth]` de los bloques de cinemática, ToF y ultrasonido de fisicabit-sensores manda por Bluetooth; sin esta extensión, esos bloques envían por USB.

## Configuración de Bluetooth

1. En MakeCode abrí **⚙ Configuración → Configuración del proyecto** y elegí **No se requiere emparejamiento** (*No Pairing Required*). La extensión ya no cambia esta configuración por sí misma; fisicabit.com se conecta sin emparejar, así que *JustWorks* o *Passkey* hacen que el teléfono conecte pero nunca reciba datos.
2. Poné `iniciar Bluetooth para fisicabit.com` como primer bloque de `al iniciar`.
3. Cargá el programa, esperá el ícono ◎, después tocá **Bluetooth** en fisicabit.com y elegí `BBC micro:bit [xxxxx]`.
4. Si un micro:bit que estuvo vinculado antes no se conecta, quitalo ("olvidar") de la configuración Bluetooth del sistema operativo y volvé a intentar.

Notas:

* Bluetooth y la extensión **Radio** no pueden usarse en el mismo programa. El serial USB sí sigue funcionando junto con Bluetooth.
* La velocidad práctica por BLE es de hasta ~20 Hz; para 50–100 Hz usá USB.
* Los bloques viejos `BT muestrear ... cada ... ms` y `Serial muestrear ... cada ... ms` siguen compilando pero están ocultos; usá los nuevos bloques `enviar a fisicabit.com tiempo y ... cada ... ms`.

### Si conecta pero no llegan datos (celular / Android)

Síntoma: fisicabit.com muestra el micro:bit como conectado, pero la tabla y la gráfica quedan vacías. Casi siempre la causa está en la configuración del proyecto o en el vínculo guardado por el teléfono, no en la página. Probá en este orden:

1. **Vínculo viejo en el teléfono.** En Android: Ajustes → Bluetooth → `BBC micro:bit [xxxxx]` → **Olvidar**. Después reiniciá el micro:bit (botón de atrás) y volvé a conectar desde fisicabit.com. Un vínculo guardado con claves de un programa anterior hace que el teléfono conecte pero nunca active las notificaciones del canal de datos.
2. **Configuración del proyecto.** En MakeCode: **⚙ → Configuración del proyecto** tiene que estar en **No Pairing Required**. Si el proyecto está en *JustWorks pairing* o *Passkey pairing*, el `.hex` exige vinculación y el teléfono conecta pero no puede leer datos hasta que se empareja desde Ajustes → Bluetooth. Elegí *No Pairing Required*, volvé a **descargar el .hex** y cargalo de nuevo.
3. **Versión de la extensión.** En el editor, en **Extensiones**, verificá que `fisicabit-sensores` esté actualizada. Si no, quitala y agregala de nuevo desde `https://github.com/martinferreiraHCA/pxt-fisicabit`, y descargá el `.hex` otra vez: **el firmware ya cargado en la placa no se actualiza solo**.
4. **Bloques.** `iniciar Bluetooth para fisicabit.com` va **dentro de `al iniciar`**, y el bloque `enviar a fisicabit.com por Bluetooth ...` **dentro de `para siempre`**. Sin ese bloque de inicio el servicio UART no existe y la página conecta sin canal de datos.
5. **fisicabit.com.** Elegí **Bluetooth**, poné el **número de variables** igual a la cantidad de valores del bloque (sin contar el tiempo) y dejá **"Micro:bit envía timestamp"** activado (o desactivado si usás los bloques *sin tiempo*). Si no coincide, las líneas llegan pero se descartan.
6. **Navegador.** En Android sólo **Chrome** (o Edge/Samsung Internet basados en Chromium) tiene Web Bluetooth; Firefox no, y en iPhone/iPad ningún navegador. La pantalla del teléfono tiene que quedar encendida con la pestaña visible: si Android la pone en segundo plano se corta la recepción.
7. **Intervalo.** Por BLE usá 50 ms o más en el bloque de envío. Si un bloque de la misma pantalla tiene 5–10 ms, se saturan las indicaciones y los datos llegan en ráfagas o no llegan.

Cuando la conexión está bien, el micro:bit muestra ♥ y en fisicabit.com aparece una línea nueva por cada intervalo.

### Compatibilidad de navegadores

| Plataforma | Navegador | USB (Web Serial) | Bluetooth (Web Bluetooth) |
|------------|-----------|------------------|---------------------------|
| Windows / macOS / Linux / ChromeOS | Chrome, Edge | Sí | Sí |
| Android | Chrome | No | Sí |
| iOS / iPadOS | Safari | No | No (Apple no soporta Web Serial ni Web Bluetooth) |

Los datos se reciben en [fisicabit.com](https://fisicabit.com) en tiempo real.

## Plataformas soportadas

* for PXT/microbit (solo micro:bit V2)

## Licencia

MIT
