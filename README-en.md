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
| `DS18B20 temperature on [P0] in [°C]` | DS18B20 waterproof temperature probe (OneWire), ±0.5 °C, −55 to 125 °C. Own **DS18B20** category with `last temperature`, `set resolution 9–12 bits`, `connected?` and `error code` |
| `ToF distance [TOF200C] SDA [P20] SCL [P19] in [cm]` | ToF laser sensors in one block: TOF050C (VL6180X), TOF200C and GY-VL53L0XV2 (VL53L0X), TOF400C (VL53L1X) or auto-detect. Pick the module and the pins; it initialises itself. **ToF — Laser Distance** category, with `suggested pins`, `module detected` and `sensor found?` |

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

### FisicaBit Kinematics: precision accelerometer

```blocks
FisicaBitCinematica.iniciar()
basic.forever(function () {
    FisicaBitSerial.enviar2(
        FisicaBitCinematica.leerAceleracionLineal(EjeAceleracion.Vertical),
        FisicaBitCinematica.velocidadInstantanea(EjeAceleracion.Vertical),
        50
    )
})
```

Uniformly accelerated motion over Bluetooth (board fixed to a cart on an incline):

```blocks
FisicaBitBT.inicioRapido()
FisicaBitCinematica.iniciar()
basic.forever(function () {
    FisicaBitCinematica.enviarVelocidad(EjeAceleracion.X, MedioEnvio.Bluetooth, 100)
})
```

Connect, rest, measure: `start precision accelerometer` configures the sensor and self-calibrates while the board is still. Then `acceleration (m/s²)` and `instantaneous velocity (m/s)` return calibrated physical units with no further setup.

| Step | Block | Description |
|------|-------|-------------|
| 1. Start | `start precision accelerometer` | In `on start`, board still for 1 s |
| 2. Measure | `acceleration (m/s²) [vertical / X / Y / Z / magnitude]` | Linear acceleration relative to the ground, gravity removed; 0 at rest |
| 2. Measure | `instantaneous velocity (m/s) [axis]` | Integrated in the background sample by sample; auto-zeroes when the board stops |
| 2. Measure | `reset velocity to 0`, `at rest?`, `proper acceleration`, `free fall?`, `pitch`, `roll` | Extras |
| 3. Send | `send velocity [X] via [Bluetooth] every [100] ms` | One block for uniformly accelerated motion: time and velocity at fixed intervals; on fisicabit.com the v(t) graph is a line whose slope is the acceleration. Variants: `velocity and acceleration`, `acceleration` |
| 4. Optional | `calibrate at rest (1 s)`, `set sampling 100/200/400 Hz`, `set smoothing`, `set range ±2/±4/±8 g`, `keep reference fixed`, `auto-zero velocity`, `local gravity`, `measured gravity`, `high-resolution status` | Fine tuning |
| Advanced | `calibrate 6 positions`, `set calibration`, `send calibration via serial`, `high-resolution mode`, `raw acceleration`, `samples per second` | Factory calibration and diagnostics |

What it does inside (from the LSM303AGR datasheet and the micro:bit v2 CODAL driver):

* MakeCode's firmware leaves the chip in normal 10-bit mode at 50 Hz. This module switches it to **12-bit high-resolution mode** (0.98 mg per count, 4x finer) at **200 samples per second**, with a narrower noise bandwidth.
* `input.acceleration` returns 1024 counts per g, not 1000. The scale is calibrated from gravity measured at rest, which corrects that factor and the chip's sensitivity tolerance.
* Every sensor sample is processed in the background with its real timestamp; the acceleration reading averages 10 samples (50 ms) and velocity integrates all of them with the trapezoidal rule.
* The chip's zero-g offset (up to ±80 mg, i.e. 0.8 m/s²) is cancelled by the rest reference. Stillness is detected from constant readings with magnitude equal to 1 g, independently of the reference: the first time the board is still the measured gravity is adopted (never the first sample), a tilt change at rest is re-learned after 3 s still, and slow drift is corrected while at rest. The 6-position calibration also corrects per-axis offset and scale.
* When the board is still for more than 0.4 s the velocity returns to 0 (ZUPT), so drift does not accumulate between movements.
* Physical limit: the micro:bit has no gyroscope, so it cannot separate gravity from acceleration if the board **rotates while moving**. Keep the orientation fixed during motion (cart on a track, free fall, elevator).

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

### ToF laser sensors (TOF050C, TOF200C, GY-VL53L0XV2, TOF400C)
```
Module VCC → micro:bit 3V
Module GND → micro:bit GND
1st sensor: SDA → P20 (kit pin "SDA" or "20")   SCL → P19 ("SCL" or "19")   ← hardware I2C bus
2nd sensor: SDA → P14                            SCL → P13                   ← software I2C
3rd sensor: SDA → P16                            SCL → P15
```
Module **INT / GPIO1** pin (optional, for precision timing): sensor 1 → **P8**, sensor 2 → **P12**, sensor 3 → **P1**. Leave XSHUT unconnected.

