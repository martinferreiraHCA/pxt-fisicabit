# Enviar datos a fisicabit.com por USB

### @explicitHints true
### @diffs true

## Introducción @showdialog

En este tutorial vas a programar el micro:bit para que mande las lecturas de sus sensores a **fisicabit.com** por el cable USB. Un solo bloque envía el tiempo y el valor del sensor.

Necesitás: un micro:bit, su cable USB y Chrome o Edge.

## Paso 1: Mostrar que el programa corre

Arrastrá ``||basic:mostrar ícono||`` dentro de ``||basic:al iniciar||``, así el micro:bit muestra un tilde cuando arranca el programa.

```blocks
basic.showIcon(IconNames.Yes)
```

## Paso 2: Enviar el tiempo y el valor de un sensor

Arrastrá ``||FisicaBitSerial:enviar a fisicabit.com tiempo y ... cada ... ms||`` dentro de ``||basic:para siempre||``. Poné ``||input:aceleración (mg) x||`` en su ranura y dejá **100 ms** (10 muestras por segundo). Este único bloque toma el tiempo del micro:bit, envía la línea `tiempo,valor` y espera hasta la próxima muestra.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 100)
})
```

## Paso 3: Descargar @showdialog

Hacé clic en **Descargar** y copiá el programa al micro:bit. Esperá a que aparezca el tilde en la pantalla de LED.

## Paso 4: Conectar en fisicabit.com @showdialog

Abrí **fisicabit.com** en Chrome o Edge:

1. Elegí **USB** y hacé clic en **Conectar**. Seleccioná el micro:bit de la lista.
2. Poné **Número de variables** en **1**.
3. Dejá activada la opción **Micro:bit envía timestamp**.
4. Hacé clic en **Iniciar**. Inclina el micro:bit y mirá la gráfica.

## Paso 5: Enviar dos valores

Reemplazá el bloque de ``||basic:para siempre||`` por ``||FisicaBitSerial:enviar a fisicabit.com tiempo, ... y ... cada ... ms||`` y mandá la aceleración en **x** y en **y**. En fisicabit.com, poné el número de variables en **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

## Paso 6: Muestreo más rápido (opcional)

Para experimentos rápidos como caída libre, usá ``||FisicaBitSerial:bucle rápido para fisicabit.com cada ... ms||`` en lugar de ``||basic:para siempre||`` con **20 ms** (50 muestras por segundo). Mantiene el ritmo con precisión, sin el retardo oculto del bucle para siempre. Poné el bloque de envío adentro.

```blocks
FisicaBitSerial.bucleMuestreo(20, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 20)
})
```

## Listo @showdialog

Ya estás enviando datos a fisicabit.com. Ideas para probar:

* Colgá el micro:bit como un péndulo y medí su período.
* Dejalo caer sobre un almohadón para ver la caída libre (usá 50 Hz).
* Cambiá el sensor: nivel de luz, temperatura, rumbo de la brújula.
