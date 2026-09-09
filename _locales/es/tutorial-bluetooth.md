# Enviar datos a fisicabit.com por Bluetooth

### @explicitHints true
### @diffs true

## Introducción @showdialog

En este tutorial vas a programar el micro:bit para que mande las lecturas de sus sensores a **fisicabit.com** sin cable, por Bluetooth. Mientras medís no hace falta ningún cable, así que el micro:bit puede oscilar, caer o ir arriba de un carrito.

Necesitás: un micro:bit, su cable USB (solo para descargar el programa) y Chrome o Edge en una computadora o Android con Bluetooth.

## Paso 1: Iniciar Bluetooth

Arrastrá ``||FisicaBitBT:iniciar Bluetooth para fisicabit.com||`` dentro de ``||basic:al iniciar||``. Tiene que ser el **primer** bloque. Enciende el servicio Bluetooth que busca fisicabit.com y muestra una diana mientras espera la conexión.

```blocks
FisicaBitBT.inicioRapido()
```

## Paso 2: Elegir la frecuencia de muestreo

Debajo, agregá ``||FisicaBitBT:configurar frecuencia de muestreo Bluetooth||`` y elegí **10 Hz**.

```blocks
FisicaBitBT.inicioRapido()
FisicaBitBT.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Paso 3: Enviar el valor de un sensor

Arrastrá ``||FisicaBitBT:enviar a fisicabit.com por Bluetooth||`` dentro de ``||basic:para siempre||`` y poné ``||input:aceleración (mg) x||`` en su ranura. El bloque solo transmite mientras fisicabit.com está conectado.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X))
})
```

## Paso 4: Descargar @showdialog

Hacé clic en **Descargar** y copiá el programa al micro:bit. Cuando aparece la diana (◎), el micro:bit está esperando a fisicabit.com. Ya podés desenchufar el cable.

## Paso 5: Conectar en fisicabit.com @showdialog

Abrí **fisicabit.com** en Chrome o Edge:

1. Elegí **Bluetooth** y hacé clic en **Conectar**. Seleccioná `BBC micro:bit [xxxxx]` de la lista.
2. La pantalla de LED cambia a un corazón (♥) al conectarse.
3. Poné **Número de variables** en **1** y dejá activada **Micro:bit envía timestamp**.
4. Hacé clic en **Iniciar** y mové el micro:bit.

Si un micro:bit que estuvo vinculado antes no se conecta, quitalo de la configuración Bluetooth de la computadora o el celular y volvé a intentar.

## Paso 6: Enviar tres valores

Reemplazá el bloque de ``||basic:para siempre||`` por ``||FisicaBitBT:enviar a fisicabit.com por Bluetooth ... , ... y ...||`` y mandá la aceleración en **x**, **y** y **z**. En fisicabit.com, poné el número de variables en **3**.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar3(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z))
})
```

## Paso 7: Saber cuándo estás conectado (opcional)

Agregá ``||FisicaBitBT:al conectar fisicabit.com por Bluetooth||`` y poné un sonido corto adentro, así escuchás cuando la página se conecta.

```blocks
FisicaBitBT.alConectar(function () {
    music.playTone(Note.C5, music.beat(BeatFraction.Quarter))
})
```

## Listo @showdialog

Tu micro:bit ya manda datos sin cable. Consejos:

* Bluetooth funciona bien hasta unos 20 Hz. Para 50 a 100 Hz usá el tutorial de USB.
* Bluetooth y la extensión Radio no pueden usarse en el mismo programa.
* iPhone y iPad no pueden usar Bluetooth con fisicabit.com; usá Android, Windows, macOS, Linux o ChromeOS.