All four modules share I2C address 0x29, so every extra sensor needs its own pin pair. P13–P16 are free digital pins on every expansion kit (no LED matrix or button conflicts) and leave P0–P2 for analog sensors. The `suggested ToF pins for sensor number [n]` block returns that text from the program itself.
**Lab-grade precision.** After initialisation a C++ sampler reads the sensor in the background (hardware I2C bus at 400 kHz, or the software bus with assembler-timed delays) and stores every sample with the instant the sensor finished measuring. With the INT pin wired (`start precision ToF ... INT [P8]`) that instant is captured by the hardware interrupt, with microsecond precision. The `send ToF distance ... via [USB]` block streams every sample with its real time at the sensor's rate: ≈30 Hz stable, ≈50 Hz fast, ≈10 Hz precise (`set ToF mode`). `calibrate ToF ... with target at [100] mm` removes the chip and cover-glass offset. `ToF actual sampling rate` verifies the rate.

```blocks
FisicaBitToF.tofIniciarPrecision(ModeloToF.TOF200C, DigitalPin.P20, DigitalPin.P19, DigitalPin.P8)
basic.forever(function () {
    FisicaBitToF.tofEnviarDistancia(ModeloToF.TOF200C, DigitalPin.P20, DigitalPin.P19, UnidadDistancia.Centimetros, MedioEnvio.USB)
})
```

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(
        FisicaBitToF.tofDistancia(ModeloToF.TOF200C, DigitalPin.P20, DigitalPin.P19, UnidadDistancia.Centimetros),
        FisicaBitToF.tofDistancia(ModeloToF.TOF400C, DigitalPin.P14, DigitalPin.P13, UnidadDistancia.Centimetros),
        50)
})
```

### DS18B20 temperature probe
```
DS18B20 red (VDD)     → micro:bit 3V
DS18B20 black (GND)   → micro:bit GND
DS18B20 yellow (DATA) → micro:bit P0
4.7 kΩ resistor between DATA and 3V (breakout modules already include it)
Several probes: one per pin (P0, P1, P2, ...)
```
Calorimetry example (one reading per second, 12 bits):
```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(FisicaBitDS18B20.temperatura(DigitalPin.P0, UnidadTemperatura.Celsius), 1000)
})
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

1. This extension proposes **No Pairing Required** as the default from its `pxt.json` (`yotta.config.microbit-dal.bluetooth`: `open: 1, whitelist: 0`), so a new project needs no changes. If the project has another option selected under **⚙ Settings → Project Settings**, that option wins: keep it on **No Pairing Required**.
2. Put `start Bluetooth for fisicabit.com` as the first block in `on start`.
3. Flash the program, wait for the ◎ icon, then click **Bluetooth** on fisicabit.com and pick `BBC micro:bit [xxxxx]`.
4. If a previously paired micro:bit refuses to connect, remove ("forget") it from the operating system's Bluetooth settings and try again.

Notes:

* Bluetooth and the **Radio** extension cannot be used in the same program. USB serial keeps working alongside Bluetooth.
* Practical BLE rate is up to ~20 Hz; for 50–100 Hz use USB.
* The old `BT sample ... every ... ms` and `serial sample ... every ... ms` blocks still compile but are hidden; use the new `send to fisicabit.com time and ... every ... ms` blocks.

### Connected but no data arrives (phone / Android)

Symptom: fisicabit.com shows the micro:bit as connected, but the table and graph stay empty. The cause is almost always the project settings or a stale bond stored by the phone, not the page. Try, in this order:

1. **Stale bond on the phone.** On Android: Settings → Bluetooth → `BBC micro:bit [xxxxx]` → **Forget**. Then reset the micro:bit (back button) and reconnect from fisicabit.com. A bond saved with keys from an earlier program makes the phone connect but never enable notifications on the data channel.
2. **Project settings.** In MakeCode, **⚙ → Project Settings** must be **No Pairing Required**. If the project is set to *JustWorks pairing* or *Passkey pairing*, that choice wins over the extension's default: the `.hex` requires bonding and the phone connects but cannot read data until it is paired from Settings → Bluetooth. (With extension 0.7.0 and 0.7.1 this combination also produced the **"Extension errors"** dialog and an empty category; from 0.7.2 on it does not.) Select *No Pairing Required*, **download the .hex again** and re-flash.
3. **Extension version.** In the editor's **Extensions** view, make sure `fisicabit-sensores` is 0.7.2 or later. If not, remove it, add it again from `https://github.com/martinferreiraHCA/pxt-fisicabit`, and download the `.hex` again: **firmware already on the board does not update itself**.
4. **Blocks.** `start Bluetooth for fisicabit.com` goes **inside `on start`**, and the `send to fisicabit.com via Bluetooth ...` block **inside `forever`**. Without the start block the UART service does not exist and the page connects with no data channel.
5. **fisicabit.com.** Choose **Bluetooth**, set the **number of variables** equal to the number of values in the block (not counting time) and keep **"Micro:bit sends timestamp"** enabled (or disabled when you use the *without time* blocks). If they do not match, lines arrive but are discarded.
6. **Browser.** On Android only **Chrome** (or Chromium-based Edge/Samsung Internet) has Web Bluetooth; Firefox does not, and no browser on iPhone/iPad does. Keep the screen on with the tab visible: if Android backgrounds it, reception stops.
7. **Interval.** Over BLE use 50 ms or more in the send block. If a block in the same program uses 5–10 ms the indications saturate and data arrives in bursts or not at all.

When everything is right the micro:bit shows ♥ and a new line appears on fisicabit.com every interval.

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
