# FisicaBit Sensors — micro:bit Extension

> MakeCode extension for physics experiments with micro:bit — sensors, optical barriers, and Bluetooth data logging.
> Project: [fisicabit.com](https://fisicabit.com)

## Use this extension

In MakeCode, go to **Extensions** and paste this repository URL:

```
https://github.com/martinferreiraHCA/pxt-fisicabit
```

Or search for **fisicabit-sensores** in the Extensions dialog.

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

### Serial Sampling (USB)

```blocks
basic.forever(function () {
    FisicaBit.serialMuestrear2(FisicaBit.tiempoSerial(), input.acceleration(Dimension.X), 100)
})
```

| Block | Description |
|-------|-------------|
| `serial time (ms)` | Timestamp starting from 0 |
| `serial sample [value] every [100] ms` | Send 1 value via USB serial |
| `serial sample [v1] and [v2] every [100] ms` | Send 2 values (CSV) |
| `serial sample [v1], [v2] and [v3] every [100] ms` | Send 3 values (CSV) |

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

### Bluetooth (BLE UART)

```blocks
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()
basic.forever(function () {
    FisicaBitBT.muestrear2(FisicaBitBT.tiempo(), input.temperature(), 1000)
})
```

| Block | Description |
|-------|-------------|
| `start Bluetooth UART` | Initialize BLE UART service |
| `setup BT connection indicator` | Show icon on connect/disconnect |
| `BT sample [value] every [ms] ms` | Send 1 value via Bluetooth |
| `BT sample [v1] and [v2] every [ms] ms` | Send 2 values via Bluetooth |
| `BT sample [v1], [v2] and [v3] every [ms] ms` | Send 3 values via Bluetooth |
| `BT send text [text]` | Send free text via Bluetooth |

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

1. In MakeCode: **Settings → Project Settings → enable "No Pairing Required"**
2. In `pxt.json`, ensure: `"bluetooth": { "open": 1, "pairing_mode": 0, "whitelist": 0 }`
3. Note: Bluetooth disables USB serial and Radio extension

### Browser compatibility

| Platform | Browser | Works |
|----------|---------|-------|
| Windows / macOS / Linux | Chrome, Edge | Yes |
| Android | Chrome | Yes |
| iOS / iPadOS | Safari | No (Apple does not support Web Bluetooth) |

Data is received on [fisicasimple.com](https://fisicasimple.com) in real time using the Web Bluetooth API.

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
