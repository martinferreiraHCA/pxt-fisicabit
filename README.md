# FisicaBit sensors — micro:bit (V2) extension

> 🇪🇸 Versión en español: [README-es.md](https://github.com/martinferreiraHCA/pxt-fisicabit/blob/main/README-es.md)

MakeCode extension for physics experiments with the micro:bit: sensors, photogates, a precision accelerometer, and one-block data streaming to [fisicabit.com](https://fisicabit.com) over USB. Bluetooth streaming is provided by the companion extension [fisicabit-bluetooth](https://github.com/martinferreiraHCA/pxt-fisicabit-bluetooth), kept separate so that this extension stays compatible with the `radio` extension.

## ~ hint

#### micro:bit (V2) only

This extension only works with the micro:bit V2. It uses the V2 CODAL runtime, the built-in microphone and native C++ samplers, and the V1 build is disabled in `pxt.json`. Programs that use it cannot be downloaded to a micro:bit V1.

## ~

## Use this extension

In MakeCode, open **Extensions** and paste this repository URL:

```
https://github.com/martinferreiraHCA/pxt-fisicabit
```

Or search for **fisicabit-sensores** in the Extensions dialog.

## Step-by-step tutorials

Open these links in MakeCode. The tutorial is shown in the editor language (English, Spanish or Portuguese) and already includes the FisicaBit blocks:

* **USB:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-usb
* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit-bluetooth/tutorial-bluetooth (companion extension)

The USB tutorial lives in `tutorial-usb.md` (English, base language; the Bluetooth one in the fisicabit-bluetooth repository) with translations under `_locales/es/` and `_locales/pt-BR/`. To test recent changes open the link in an incognito window, since MakeCode caches tutorials.

## Toolbox categories

| Category | Purpose |
|----------|---------|
| **FisicaBit USB** | Send time and values to fisicabit.com over the USB cable (Web Serial, 115200 baud) |
| **FisicaBit Bluetooth** | The same over Bluetooth LE, in the separate extension [fisicabit-bluetooth](https://github.com/martinferreiraHCA/pxt-fisicabit-bluetooth) |
| **FisicaBit kinematics** | Precision accelerometer: linear acceleration, velocity, rest detection |
| **Ultrasonic** | HC-SR04 / HY-SRF05 distance with a background sampler; wiring shown in the simulator |
| **ToF laser** | VL53L0X / VL53L1X / VL6180X laser distance modules (I2C); wiring shown in the simulator |
| **BME280**, **DHT11**, **DS18B20**, **MAX6675** | Pressure / humidity / temperature sensors |
| **HX711** | Load cell amplifier: mass and force |
| **TCS230** | Colorimeter / spectrophotometry with the TCS230 / TCS3200 |
| **FisicaBit sound** | Sound level, frequency detection, musical notes, Doppler effect |
| **FisicaBit sensors** (Advanced) | Internal sensors, analog/digital pins, NTC, photogates, conversions, native C++ helpers |

## Available blocks

### Internal sensors

```blocks
let temp = fisicabit.readInternalSensor(FbInternalSensor.Temperature)
basic.showNumber(temp)
```

| Block | Description |
|-------|-------------|
| `read internal sensor [temperature]` | Reads built-in micro:bit sensors (temperature, accelerometer, light, compass, sound) |

### External sensors

```blocks
let reading = fisicabit.readAnalogSensor(FbAnalogPin.P0)
```

| Block | Description |
|-------|-------------|
| `read analog sensor on [P0]` | Reads potentiometer, LDR, NTC (0-1023) |
| `read digital sensor on P[8]` | Reads PIR, infrared, switch (0/1) |
| `HC-SR04 distance TRIG [P8] ECHO [P12] in [cm]` / `HY-SRF05 distance ...` | Ultrasonic sensors with a native sampler (interrupt-timed echo, ≈38–55 Hz) and wiring shown in the simulator. **Ultrasonic** category, with `send ... distance`, `set max range`, `air temperature`, `calibrate`, `status` and `actual sampling rate` |
| `DS18B20 temperature on [P0] in [°C]` | DS18B20 waterproof temperature probe (OneWire), ±0.5 °C, −55 to 125 °C. **DS18B20** category with `last temperature`, `set resolution 9–12 bits`, `connected?` and `error code` |
| `MAX6675 temperature SCK [P13] CS [P16] SO [P14] in [°C]` | Type K thermocouple with a MAX6675 module (SPI), 0 to 1023 °C, 0.25 °C resolution, ±2 °C. **MAX6675** category with `last temperature`, `set correction`, `connected?`, `error code` and `raw value` |
| `ToF distance [TOF200C] SDA [P20] SCL [P19] in [cm]` | ToF laser sensors in one block: TOF050C (VL6180X), TOF200C and GY-VL53L0XV2 (VL53L0X), TOF400C (VL53L1X) or auto-detect. Pick the module and the pins; it initialises itself. **ToF laser** category, with `suggested pins`, `module detected` and `sensor found?` |

### Photogates (timing experiments)

```blocks
let timeMs = fisicabit.measureGateTime(FbAnalogPin.P1, FbAnalogPin.P2, FbGateMode.Digital, 10000)
let speed = fisicabit.computeSpeed(timeMs * 1000, 100)
```

| Block | Description |
|-------|-------------|
| `set photogate threshold to [512]` | Calibrate the analog trigger level |
| `read photogate raw pin [P1] mode [analog]` | Raw sensor value for calibration |
| `photogate triggered on [P1] mode [digital]` | Check whether an object is blocking the beam |
| `measure time photogate A [P1] → B [P2]` | Transit time between two photogates (~1 ms resolution) |
| `[C++] photogate time A P1 → B P2` | Native C++ timing (~1 µs resolution) |
| `speed with time [µs] distance [mm]` | Speed from time and distance (returns m/s × 100) |
| `blocking time on [P1]` | How long an object blocks one photogate |

### FisicaBit USB — stream to fisicabit.com over the cable

```blocks
basic.forever(function () {
    fisicabitSerial.send2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

One block configures everything: `send to fisicabit.com time and [value] every [100] ms`. On each pass it takes the micro:bit time (starting at 0), writes one CSV line (`time,value`) at 115200 baud and waits until the given interval has elapsed. The wait is deadline-based, so the real period matches even with the hidden ~20 ms delay of `forever`.

| Step | Block | Description |
|------|-------|-------------|
| 1. Send | `send to fisicabit.com time and [value] every [100] ms` | Inside `forever`. 2, 3 and 4-value variants. 100 ms = 10 samples per second |
| Send without time | `send to fisicabit.com without time [value]` | Sends only the measured values, no time and no wait: on a button press, in an event or inside `forever` with your own pause. On fisicabit.com disable "micro:bit sends timestamp": the page uses the browser clock |
| 2. Optional | `fisicabit.com fast loop every [20] ms` | Instead of `forever`, for 50 / 100 Hz without the hidden delay; put the send block inside |
| 2. Optional | `reset USB time to 0` | Start a new run at t = 0 (for example on button A) |
| 2. Optional | `USB time (ms)` | The time sent in each line |
| Advanced | `USB send micro:bit timestamp [on]`, `USB set decimals [2]`, `USB send line [text]`, `set sampling rate / interval` | Only if needed |

### FisicaBit kinematics: precision accelerometer

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

Uniformly accelerated motion over Bluetooth (board fixed to a cart on an incline; needs the fisicabit-bluetooth extension):

```blocks
fisicabitBluetooth.quickStart()
fisicabitKinematics.start()
basic.forever(function () {
    fisicabitKinematics.sendVelocity(FbAccelerationAxis.X, FbChannel.Bluetooth, 100)
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

What it does inside (from the LSM303AGR datasheet and the micro:bit V2 CODAL driver):

* MakeCode's firmware leaves the chip in normal 10-bit mode at 50 Hz. This module switches it to **12-bit high-resolution mode** (0.98 mg per count, 4x finer) at **200 samples per second**, with a narrower noise bandwidth, through the CODAL accelerometer API.
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
| `[C++] read native ADC channel [0]` | 12-bit ADC reading (0-4095) through CODAL |
| `[C++] read ADC average channel [0] samples [16]` | Oversampled ADC to reduce noise |
| `[C++] measure pulse pin P[2] level [HIGH] timeout [25000] µs` | Precise pulse timing |

## Wiring examples

### HC-SR04 and HY-SRF05 ultrasonic sensors

When these blocks are used, the **MakeCode simulator shows the sensor with its wires** on the chosen pins, like a servo or a speaker, and "Print instructions" gives the step-by-step wiring guide.

![HC-SR04 → micro:bit wiring](https://raw.githubusercontent.com/martinferreiraHCA/pxt-fisicabit/main/docs/img/hc-sr04-microbit.png)

![HY-SRF05 → micro:bit wiring](https://raw.githubusercontent.com/martinferreiraHCA/pxt-fisicabit/main/docs/img/hy-srf05-microbit.png)

```
VCC → 3V · GND → GND · TRIG → P8 · ECHO → P12      (HY-SRF05: OUT unconnected)
Expansion kit: headers 8 and 12 (G·V·S). With 5 V on VCC: 1 kΩ / 2 kΩ divider on ECHO.
Second sensor: TRIG P1 · ECHO P2. Third: TRIG P15 · ECHO P16.
HY-SRF05 single-wire mode: OUT → GND, one pin → P8 and the same pin in TRIG and ECHO of the block.
```

**Acquisition optimised for fast phenomena.** A C++ sampler triggers the sensor at a fixed period in its own fiber and measures the echo with CODAL's interrupt-timed pulse capture (the same path as `pins.pulseIn`), without blocking the program. Every sample carries the real instant the sound hit the object. The period adapts to the range (`set ultrasonic max range`): 150 cm → ≈55 Hz, 300 cm → ≈38 Hz. The speed of sound is corrected with the air temperature, the filter is a sliding median that does not lower the rate, there is step rejection and offset calibration against a known distance. `send HC-SR04 distance ... via USB` streams one line per echo with its real time.

```blocks
fisicabitUltrasonic.setRange(150)
basic.forever(function () {
    fisicabitUltrasonic.sendDistance(DigitalPin.P8, DigitalPin.P12, FbDistanceUnit.Centimeters, FbChannel.USB)
})
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

The MakeCode simulator draws this wiring: whenever a ToF block with SDA/SCL pins is used, the laser module appears on the breadboard with its wires to 3V, GND and the chosen pins (as with the HC-SR04).

All four modules share I2C address 0x29, so every extra sensor needs its own pin pair. P13–P16 are free digital pins on every expansion kit (no LED matrix or button conflicts) and leave P0–P2 for analog sensors. The `suggested ToF pins for sensor number [n]` block returns that text from the program itself.

**Lab-grade precision.** After initialisation a C++ sampler reads the sensor in the background (hardware I2C bus at 400 kHz, or the software bus with cycle-counted delays) and stores every sample with the instant the sensor finished measuring. With the INT pin wired (`start precision ToF ... INT [P8]`) that instant is captured by the pin interrupt, with microsecond precision. The `send ToF distance ... via [USB]` block streams every sample with its real time at the sensor's rate: ≈30 Hz stable, ≈50 Hz fast, ≈10 Hz precise (`set ToF mode`). `calibrate ToF ... with target at [100] mm` removes the chip and cover-glass offset. `ToF actual sampling rate` verifies the rate.

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
    fisicabitSerial.send1(fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius), 1000)
})
```

### Type K thermocouple with MAX6675
```
MAX6675 VCC → micro:bit 3V      (do not use 5 V: the SO output swings to VCC)
MAX6675 GND → micro:bit GND
MAX6675 SCK → micro:bit P13     (clock)
MAX6675 CS  → micro:bit P16     (chip select)
MAX6675 SO  → micro:bit P14     (data; some modules label it DO or MISO)
Thermocouple: red → "−", yellow → "+" (if the reading drops when heated, swap them)
Several modules: share SCK and SO, each with its own CS
```
Range 0 to 1023 °C, 0.25 °C steps, ±2 °C. The chip delivers a new value every 220 ms; reading more often returns the same value without blocking. For better accuracy, calibrate in ice water with `set MAX6675 correction`. Cooling-curve example (two readings per second):
```blocks
basic.forever(function () {
    fisicabitSerial.send1(fisicabitMAX6675.temperature(DigitalPin.P13, DigitalPin.P16, DigitalPin.P14, FbTemperatureUnit.Celsius), 500)
})
```

### FC-33 photogate (digital)
```
FC-33 #1 OUT → P1 (photogate A)
FC-33 #2 OUT → P2 (photogate B)
Both VCC → 3V, GND → GND
```

### IR DIY photogate (analog)
```
Emitter:  3V → R(100Ω) → IR LED → GND
Receiver: 3V → Phototransistor → Pin (signal)
                                 ├── R(10KΩ) → GND
```

## Bluetooth

Wireless streaming lives in the companion extension **fisicabit-bluetooth** (`github:martinferreiraHCA/pxt-fisicabit-bluetooth`). It depends on this one, so adding it brings both. The `send ... via [Bluetooth]` choice in the kinematics, ToF and ultrasonic blocks routes the data through that extension when it is installed and falls back to USB when it is not. The split keeps `fisicabit-sensores` usable together with the `radio` extension.

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

## Testing

`test.ts` is the extension's test program. Open this repository as a project in MakeCode (**Import → Import URL**) and the simulator runs it: button A selects a test case (number on the display), button B runs it, A+B prints a summary. Each case writes `TEST n name: PASS | FAIL | SKIP (reason)` to the serial console. Pure-logic cases (conversions, formatting, note names, suggested pins) must pass in the simulator; hardware cases report SKIP when the sensor is not connected and must never raise an exception. The header of `test.ts` lists every case, the expected value and the wiring it needs on a micro:bit V2. `tests/native-check.ts` is an extra program that exercises every native C++ shim; compiling it with the extension verifies that the shims link.

## Development notes

* Native code is C++ on CODAL only (micro:bit V2); there is no mbed code path. The few direct register accesses are commented in `shims.cpp`.
* Block ids (`fisicabit_*`) are stable across versions so saved projects keep their blocks.
* Translations of block texts live in `_locales/es/` and `_locales/pt-BR/` (block strings and tooltips).
* Based on public documentation: ST datasheets and application notes for the VL53L0X / VL53L1X / VL6180X, Bosch BME280, Maxim DS18B20 / MAX6675, Avia HX711, TAOS TCS3200, and the CODAL / pxt-microbit sources. The ultrasonic acquisition follows the approach of Microsoft's `pxt-sonar` (MIT).

## Supported targets

* for PXT/microbit (micro:bit V2 only)

## License

MIT

<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
