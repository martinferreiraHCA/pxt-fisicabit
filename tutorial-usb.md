# Send data to fisicabit.com over USB

### @explicitHints true
### @diffs true

## Introduction @showdialog

In this tutorial you will program the micro:bit to stream sensor readings to **fisicabit.com** through the USB cable. A single block sends the time and the sensor value.

You need: a micro:bit, its USB cable, and Chrome or Edge.

## Step 1: Show that the program is running

Drag ``||basic:show icon||`` into ``||basic:on start||``, so the micro:bit displays a check mark when the program starts.

```blocks
basic.showIcon(IconNames.Yes)
```

## Step 2: Send time and a sensor value

Drag ``||FisicaBitSerial:send to fisicabit.com time and ... every ... ms||`` into ``||basic:forever||``. Put ``||input:acceleration (mg) x||`` in its slot and leave **100 ms** (10 samples per second). This one block takes the micro:bit time, sends the line `time,value` and waits until the next sample.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 100)
})
```

## Step 3: Download @showdialog

Click **Download** and copy the program to the micro:bit. Wait until the check mark appears on the LED display.

## Step 4: Connect on fisicabit.com @showdialog

Open **fisicabit.com** in Chrome or Edge:

1. Select **USB** and click **Connect**. Pick the micro:bit from the list.
2. Set **Number of variables** to **1**.
3. Keep **Micro:bit sends timestamp** enabled.
4. Click **Start**. Tilt the micro:bit and watch the graph.

## Step 5: Send two values

Replace the block in ``||basic:forever||`` with ``||FisicaBitSerial:send to fisicabit.com time, ... and ... every ... ms||`` and send the acceleration on **x** and **y**. On fisicabit.com, set the number of variables to **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

## Step 6: Faster sampling (optional)

For fast experiments such as free fall, use ``||FisicaBitSerial:fisicabit.com fast loop every ... ms||`` instead of ``||basic:forever||`` with **20 ms** (50 samples per second). It keeps a precise rate without the hidden delay of the forever loop. Put the send block inside it.

```blocks
FisicaBitSerial.bucleMuestreo(20, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 20)
})
```

## Done @showdialog

You are streaming data to fisicabit.com. Ideas to try:

* Hang the micro:bit as a pendulum and measure its period.
* Drop it on a cushion to see free fall (use 50 Hz).
* Swap the sensor: light level, temperature, compass heading.
