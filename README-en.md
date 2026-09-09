# FisicaBit Sensors — micro:bit Extension

> 🇪🇸 [Versión en español](README.md)

> MakeCode extension for physics experiments with micro:bit — sensors, optical barriers, and one-block data streaming to [fisicabit.com](https://fisicabit.com) over USB or Bluetooth.
> Project: [fisicabit.com](https://fisicabit.com)

## Use this extension

In MakeCode, go to **Extensions** and paste this repository URL:

```
https://github.com/martinferreiraHCA/pxt-fisicabit
```

Or search for **fisicabit-sensores** in the Extensions dialog.

Block texts are in **Spanish** (the project's audience). MakeCode does not translate extensions when the editor language is English, so they stay in Spanish there; with the editor in Portuguese they are translated from `_locales/pt-BR`.

## Step-by-step tutorials

Open these links in MakeCode. The tutorial shows up in the editor language (Spanish, English or Portuguese) and already includes the FisicaBit blocks:

* **USB:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-usb
* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-bluetooth

The tutorials live in `tutorial-usb.md` and `tutorial-bluetooth.md` (English, base language) with translations under `_locales/es/` and `_locales/pt-BR/`. To test recent changes open the link in an incognito window, since MakeCode caches tutorials.

## Available blocks

### Internal Sensors

```blocks
let temp = FisicaBit.leerSensorInterno(TipoSensorInterno.Temperatura)
basic.showNumber(temp)
```

| Block | Description |
|-------|-------------|
| `read internal sensor [temperature]` | Reads built-in micro:bit sensors (temperature, accelerometer, light, compass, sound) |

### External Sensors

```blocks
let reading = FisicaBit.leerSensorAnalogico(PinAnalogico.P0)
```

| Block | Description |
|-------|-------------|
| `read analog sensor on [P0]` | Reads potentiometer, LDR, NTC (0-1023) |
| `read digital sensor on P[8]` | Reads PIR, infrared, switch (0/1) |
| `ultrasonic distance TRIG P1 ECHO P2 in [cm]` | Measures distance with HC-SR04 |

### Optical Barrier (timing experiments)

```blocks
let timeMs = FisicaBit.medirTiempoBarrera(PinAnalogico.P1, PinAnalogico.P2, ModoBarrera.Digital, 10000)
let velocity = FisicaBit.calcularVelocidad(timeMs * 1000, 100)
```

| Block | Description |
|-------|-------------|
| `set barrier threshold to [512]` | Calibrate analog barrier trigger level |
| `read barrier raw pin [P1] mode [analog]` | Raw sensor value for calibration |
| `barrier triggered on [P1] mode [digital]` | Check if object is blocking the beam |
| `measure time barrier A [P1] → B [P2]` | Transit time between two barriers (~1ms resolution) |
| `[C++] barrier time A P1 → B P2` | Native C++ timing (~1μs resolution) |
| `velocity with time [μs] distance [mm]` | Calculate velocity (returns m/s x100) |
| `blocking time on [P1]` | How long an object blocks one barrier |

### FisicaBit USB — stream to fisicabit.com over the cable

```blocks
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y))
})
```

Each `send to fisicabit.com` block does everything: it takes the micro:bit time (starting at 0), writes one CSV line (`time,v1,v2,...`) at 115200 baud, and waits until the next sample is due. The wait is deadline-based, so the real period matches the configured rate even with the hidden ~20 ms delay of `forever`.

| Block | Description |
|-------|-------------|
| `send to fisicabit.com [value]` | Send 1 value (also 2, 3 and 4-value variants) |
| `set sampling rate [10 Hz]` | 1, 2, 5, 10, 20, 50 or 100 Hz (default 10 Hz) |
| `set sampling interval [100] ms` | Any interval from 5 to 60000 ms |
| `fisicabit.com sampling loop at [50 Hz]` | Runs its body at a precise rate without `forever` overhead — use for 50 / 100 Hz |
| `USB time (ms)` | Time sent in each line, starts at 0 |
| `reset USB time to 0` | Start a new run at t = 0 |
| `USB send micro:bit timestamp [on]` | *(advanced)* Turn the time column off if the page option "Micro:bit sends timestamp" is disabled |
| `USB set decimals [2]` | *(advanced)* Decimals for non-integer values |
| `USB send line [text]` | *(advanced)* Raw text line |

### Conversions

| Block | Description |
|-------|-------------|
| `convert [23] from [°C] to [°F]` | Convert temperature between units |
| `map [512] from (0—1023) to (0—100)` | Scale values to another range |

### Native C++ (Advanced)

| Block | Description |
|-------|-------------|
| `[C++] read native ADC channel [0]` | 12-bit ADC reading (0-4095) |
| `[C++] read ADC average channel [0] samples [16]` | Oversampled ADC to reduce noise |
| `[C++] measure pulse pin P[2] level [HIGH] timeout [25000] μs` | Precise pulse timing |

### FisicaBit Bluetooth — stream to fisicabit.com wirelessly

```blocks
FisicaBitBT.inicioRapido()
FisicaBitBT.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X))
})
```

| Block | Description |
|-------|-------------|
| `start Bluetooth for fisicabit.com` | Put this **first** in `on start`: UART service, max TX power, LED status icons |
| `send to fisicabit.com via Bluetooth [value]` | Send 1 value (also 2, 3 and 4-value variants); only transmits while connected |
| `set Bluetooth sampling rate [10 Hz]` | Default 10 Hz; up to 20 Hz recommended over BLE |
| `Bluetooth connected?` | True while fisicabit.com is connected |
| `on fisicabit.com Bluetooth connected / disconnected` | Event blocks |
| `Bluetooth show connection icons [on]` | Turn the ◎ / ♥ icons off to use the display yourself |
| `set Bluetooth sampling interval [ms]`, `Bluetooth sampling loop`, `Bluetooth time (ms)`, `reset Bluetooth time to 0` | Same sampling tools as USB |
| `Bluetooth send micro:bit timestamp`, `Bluetooth set decimals`, `Bluetooth send text` | *(advanced)* |
| `start Bluetooth for fisicabit.com with all BLE services` | *(advanced)* Also exposes accelerometer, temperature, magnetometer, buttons, LED and pin services — slower to connect |

Why these blocks connect reliably:

* Only the UART service is started by default. Every extra BLE service slows down discovery (especially on Windows) and can trip the firmware's 4 s supervision timeout.
* Transmit power is set to the maximum (7).
* Lines are short (time starts at 0, 2 decimals, `\n` terminator), so a sample fits in a single 20-byte BLE packet.
* Nothing is sent while no page is connected; sampling keeps its rhythm and data resumes automatically after a reconnect. Time restarts at 0 on every connection.
* If BLE falls behind, the sampler resynchronises instead of bursting stale samples.

## Wiring examples

### HC-SR04 Ultrasonic Sensor
```
HC-SR04 TRIG → micro:bit P1
HC-SR04 ECHO → micro:bit P2
HC-SR04 VCC  → micro:bit 3V
HC-SR04 GND  → micro:bit GND
```

### FC-33 Optical Barrier (digital)
```
FC-33 #1 OUT → P1 (barrier A)
FC-33 #2 OUT → P2 (barrier B)
Both VCC → 3V, GND → GND
```

### IR DIY Barrier (analog)
```
Emitter:  3V → R(100Ω) → IR LED → GND
Receiver: 3V → Phototransistor → Pin (signal)
                                 ├── R(10KΩ) → GND
```

## Bluetooth setup

1. This extension already enforces **No Pairing Required** from its `pxt.json` (`yotta.config.microbit-dal.bluetooth`: `open: 1, pairing_mode: 0, whitelist: 0`), so nothing needs to be changed in the project. To double-check: **⚙ Settings → Project Settings → No Pairing Required**.
2. Put `start Bluetooth for fisicabit.com` as the first block in `on start`.
3. Flash the program, wait for the ◎ icon, then click **Bluetooth** on fisicabit.com and pick `BBC micro:bit [xxxxx]`.
4. If a previously paired micro:bit refuses to connect, remove ("forget") it from the operating system's Bluetooth settings and try again.

Notes:

* Bluetooth and the **Radio** extension cannot be used in the same program. USB serial keeps working alongside Bluetooth.
* Practical BLE rate is up to ~20 Hz; for 50–100 Hz use USB.
* The old `BT sample ... every ... ms` and `serial sample ... every ... ms` blocks still compile but are hidden; use the new `send to fisicabit.com` blocks.

### Browser compatibility

| Platform | Browser | USB (Web Serial) | Bluetooth (Web Bluetooth) |
|----------|---------|------------------|---------------------------|
| Windows / macOS / Linux / ChromeOS | Chrome, Edge | Yes | Yes |
| Android | Chrome | No | Yes |
| iOS / iPadOS | Safari | No | No (Apple does not support Web Serial or Web Bluetooth) |

Data is received on [fisicabit.com](https://fisicabit.com) in real time.

## micro:bit pin reference

```
Analog pins (ADC):     P0, P1, P2
Free digital pins:     P8, P12, P16
I2C bus:               P19 (SCL), P20 (SDA)
SPI bus:               P13 (SCK), P14 (MISO), P15 (MOSI)
Shared with LEDs:      P3, P4, P5, P6, P7, P9, P10, P11
```

## Supported targets

* for PXT/microbit

## License

MIT

<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
