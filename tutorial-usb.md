# Send data to fisicabit.com over USB

### @explicitHints true
### @diffs true

## Introduction @showdialog

In this tutorial you will program the micro:bit to stream sensor readings to **fisicabit.com** through the USB cable. A single block sends the time and the sensor value.

You need: a micro:bit, its USB cable, and Chrome or Edge.

## Step 1: Choose the sampling rate

Drag ``||FisicaBitSerial:set sampling rate||`` into ``||basic:on start||`` and pick **10 Hz** (10 samples per second).

```blocks
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Step 2: Show that the program is running

Add ``||basic:show icon||`` before it, so the micro:bit displays a check mark when the program starts.

```blocks
basic.showIcon(IconNames.Yes)
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Step 3: Send a sensor value

Drag ``||FisicaBitSerial:send to fisicabit.com||`` into ``||basic:forever||``. Put ``||input:acceleration (mg) x||`` in its slot. This one block takes the time, sends the line `time,value` and waits until the next sample.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Step 4: Download @showdialog

Click **Download** and copy the program to the micro:bit. Wait until the check mark appears on the LED display.

## Step 5: Connect on fisicabit.com @showdialog

Open **fisicabit.com** in Chrome or Edge:

1. Select **USB** and click **Connect**. Pick the micro:bit from the list.
2. Set **Number of variables** to **1**.
3. Keep **Micro:bit sends timestamp** enabled.
4. Click **Start**. Tilt the micro:bit and watch the graph.

## Step 6: Send two values

Replace the block in ``||basic:forever||`` with ``||FisicaBitSerial:send to fisicabit.com ... and ...||`` and send the acceleration on **x** and **y**. On fisicabit.com, set the number of variables to **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y))
})
```

## Step 7: Faster sampling (optional)

For fast experiments such as free fall, use ``||FisicaBitSerial:fisicabit.com sampling loop at||`` instead of ``||basic:forever||``. It keeps a precise **50 Hz** rate without the hidden delay of the forever loop. Put the send block inside it.

```blocks
FisicaBitSerial.bucleMuestreo(FrecuenciaMuestreo.Hz50, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Done @showdialog

You are streaming data to fisicabit.com. Ideas to try:

* Hang the micro:bit as a pendulum and measure its period.
* Drop it on a cushion to see free fall (use 50 Hz).
* Swap the sensor: light level, temperature, compass heading.
