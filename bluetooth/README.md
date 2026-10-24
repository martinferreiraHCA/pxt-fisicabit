# FisicaBit Bluetooth — micro:bit (V2) extension

> 🇪🇸 Versión en español: [README-es.md](https://github.com/martinferreiraHCA/pxt-fisicabit/blob/main/bluetooth/README-es.md)

Companion of [fisicabit-sensores](https://github.com/martinferreiraHCA/pxt-fisicabit): streams time and sensor values to [fisicabit.com](https://fisicabit.com) over Bluetooth Low Energy (Nordic UART service). It is a separate extension because MakeCode cannot combine `bluetooth` with the `radio` extension that every new micro:bit project includes; keeping it apart leaves `fisicabit-sensores` usable in any project.

## ~ hint

#### micro:bit (V2) only

This extension only works with the micro:bit V2 (it depends on fisicabit-sensores, which uses the V2 runtime and native code; the V1 build is disabled).

## ~

## Use this extension

In MakeCode, open **Extensions** and paste:

```
github:martinferreiraHCA/pxt-fisicabit/bluetooth
```

It brings `fisicabit-sensores` with it. MakeCode will say that `radio` and `bluetooth` cannot be used together: click **Remove radio**. In **⚙ Settings → Project Settings** select **No Pairing Required**.

## Step-by-step tutorial

* **Bluetooth:** https://makecode.microbit.org/#tutorial:https://github.com/martinferreiraHCA/pxt-fisicabit/tutorial-bluetooth

## Blocks

### FisicaBit Bluetooth — stream to fisicabit.com wirelessly

```blocks
fisicabitBluetooth.quickStart()
basic.forever(function () {
    fisicabitBluetooth.send1(input.acceleration(Dimension.X), 100)
})
```

| Step | Block | Description |
|------|-------|-------------|
| 1. Start | `start Bluetooth for fisicabit.com` | **First** in `on start`: UART service, max TX power, ◎ / ♥ icons on the display |
| 2. Send | `send to fisicabit.com via Bluetooth time and [value] every [100] ms` | Inside `forever`. 2, 3 and 4-value variants. Over BLE use 50 ms or more |
| Send without time | `send to fisicabit.com via Bluetooth without time [value]` | Sends only the measured values, no time and no wait. On fisicabit.com disable "micro:bit sends timestamp" |
| 3. Optional | `Bluetooth connected?`, `on connected / on disconnected`, `reset Bluetooth time to 0`, `Bluetooth time (ms)`, `Bluetooth fast loop every [50] ms`, `show connection icons` | Connection state and time control |
| Advanced | `send micro:bit timestamp`, `set decimals`, `send text`, `start with all BLE services`, `set sampling rate / interval` | Only if needed |

Why these blocks connect reliably:

* Only the UART service is started by default. Every extra BLE service slows down discovery (especially on Windows) and can trip the firmware's 4 s supervision timeout.
* Transmit power is set to the maximum (7).
* Lines are short (time starts at 0, 2 decimals, `\n` terminator), so a sample fits in a single 20-byte BLE packet.
* Sampling keeps its rhythm while no page is connected and data resumes automatically after a reconnect. Time restarts at 0 on every connection.
* If BLE falls behind, the sampler resynchronises instead of bursting stale samples.

## How it works with fisicabit-sensores

When the program starts, this extension registers its transport with `fisicabitData.registerBluetooth`. From then on the `send ... via [Bluetooth]` option of the kinematics, ToF and ultrasonic blocks in fisicabit-sensores sends through Bluetooth; without this extension those blocks fall back to USB.

## Bluetooth setup

1. In MakeCode open **⚙ Settings → Project Settings** and select **No Pairing Required**. The extension does not change this setting itself; fisicabit.com connects without bonding, so *JustWorks* or *Passkey* pairing makes the phone connect but never receive data.
2. Put `start Bluetooth for fisicabit.com` as the first block in `on start`.
3. Flash the program, wait for the ◎ icon, then click **Bluetooth** on fisicabit.com and pick `BBC micro:bit [xxxxx]`.
4. If a previously paired micro:bit refuses to connect, remove ("forget") it from the operating system's Bluetooth settings and try again.

Notes:

* Bluetooth and the **Radio** extension cannot be used in the same program. USB serial keeps working alongside Bluetooth.
* Practical BLE rate is up to ~20 Hz; for 50–100 Hz use USB.
* The old `BT sample ... every ... ms` and `serial sample ... every ... ms` blocks still compile but are hidden; use the `send to fisicabit.com time and ... every ... ms` blocks.

### Connected but no data arrives (phone / Android)

Symptom: fisicabit.com shows the micro:bit as connected, but the table and graph stay empty. The cause is almost always the project settings or a stale bond stored by the phone. Try, in this order:

1. **Stale bond on the phone.** On Android: Settings → Bluetooth → `BBC micro:bit [xxxxx]` → **Forget**. Then reset the micro:bit (back button) and reconnect from fisicabit.com.
2. **Project settings.** **⚙ → Project Settings** must be **No Pairing Required**. Otherwise the `.hex` requires bonding and the phone connects but cannot read data. Select *No Pairing Required*, **download the .hex again** and re-flash.
3. **Extension version.** In the editor's **Extensions** view make sure `fisicabit-sensores` is up to date. If not, remove it, add it again from `https://github.com/martinferreiraHCA/pxt-fisicabit`, and download the `.hex` again: **firmware already on the board does not update itself**.
4. **Blocks.** `start Bluetooth for fisicabit.com` goes **inside `on start`**, and the `send to fisicabit.com via Bluetooth ...` block **inside `forever`**. Without the start block the UART service does not exist and the page connects with no data channel.
5. **fisicabit.com.** Choose **Bluetooth**, set the **number of variables** equal to the number of values in the block (not counting time) and keep **"micro:bit sends timestamp"** enabled (or disabled when you use the *without time* blocks). If they do not match, lines arrive but are discarded.
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

## Testing

`test.ts` runs in the simulator when this repository is opened as a project: it starts the UART service, exercises every sending block and checks that the transport is registered in fisicabit-sensores, printing `TEST n: PASS|FAIL` on the serial console. Real data only flows when fisicabit.com is connected to a micro:bit V2.

## Supported targets

* for PXT/microbit (micro:bit V2 only)

## License

MIT

<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
