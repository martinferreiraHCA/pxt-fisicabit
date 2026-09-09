# FisicaBit Sensores — Extensión para micro:bit

> 🇬🇧 [English version](README-en.md)

> Extensión de MakeCode para experimentos de física con micro:bit: sensores, barreras ópticas y envío de datos a [fisicabit.com](https://fisicabit.com) con un solo bloque, por USB o por Bluetooth.
> Proyecto: [fisicabit.com](https://fisicabit.com)

## Cómo usar esta extensión

En MakeCode, entrá a **Extensiones** y pegá la URL de este repositorio:

```
https://github.com/martinferreiraHCA/pxt-fisicabit
```

O buscá **fisicabit-sensores** en el cuadro de Extensiones.

Los bloques aparecen en el idioma del editor: en español si MakeCode está en español, en inglés si está en inglés (también hay traducción parcial a portugués). El idioma se cambia en el menú **⚙ Configuración → Idioma**. Si la extensión ya estaba agregada a un proyecto y los bloques siguen en inglés, quitala y volvé a agregarla (MakeCode guarda en caché la versión anterior). Para probar una versión concreta antes de publicarla, pegá en Extensiones la URL con el commit: `https://github.com/martinferreiraHCA/pxt-fisicabit#<sha>`.

## Inicio rápido: enviar datos a fisicabit.com

**Por USB (cable):** un solo bloque envía `tiempo,valor` cada 100 ms (10 muestras por segundo).

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 100)
})
```

**Por Bluetooth (sin cable):** el primer bloque deja el micro:bit listo para que fisicabit.com lo encuentre; el segundo envía los datos sólo mientras la página está conectada.

```blocks
FisicaBitBT.inicioRapido()
basic.forever(function () {
    FisicaBitBT.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

En fisicabit.com: elegí **USB** o **Bluetooth**, poné el **número de variables** igual a la cantidad de valores del bloque (sin contar el tiempo) y dejá activada la opción **"Micro:bit envía timestamp"**.

| Pantalla LED (Bluetooth) | Significado |
|---------------------------|-------------|
| ◎ diana | Esperando que fisicabit.com se conecte |
| ♥ corazón | Conectado, enviando datos |

## Tutoriales paso a paso

Abrí estos enlaces en MakeCode. El tutorial aparece en el idioma del editor (español, inglés o portugués) y ya incluye los bloques de FisicaBit:

* **USB:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-usb
* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-bluetooth

Los tutoriales viven en `tutorial-usb.md` y `tutorial-bluetooth.md` (inglés, idioma base) con sus traducciones en `_locales/es/` y `_locales/pt-BR/`. Para probar cambios recientes abrí el enlace en una ventana de incógnito, porque MakeCode guarda los tutoriales en caché.

## Bloques disponibles

### Sensores internos

```blocks
let temp = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
basic.showNumber(temp)
```

| Bloque | Descripción |
|--------|-------------|
| `leer sensor interno [temperatura]` | Lee los sensores integrados del micro:bit (temperatura, acelerómetro, luz, brújula, sonido) |

### Sensores externos

```blocks
let lectura = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
```

| Bloque | Descripción |
|--------|-------------|
| `leer sensor analógico en [P0]` | Lee potenciómetro, LDR, NTC (0-1023) |
| `leer sensor digital en P[8]` | Lee PIR, infrarrojo, interruptor (0/1) |
| `HC-SR04 distancia TRIG P1 ECHO P2 en [cm]` | Mide distancia con HC-SR04 |

### Barrera óptica (experimentos de tiempo)

```blocks
let tiempoMs = FisicaBit.medirTiempoBarrera(PinAnalogico.P1, PinAnalogico.P2, ModoBarrera.Digital, 10000)
let velocidad = FisicaBit.calcularVelocidad(tiempoMs * 1000, 100)
```

| Bloque | Descripción |
|--------|-------------|
| `fijar umbral barrera a [512]` | Calibra el nivel de disparo de una barrera analógica |
| `leer barrera crudo pin [P1] modo [analógico]` | Valor crudo del sensor para calibrar |
| `barrera activada en [P1] modo [digital]` | Indica si un objeto corta el haz |
| `medir tiempo barrera A [P1] → B [P2]` | Tiempo de tránsito entre dos barreras (resolución ~1 ms) |
| `[C++] tiempo barrera A P1 → B P2` | Temporización nativa en C++ (resolución ~1 μs) |
| `velocidad con tiempo [μs] distancia [mm]` | Calcula la velocidad (devuelve m/s × 100) |
| `tiempo de bloqueo en [P1]` | Cuánto tiempo un objeto bloquea una barrera |

### FisicaBit USB: enviar a fisicabit.com por cable

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

Un solo bloque lo configura todo: `enviar a fisicabit.com tiempo y [valor] cada [100] ms`. En cada vuelta toma el tiempo del micro:bit (arranca en 0), escribe una línea CSV (`tiempo,valor`) a 115200 baudios y espera hasta que se cumplan los ms indicados. La espera se calcula sobre el instante previsto, así el período real coincide aunque `para siempre` agregue su retardo oculto de ~20 ms. Los bloques aparecen en el orden en que se usan.

| Paso | Bloque | Descripción |
|------|--------|-------------|
| 1. Enviar | `enviar a fisicabit.com tiempo y [valor] cada [100] ms` | Dentro de `para siempre`. Variantes de 2, 3 y 4 valores. 100 ms = 10 muestras por segundo |
| Envío de datos sin tiempo | `enviar a fisicabit.com sin tiempo [valor] cada [100] ms` | Manda sólo los valores medidos (variantes de 2, 3 y 4). En fisicabit.com desactivá "Micro:bit envía timestamp": la página usa el reloj del navegador |
| 2. Opcional | `bucle rápido para fisicabit.com cada [20] ms` | En lugar de `para siempre`, para 50 / 100 Hz sin el retardo oculto; el bloque de envío va adentro |
| 2. Opcional | `reiniciar tiempo USB a 0` | Empezar una nueva medición en t = 0 (por ejemplo al apretar A) |
| 2. Opcional | `tiempo USB (ms)` | El tiempo que viaja en cada línea |
| Avanzado | `USB enviar tiempo del micro:bit [activado]`, `USB fijar decimales [2]`, `USB enviar línea [texto]`, `configurar frecuencia / intervalo` | Sólo si hace falta |

### Conversiones

| Bloque | Descripción |
|--------|-------------|
| `convertir [23] de [°C] a [°F]` | Convierte temperatura entre unidades |
| `mapear [512] de (0—1023) a (0—100)` | Escala valores a otro rango |

### Nativo C++ (avanzado)

| Bloque | Descripción |
|--------|-------------|
| `[C++] leer ADC nativo canal [0]` | Lectura ADC de 12 bits (0-4095) |
| `[C++] leer ADC promedio canal [0] muestras [16]` | ADC con sobremuestreo para reducir ruido |
| `[C++] medir pulso pin P[2] nivel [ALTO] timeout [25000] μs` | Temporización precisa de pulsos |

### FisicaBit Bluetooth: enviar a fisicabit.com sin cable

```blocks
FisicaBitBT.inicioRapido()
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X), 100)
})
```

| Paso | Bloque | Descripción |
|------|--------|-------------|
| 1. Iniciar | `iniciar Bluetooth para fisicabit.com` | **Primero** en `al iniciar`: servicio UART, potencia máxima, íconos ◎ / ♥ en la pantalla |
| 2. Enviar | `enviar a fisicabit.com por Bluetooth tiempo y [valor] cada [100] ms` | Dentro de `para siempre`. Variantes de 2, 3 y 4 valores; sólo transmite mientras hay conexión. Por BLE, 50 ms o más |
| Envío de datos sin tiempo | `enviar a fisicabit.com por Bluetooth sin tiempo [valor] cada [100] ms` | Manda sólo los valores medidos (variantes de 2, 3 y 4). En fisicabit.com desactivá "Micro:bit envía timestamp" |
| 3. Opcional | `¿Bluetooth conectado?`, `al conectar / al desconectar`, `reiniciar tiempo Bluetooth a 0`, `tiempo Bluetooth (ms)`, `bucle rápido ... por Bluetooth cada [50] ms`, `mostrar íconos de conexión` | Estado de la conexión y control del tiempo |
| Avanzado | `enviar tiempo del micro:bit`, `fijar decimales`, `enviar texto`, `iniciar con todos los servicios BLE`, `configurar frecuencia / intervalo` | Sólo si hace falta |

Por qué estos bloques conectan sin problemas:

* Sólo se inicia el servicio UART. Cada servicio BLE extra hace más lento el descubrimiento (sobre todo en Windows) y puede vencer el timeout de supervisión de 4 s del firmware.
* La potencia de transmisión se fija al máximo (7).
* Las líneas son cortas (tiempo desde 0, 2 decimales, terminador `\n`), así cada muestra entra en un único paquete BLE de 20 bytes.
* No se envía nada mientras no hay una página conectada; el muestreo mantiene su ritmo y los datos vuelven solos al reconectar. El tiempo arranca en 0 en cada conexión.
* Si BLE se atrasa, el muestreador se resincroniza en vez de mandar una ráfaga de muestras viejas.

## Ejemplos de conexión

### Sensor ultrasónico HC-SR04
```
HC-SR04 TRIG → micro:bit P1
HC-SR04 ECHO → micro:bit P2
HC-SR04 VCC  → micro:bit 3V
HC-SR04 GND  → micro:bit GND
```

### Barrera óptica FC-33 (digital)
```
FC-33 #1 OUT → P1 (barrera A)
FC-33 #2 OUT → P2 (barrera B)
Ambos VCC → 3V, GND → GND
```

### Barrera IR casera (analógica)
```
Emisor:   3V → R(100Ω) → LED IR → GND
Receptor: 3V → Fototransistor → Pin (señal)
                                 ├── R(10KΩ) → GND
```

## Configuración de Bluetooth

1. Esta extensión ya impone "sin vinculación" (**No Pairing Required**) desde su `pxt.json` (`yotta.config.microbit-dal.bluetooth`: `open: 1, pairing_mode: 0, whitelist: 0`), así que no hace falta tocar nada en el proyecto. Si igual querés verificarlo: **⚙ Configuración → Configuración del proyecto → No Pairing Required**.
2. Poné `iniciar Bluetooth para fisicabit.com` como primer bloque de `al iniciar`.
3. Cargá el programa, esperá el ícono ◎, después tocá **Bluetooth** en fisicabit.com y elegí `BBC micro:bit [xxxxx]`.
4. Si un micro:bit que estuvo vinculado antes no se conecta, quitalo ("olvidar") de la configuración Bluetooth del sistema operativo y volvé a intentar.

Notas:

* Bluetooth y la extensión **Radio** no pueden usarse en el mismo programa. El serial USB sí sigue funcionando junto con Bluetooth.
* La velocidad práctica por BLE es de hasta ~20 Hz; para 50–100 Hz usá USB.
* Los bloques viejos `BT muestrear ... cada ... ms` y `Serial muestrear ... cada ... ms` siguen compilando pero están ocultos; usá los nuevos bloques `enviar a fisicabit.com tiempo y ... cada ... ms`.

### Compatibilidad de navegadores

| Plataforma | Navegador | USB (Web Serial) | Bluetooth (Web Bluetooth) |
|------------|-----------|------------------|---------------------------|
| Windows / macOS / Linux / ChromeOS | Chrome, Edge | Sí | Sí |
| Android | Chrome | No | Sí |
| iOS / iPadOS | Safari | No | No (Apple no soporta Web Serial ni Web Bluetooth) |

Los datos se reciben en [fisicabit.com](https://fisicabit.com) en tiempo real.

## Referencia de pines del micro:bit

```
Pines analógicos (ADC):   P0, P1, P2
Pines digitales libres:   P8, P12, P16
Bus I2C:                  P19 (SCL), P20 (SDA)
Bus SPI:                  P13 (SCK), P14 (MISO), P15 (MOSI)
Compartidos con los LED:  P3, P4, P5, P6, P7, P9, P10, P11
```

## Plataformas soportadas

* PXT/microbit

## Licencia

MIT

<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
