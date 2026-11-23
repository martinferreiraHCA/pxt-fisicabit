# FisicaBit for fisicabit.com — micro:bit (V2) extension

> Generated from [pxt-fisicabit](https://github.com/martinferreiraHCA/pxt-fisicabit) with `tools/mirror-site.py`. Do not edit by hand: change pxt-fisicabit and regenerate.

Package loaded by the MakeCode editor embedded in [fisicabit.com](https://fisicabit.com). It contains only what the site needs:

| Category | Blocks |
|----------|--------|
| **FisicaBit USB** | `send to fisicabit.com time and [value] every [ms]` (1 to 4 values), `send without time`, `fast loop`, `reset USB time`, `USB time`, decimals and sampling rate |
| **Ultrasonic** | HC-SR04 / HY-SRF05 `distance` (cm, mm, inches, metres), `send distance ... via USB` with physical time stamps, range, air temperature, filter, calibration, status, wiring drawn in the simulator |
| **DS18B20** | Waterproof temperature probe (OneWire): `DS18B20 temperature on [P0] in [°C]`, `last temperature`, `set resolution 9–12 bits`, `connected?`, `reading valid?`, `error code`, wiring drawn in the simulator. Driver ported from the MakeCode-approved [`microbit-dstemp`](https://github.com/bsiever/microbit-dstemp) by Bill Siever (MIT) |
| **FisicaBit Bluetooth** (branch `bluetooth` only, package `fisicabit-bt`) | `start Bluetooth for fisicabit.com`, `send to fisicabit.com via Bluetooth ...`, connection state and time |

The legacy names of the previous packages (`FisicaBitSerial.enviar1`, `FisicaBitSerial.leerSensorInterno`, `FisicaBitBT.inicioRapido`, ...) keep working through `compat.ts`, so projects saved on the site compile unchanged. Block ids are the same as in pxt-fisicabit.

## DS18B20 wiring

```
DS18B20 red (VDD)     → micro:bit 3V
DS18B20 black (GND)   → micro:bit GND
DS18B20 yellow (DATA) → micro:bit P0
4.7 kΩ resistor between DATA and 3V (breakout modules already include it;
  short leads also work with the internal pull-up the block switches on)
```

```blocks
basic.forever(function () {
    fisicabitSerial.send1(fisicabitDS18B20.temperature(DigitalPin.P0, FbTemperatureUnit.Celsius), 1000)
})
```

## ~ hint

#### micro:bit (V2) only

The V1 build is disabled; programs built with this package run on the micro:bit V2.

## ~

## Supported targets

* for PXT/microbit (micro:bit V2 only)

## License

MIT
