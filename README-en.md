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
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

One block configures everything: `send to fisicabit.com time and [value] every [100] ms`. On each pass it takes the micro:bit time (starting at 0), writes one CSV line (`time,value`) at 115200 baud and waits until the given interval has elapsed. The wait is deadline-based, so the real period matches even with the hidden ~20 ms delay of `forever`. Blocks are listed in the order they are used.

| Step | Block | Description |
|------|-------|-------------|
| 1. Send | `send to fisicabit.com time and [value] every [100] ms` | Inside `forever`. 2, 3 and 4-value variants. 100 ms = 10 samples per second |
| Send without time | `send to fisicabit.com without time [value]` | Sends only the measured values, no time and no wait: on a button press, in an event or inside `forever` with your own pause (2, 3 and 4-value variants). On fisicabit.com disable "Micro:bit sends timestamp": the page uses the browser clock |
| 2. Optional | `fisicabit.com fast loop every [20] ms` | Instead of `forever`, for 50 / 100 Hz without the hidden delay; put the send block inside |
| 2. Optional | `reset USB time to 0` | Start a new run at t = 0 (for example on button A) |
| 2. Optional | `USB time (ms)` | The time sent in each line |
| Advanced | `USB send micro:bit timestamp [on]`, `USB set decimals [2]`, `USB send line [text]`, `set sampling rate / interval` | Only if needed |

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
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X), 100)
})
```

| Step | Block | Description |
|------|-------|-------------|
| 1. Start | `start Bluetooth for fisicabit.com` | **First** in `on start`: UART service, max TX power, ◎ / ♥ icons on the display |
| 2. Send | `send to fisicabit.com via Bluetooth time and [value] every [100] ms` | Inside `forever`. 2, 3 and 4-value variants; only transmits while connected. Over BLE use 50 ms or more |
| Send without time | `send to fisicabit.com via Bluetooth without time [value]` | Sends only the measured values, no time and no wait (2, 3 and 4-value variants). On fisicabit.com disable "Micro:bit sends timestamp" |
| 3. Optional | `Bluetooth connected?`, `on connected / on disconnected`, `reset Bluetooth time to 0`, `Bluetooth time (ms)`, `Bluetooth fast loop every [50] ms`, `show connection icons` | Connection state and time control |
| Advanced | `send micro:bit timestamp`, `set decimals`, `send text`, `start with all BLE services`, `set sampling rate / interval` | Only if needed |

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
* The old `BT sample ... every ... ms` and `serial sample ... every ... ms` blocks still compile but are hidden; use the new `send to fisicabit.com time and ... every ... ms` blocks.

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
