# fisicabit Sensores — Extensión para micro:bit

> 🇬🇧 English version (main documentation): [README.md](https://github.com/martinferreiraHCA/pxt-fisicabit/blob/main/README.md)

> Extensión de MakeCode para experimentos de física con micro:bit: sensores, barreras ópticas y envío de datos a [fisicabit.com](https://fisicabit.com) con un solo bloque, por USB o por Bluetooth.
> Proyecto: [fisicabit.com](https://fisicabit.com)


## ~ hint

#### Solo micro:bit (V2)

Esta extensión funciona únicamente con la micro:bit V2: usa el runtime CODAL de la V2, el micrófono integrado y muestreadores nativos en C++, y la compilación para V1 está desactivada en `pxt.json`. Los programas que la usan no se pueden descargar a una micro:bit V1.

## ~

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
    fisicabitSerial.send1(input.acceleration(Dimension.X), 100)
})
```

**Por Bluetooth (sin cable):** el primer bloque deja el micro:bit listo para que fisicabit.com lo encuentre; el segundo envía los datos sólo mientras la página está conectada.

```blocks
fisicabitBluetooth.quickStart()
basic.forever(function () {
    fisicabitBluetooth.send2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

En fisicabit.com: elegí **USB** o **Bluetooth**, poné el **número de variables** igual a la cantidad de valores del bloque (sin contar el tiempo) y dejá activada la opción **"Micro:bit envía timestamp"**.

| Pantalla LED (Bluetooth) | Significado |
|---------------------------|-------------|
| ◎ diana | Esperando que fisicabit.com se conecte |
| ♥ corazón | Conectado, enviando datos |

## Tutoriales paso a paso

Abrí estos enlaces en MakeCode. El tutorial aparece en el idioma del editor (español, inglés o portugués) y ya incluye los bloques de fisicabit:

* **USB:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-usb
* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-bluetooth (extensión complementaria)

Los tutoriales viven en `tutorial-usb.md` y `tutorial-bluetooth.md` (inglés, idioma base) con sus traducciones en `_locales/es/` y `_locales/pt-BR/`. Para probar cambios recientes abrí el enlace en una ventana de incógnito, porque MakeCode guarda los tutoriales en caché.

## Bloques disponibles

### Sensores internos

```blocks
let temp = fisicabit.readInternalSensor(FbInternalSensor.Temperature)
basic.showNumber(temp)
```

| Bloque | Descripción |
|--------|-------------|
| `leer sensor interno [temperatura]` | Lee los sensores integrados del micro:bit (temperatura, acelerómetro, luz, brújula, sonido) |

### Sensores externos

```blocks
let lectura = fisicabit.readAnalogSensor(FbAnalogPin.P0)
```

| Bloque | Descripción |
|--------|-------------|
| `leer sensor analógico en [P0]` | Lee potenciómetro, LDR, NTC (0-1023) |
| `leer sensor digital en P[8]` | Lee PIR, infrarrojo, interruptor (0/1) |
| `HC-SR04 distancia TRIG [P8] ECHO [P12] en [cm]` / `HY-SRF05 distancia ...` | Sensores ultrasónicos con muestreador nativo (eco por interrupción, ≈38–55 Hz) y cableado visible en el simulador. Categoría **Ultrasonido**, con `enviar ... distancia`, `fijar alcance`, `temperatura del aire`, `calibrar` y `frecuencia real` |
| `DS18B20 temperatura en [P0] en [°C]` | Sonda de temperatura sumergible DS18B20 (OneWire), ±0,5 °C, de −55 a 125 °C. Categoría propia **DS18B20**, con `última temperatura`, `fijar resolución 9–12 bits`, `¿conectado?` y `código de error` |
| `MAX6675 temperatura SCK [P13] CS [P16] SO [P14] en [°C]` | Termocupla tipo K con módulo MAX6675 (SPI), de 0 a 1023 °C, resolución 0,25 °C, ±2 °C: llamas, ebullición, curvas de enfriamiento. Categoría propia **MAX6675**, con `última temperatura`, `fijar corrección`, `¿conectado?`, `código de error` y `valor crudo` |
| `distancia ToF [TOF200C] SDA [P20] SCL [P19] en [cm]` | Sensores láser ToF en un solo bloque: TOF050C (VL6180X), TOF200C y GY-VL53L0XV2 (VL53L0X), TOF400C (VL53L1X) o autodetectar. Elegís el módulo y los pines; se inicializa solo. Categoría **ToF — Distancia Láser**, con `pines sugeridos`, `módulo detectado` y `¿hay sensor?` |

### Barrera óptica (experimentos de tiempo)

```blocks
let tiempoMs = fisicabit.measureGateTime(FbAnalogPin.P1, FbAnalogPin.P2, FbGateMode.Digital, 10000)
let velocidad = fisicabit.computeSpeed(tiempoMs * 1000, 100)
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

### fisicabit USB: enviar a fisicabit.com por cable

```blocks
basic.forever(function () {
    fisicabitSerial.send2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

Un solo bloque lo configura todo: `enviar a fisicabit.com tiempo y [valor] cada [100] ms`. En cada vuelta toma el tiempo del micro:bit (arranca en 0), escribe una línea CSV (`tiempo,valor`) a 115200 baudios y espera hasta que se cumplan los ms indicados. La espera se calcula sobre el instante previsto, así el período real coincide aunque `para siempre` agregue su retardo oculto de ~20 ms. Los bloques aparecen en el orden en que se usan.

| Paso | Bloque | Descripción |
|------|--------|-------------|
| 1. Enviar | `enviar a fisicabit.com tiempo y [valor] cada [100] ms` | Dentro de `para siempre`. Variantes de 2 y 3 valores (fisicabit.com admite hasta 3 variables). 100 ms = 10 muestras por segundo |
| Envío de datos sin tiempo | `enviar a fisicabit.com sin tiempo [valor]` | Manda sólo los valores medidos, sin tiempo y sin espera: al apretar un botón, en un evento o en `para siempre` con tu propia pausa (variantes de 2, 3 y 4). En fisicabit.com desactivá "Micro:bit envía timestamp": la página usa el reloj del navegador |
| 2. Opcional | `bucle rápido para fisicabit.com cada [20] ms` | En lugar de `para siempre`, para 50 / 100 Hz sin el retardo oculto; el bloque de envío va adentro |
| 2. Opcional | `reiniciar tiempo USB a 0` | Empezar una nueva medición en t = 0 (por ejemplo al apretar A) |
| 2. Opcional | `tiempo USB (ms)` | El tiempo que viaja en cada línea |
| Avanzado | `USB enviar tiempo del micro:bit [activado]`, `USB fijar decimales [2]`, `USB enviar línea [texto]`, `configurar frecuencia / intervalo` | Sólo si hace falta |

### fisicabit Cinemática: acelerómetro de precisión

```blocks
fisicabitKinematics.start()
basic.forever(function () {
    fisicabitSerial.send2(
        fisicabitKinematics.linearAcceleration(FbAccelerationAxis.Vertical),
        fisicabitKinematics.instantaneousVelocity(FbAccelerationAxis.Vertical),
        50
    )
})
```

Ejemplo MRUV por Bluetooth (placa fija a un carrito en un plano inclinado):

```blocks
fisicabitBluetooth.quickStart()
fisicabitKinematics.start()
basic.forever(function () {
    fisicabitKinematics.sendVelocity(FbAccelerationAxis.X, FbChannel.Bluetooth, 100)
})
```

Conectar, apoyar y medir: el bloque `iniciar acelerómetro de precisión` deja el sensor listo y calibra solo con la placa quieta. Después, `aceleración (m/s²)` y `velocidad instantánea (m/s)` dan valores calibrados en unidades físicas, sin más configuración.

| Paso | Bloque | Descripción |
|------|--------|-------------|
| 1. Iniciar | `iniciar acelerómetro de precisión` | En `al iniciar`, con la placa quieta 1 s |
| 2. Medir | `aceleración (m/s²) [vertical / X / Y / Z / magnitud]` | Aceleración lineal respecto al suelo, sin la gravedad; 0 en reposo |
| 2. Medir | `velocidad instantánea (m/s) [eje]` | Integrada en segundo plano muestra a muestra; vuelve a 0 sola cuando la placa se detiene |
| 2. Medir | `poner velocidad en 0`, `¿en reposo?`, `aceleración propia`, `¿caída libre?`, `pitch`, `roll` | Complementos |
| 3. Enviar | `enviar velocidad [X] por [Bluetooth] cada [100] ms` | Un solo bloque para MRUV: tiempo y velocidad a intervalos fijos; en fisicabit.com la gráfica v(t) es una recta y su pendiente es la aceleración. Variantes: `velocidad y aceleración`, `aceleración` |
| 4. Opcional | `calibrar en reposo (quieto 1 s)`, `fijar muestreo 100/200/400 Hz`, `fijar suavizado`, `fijar rango ±2/±4/±8 g`, `referencia fija`, `velocidad a 0 automática`, `gravedad local`, `gravedad medida`, `estado alta resolución` | Ajustes finos |
| Avanzado | `calibrar en 6 posiciones`, `fijar calibración`, `enviar calibración por serial`, `modo alta resolución`, `aceleración cruda`, `muestras por segundo` | Calibración de fábrica y diagnóstico |

Qué hace por dentro (investigado en la hoja de datos del LSM303AGR y en el driver CODAL del micro:bit v2):

* El firmware de MakeCode deja el chip en modo normal de 10 bits a 50 Hz. Este módulo lo pasa a **alta resolución de 12 bits** (0,98 mg por cuenta, 4 veces más fino) y a **200 muestras por segundo**, con menor ancho de banda de ruido.
* `input.acceleration` devuelve 1024 cuentas por g, no 1000. La escala se calibra con la gravedad medida en reposo, lo que corrige ese factor y la tolerancia de sensibilidad del chip.
* Cada muestra del sensor se procesa en segundo plano con su instante real; la lectura de aceleración promedia 10 muestras (50 ms) y la velocidad integra todas con regla del trapecio.
* El error de cero del chip (hasta ±80 mg, es decir 0,8 m/s²) se cancela con la referencia de reposo. La quietud se detecta por lecturas constantes con módulo igual a 1 g, sin depender de la referencia: la primera vez que la placa queda quieta se adopta la gravedad medida (nunca la primera muestra), si se cambia la inclinación en reposo la referencia se vuelve a aprender sola tras 3 s quieta, y la deriva lenta se corrige mientras está en reposo. La calibración en 6 posiciones corrige además offset y escala de cada eje.
* Cuando la placa está quieta más de 0,4 s la velocidad vuelve a 0 (ZUPT), así la deriva no se acumula entre movimientos.
* Límite físico: el micro:bit no tiene giróscopo, así que no puede separar gravedad de aceleración si la placa **gira mientras se mueve**. Mantener la orientación fija durante el movimiento (carrito en riel, caída libre, ascensor).

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

## Ejemplos de conexión

### Sensores ultrasónicos HC-SR04 y HY-SRF05

Al usar los bloques, el **simulador de MakeCode muestra el sensor con sus cables** conectados a los pines elegidos, igual que un servo o un parlante, y con "Imprimir instrucciones" se obtiene la guía de cableado paso a paso.

![Cableado HC-SR04 → micro:bit](https://raw.githubusercontent.com/martinferreiraHCA/pxt-fisicabit/main/docs/img/hc-sr04-microbit.png)

![Cableado HY-SRF05 → micro:bit](https://raw.githubusercontent.com/martinferreiraHCA/pxt-fisicabit/main/docs/img/hy-srf05-microbit.png)

```
VCC → 3V · GND → GND · TRIG → P8 · ECHO → P12      (HY-SRF05: OUT sin conectar)
Kit de expansión: cabezales 8 y 12 (G·V·S). Con 5 V en VCC: divisor 1 kΩ / 2 kΩ en ECHO.
Segundo sensor: TRIG P1 · ECHO P2. Tercero: TRIG P15 · ECHO P16.
HY-SRF05 en modo 1 cable: OUT → GND, un solo pin → P8 y el mismo pin en TRIG y ECHO del bloque.
```

**Medición.** Por defecto los bloques miden exactamente como la extensión `pxt-sonar` de Microsoft: pulso de 10 µs en TRIG, `pins.pulseIn` en ECHO y distancia = tiempo del eco × velocidad del sonido / 2 (la fórmula `eco / 2000000 × 343`, con la velocidad del sonido corregida por la temperatura del aire). Una lectura por llamada al bloque; `enviar distancia HC-SR04 ... por USB` espacia los disparos para que un eco nunca se superponga con el siguiente. El filtro es una mediana deslizante que no baja la frecuencia, con rechazo de saltos y calibración de offset contra una distancia conocida. **Fenómenos rápidos (opcional).** El bloque avanzado `muestreador ultrasónico en segundo plano [activado]` pasa a un muestreador en C++ que dispara el sensor a la frecuencia que permite el alcance (`fijar alcance máximo`: 150 cm → ≈55 Hz, 300 cm → ≈38 Hz) y marca cada eco con precisión de microsegundos sin bloquear el programa; si no recibe eco, vuelve solo al ping clásico.

**Frecuencia y marcas de tiempo.** El HC-SR04 ignora un disparo mientras corre su ciclo interno (≈25-30 ms): si se dispara más rápido, el módulo no devuelve eco, el bloque espera todo el tiempo límite y solo repite el valor anterior (medido en fisicabit.com: pidiendo 10 ms salen 36 ms reales con 80 % de muestras repetidas; pidiendo 30 ms salen 30 ms reales, todas nuevas). Por eso los bloques nunca disparan más rápido que cada 30 ms; si se los llama antes, `distancia` devuelve el valor anterior sin bloquear. Para física usá `enviar distancia HC-SR04 ...`: espacia los disparos, omite las muestras sin eco en vez de repetir valores viejos, y marca cada línea con el instante en que el sonido tocó el objeto (disparo + 0,45 ms + medio eco), no con el instante en que se escribe la línea. La distancia se puede enviar en cm, mm, pulgadas o **metros** (3 decimales).

```blocks
fisicabitUltrasonic.setRange(150)
basic.forever(function () {
    fisicabitUltrasonic.sendDistance(DigitalPin.P8, DigitalPin.P12, FbDistanceUnit.Centimeters, FbChannel.USB)
})
```

### Sensores láser ToF (TOF050C, TOF200C, GY-VL53L0XV2, TOF400C)
```
Módulo VCC → micro:bit 3V
Módulo GND → micro:bit GND
1er sensor: SDA → P20 (pin "SDA" o "20" del kit)   SCL → P19 ("SCL" o "19")   ← bus I2C por hardware
2º sensor:  SDA → P14                               SCL → P13                  ← I2C por software
3er sensor: SDA → P16                               SCL → P15
```
Pin **INT / GPIO1** del módulo (opcional, para tiempo de precisión): sensor 1 → **P8**, sensor 2 → **P12**, sensor 3 → **P1**. XSHUT queda sin conectar.

El simulador de MakeCode dibuja este cableado: al usar cualquier bloque ToF con pines SDA/SCL, el módulo láser aparece sobre la protoboard con sus cables a 3V, GND y los pines elegidos (como el HC-SR04).

Los cuatro módulos usan la misma dirección I2C (0x29): cada sensor extra necesita su propio par de pines. P13–P16 son pines digitales libres en todos los kits de expansión (no tocan la pantalla LED ni los botones) y dejan P0–P2 para sensores analógicos. El bloque `pines sugeridos ToF para el sensor número [n]` devuelve ese texto en el propio programa.
**Precisión tipo laboratorio.** Después de inicializar, un muestreador escrito en C++ lee el sensor en segundo plano (bus I2C por hardware a 400 kHz, o el bus por software con retardos en ensamblador) y guarda cada muestra con el instante en que el sensor terminó de medir. Con el pin INT conectado (`iniciar ToF de precisión ... INT [P8]`), ese instante lo captura la interrupción de hardware, con precisión de microsegundos. El bloque `enviar distancia ToF ... por [USB]` manda cada muestra con su tiempo real, a la frecuencia del sensor: ≈30 Hz en modo estable, ≈50 Hz en rápida, ≈10 Hz en precisa (`fijar modo ToF`). `calibrar ToF ... con objeto a [100] mm` corrige el offset del chip y del vidrio. `frecuencia real de muestreo ToF` verifica la tasa.

```blocks
fisicabitToF.tofStartPrecision(FbToFModel.TOF200C, DigitalPin.P20, DigitalPin.P19, DigitalPin.P8)
basic.forever(function () {
    fisicabitToF.tofSendDistance(FbToFModel.TOF200C, DigitalPin.P20, DigitalPin.P19, FbDistanceUnit.Centimeters, FbChannel.USB)
})
```

```blocks
basic.forever(function () {
    fisicabitSerial.send2(
        fisicabitToF.tofDistance(FbToFModel.TOF200C, DigitalPin.P20, DigitalPin.P19, FbDistanceUnit.Centimeters),
        fisicabitToF.tofDistance(FbToFModel.TOF400C, DigitalPin.P14, DigitalPin.P13, FbDistanceUnit.Centimeters),
        50)
})
```

### Sonda de temperatura DS18B20
```
DS18B20 rojo (VDD)      → micro:bit 3V
DS18B20 negro (GND)     → micro:bit GND
DS18B20 amarillo (DATA) → micro:bit P0
Resistencia 4,7 kΩ entre DATA y 3V (los módulos con placa ya la traen)
Varias sondas: una por pin (P0, P1, P2, ...)
```
Ejemplo de calorimetría (una lectura por segundo, 12 bits):
```blocks
basic.forever(function () {
    fisicabitSerial.send1(fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius), 1000)
})
```

### Termocupla tipo K con MAX6675
```
MAX6675 VCC → micro:bit 3V      (no usar 5 V: la salida SO va al nivel de VCC)
MAX6675 GND → micro:bit GND
MAX6675 SCK → micro:bit P13     (reloj)
MAX6675 CS  → micro:bit P16     (selección)
MAX6675 SO  → micro:bit P14     (datos; en algunos módulos dice DO o MISO)
Termocupla: rojo → "−", amarillo → "+" (si la lectura baja al calentar, invertirlos)
Varios módulos: comparten SCK y SO, cada uno con su propio CS
```
Rango 0 a 1023 °C, paso 0,25 °C, ±2 °C. El chip entrega un valor nuevo cada 220 ms; leer más seguido devuelve el mismo valor sin bloquear. Para afinar, calibrar en agua con hielo con `fijar corrección MAX6675`. Ejemplo de curva de enfriamiento (dos lecturas por segundo):
```blocks
basic.forever(function () {
    fisicabitSerial.send1(fisicabitMAX6675.temperature(DigitalPin.P13, DigitalPin.P16, DigitalPin.P14, FbTemperatureUnit.Celsius), 500)
})
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

## Bluetooth

El envío inalámbrico está en la extensión complementaria **fisicabit-bluetooth** (`github:martinferreiraHCA/pxt-fisicabit/bluetooth`). Depende de esta, así que al agregarla se instalan las dos. La opción `enviar ... vía [Bluetooth]` de los bloques de cinemática, ToF y ultrasonido manda los datos por esa extensión cuando está instalada y, si no, por USB. La separación mantiene a `fisicabit-sensores` compatible con la extensión `radio`.

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
