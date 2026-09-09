# Enviar datos a fisicabit.com por USB

### @explicitHints true
### @diffs true

## Introducción @showdialog

En este tutorial vas a programar el micro:bit para que mande las lecturas de sus sensores a **fisicabit.com** por el cable USB. Un solo bloque envía el tiempo y el valor del sensor.

Necesitás: un micro:bit, su cable USB y Chrome o Edge.

## Paso 1: Elegir la frecuencia de muestreo

Arrastrá ``||FisicaBitSerial:configurar frecuencia de muestreo||`` dentro de ``||basic:al iniciar||`` y elegí **10 Hz** (10 muestras por segundo).

```blocks
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Paso 2: Mostrar que el programa corre

Agregá ``||basic:mostrar ícono||`` antes, así el micro:bit muestra un tilde cuando arranca el programa.

```blocks
basic.showIcon(IconNames.Yes)
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Paso 3: Enviar el valor de un sensor

Arrastrá ``||FisicaBitSerial:enviar a fisicabit.com||`` dentro de ``||basic:para siempre||``. Poné ``||input:aceleración (mg) x||`` en su ranura. Este único bloque toma el tiempo, envía la línea `tiempo,valor` y espera hasta la próxima muestra.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Paso 4: Descargar @showdialog

Hacé clic en **Descargar** y copiá el programa al micro:bit. Esperá a que aparezca el tilde en la pantalla de LED.

## Paso 5: Conectar en fisicabit.com @showdialog

Abrí **fisicabit.com** en Chrome o Edge:

1. Elegí **USB** y hacé clic en **Conectar**. Seleccioná el micro:bit de la lista.
2. Poné **Número de variables** en **1**.
3. Dejá activada la opción **Micro:bit envía timestamp**.
4. Hacé clic en **Iniciar**. Inclina el micro:bit y mirá la gráfica.

## Paso 6: Enviar dos valores

Reemplazá el bloque de ``||basic:para siempre||`` por ``||FisicaBitSerial:enviar a fisicabit.com ... y ...||`` y mandá la aceleración en **x** y en **y**. En fisicabit.com, poné el número de variables en **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y))
})
```

## Paso 7: Muestreo más rápido (opcional)

Para experimentos rápidos como caída libre, usá ``||FisicaBitSerial:muestrear para fisicabit.com a||`` en lugar de ``||basic:para siempre||``. Mantiene **50 Hz** con precisión, sin el retardo oculto del bucle para siempre. Poné el bloque de envío adentro.

```blocks
FisicaBitSerial.bucleMuestreo(FrecuenciaMuestreo.Hz50, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Listo @showdialog

Ya estás enviando datos a fisicabit.com. Ideas para probar:

* Colgá el micro:bit como un péndulo y medí su período.
* Dejalo caer sobre un almohadón para ver la caída libre (usá 50 Hz).
* Cambiá el sensor: nivel de luz, temperatura, rumbo de la brújula.
