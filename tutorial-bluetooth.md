# Send data to fisicabit.com over Bluetooth

### @explicitHints true
### @diffs true

## Introduction @showdialog

In this tutorial you will program the micro:bit to stream sensor readings to **fisicabit.com** wirelessly, over Bluetooth. No cable is needed while measuring, so the micro:bit can swing, fall or ride on a cart.

You need: a micro:bit, its USB cable (only to download the program), and Chrome or Edge on a computer or Android device with Bluetooth.

## Step 1: Start Bluetooth

Drag ``||FisicaBitBT:start Bluetooth for fisicabit.com||`` into ``||basic:on start||``. It must be the **first** block. It turns on the Bluetooth service that fisicabit.com looks for and shows a target icon while waiting for a connection.

```blocks
FisicaBitBT.inicioRapido()
```

## Step 2: Choose the sampling rate

Below it, add ``||FisicaBitBT:set Bluetooth sampling rate||`` and pick **10 Hz**.

```blocks
FisicaBitBT.inicioRapido()
FisicaBitBT.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Step 3: Send a sensor value

Drag ``||FisicaBitBT:send to fisicabit.com via Bluetooth||`` into ``||basic:forever||`` and put ``||input:acceleration (mg) x||`` in its slot. The block only transmits while fisicabit.com is connected.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X))
})
```

## Step 4: Download @showdialog

Click **Download** and copy the program to the micro:bit. When the target icon (◎) appears, the micro:bit is waiting for fisicabit.com. You can unplug the cable now.

## Step 5: Connect on fisicabit.com @showdialog

Open **fisicabit.com** in Chrome or Edge:

1. Select **Bluetooth** and click **Connect**. Pick `BBC micro:bit [xxxxx]` from the list.
2. The LED display changes to a heart (♥) when connected.
3. Set **Number of variables** to **1** and keep **Micro:bit sends timestamp** enabled.
4. Click **Start** and move the micro:bit.

If a micro:bit that was paired before refuses to connect, remove it from the Bluetooth settings of your computer or phone and try again.

## Step 6: Send three values

Replace the block in ``||basic:forever||`` with ``||FisicaBitBT:send to fisicabit.com via Bluetooth ... , ... and ...||`` and send the acceleration on **x**, **y** and **z**. On fisicabit.com, set the number of variables to **3**.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar3(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z))
})
```

## Step 7: Know when you are connected (optional)

Add ``||FisicaBitBT:on fisicabit.com Bluetooth connected||`` and play a short sound inside it, so you hear when the page connects.

```blocks
FisicaBitBT.alConectar(function () {
    music.playTone(Note.C5, music.beat(BeatFraction.Quarter))
})
```

## Done @showdialog

Your micro:bit now sends data wirelessly. Tips:

* Bluetooth works well up to about 20 Hz. For 50 to 100 Hz use the USB tutorial.
* Bluetooth and the Radio extension cannot be used in the same program.
* iPhone and iPad cannot use Bluetooth with fisicabit.com; use Android, Windows, macOS, Linux or ChromeOS.
