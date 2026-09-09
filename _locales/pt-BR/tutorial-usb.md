# Enviar dados para fisicabit.com por USB

### @explicitHints true
### @diffs true

## Introdução @showdialog

Neste tutorial você vai programar o micro:bit para enviar as leituras dos sensores para **fisicabit.com** pelo cabo USB. Um único bloco envia o tempo e o valor do sensor.

Você precisa de: um micro:bit, o cabo USB e Chrome ou Edge.

## Passo 1: Escolher a taxa de amostragem

Arraste ``||FisicaBitSerial:definir taxa de amostragem||`` para dentro de ``||basic:ao iniciar||`` e escolha **10 Hz** (10 amostras por segundo).

```blocks
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Passo 2: Mostrar que o programa está rodando

Adicione ``||basic:mostrar ícone||`` antes, para o micro:bit mostrar um sinal de certo quando o programa iniciar.

```blocks
basic.showIcon(IconNames.Yes)
FisicaBitSerial.fijarFrecuencia(FrecuenciaMuestreo.Hz10)
```

## Passo 3: Enviar o valor de um sensor

Arraste ``||FisicaBitSerial:enviar para fisicabit.com||`` para dentro de ``||basic:sempre||``. Coloque ``||input:aceleração (mg) x||`` no espaço. Esse único bloco pega o tempo, envia a linha `tempo,valor` e espera até a próxima amostra.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Passo 4: Baixar @showdialog

Clique em **Baixar** e copie o programa para o micro:bit. Espere o sinal de certo aparecer na tela de LED.

## Passo 5: Conectar no fisicabit.com @showdialog

Abra **fisicabit.com** no Chrome ou Edge:

1. Escolha **USB** e clique em **Conectar**. Selecione o micro:bit na lista.
2. Defina **Número de variáveis** como **1**.
3. Deixe **Micro:bit envia timestamp** ativado.
4. Clique em **Iniciar**. Incline o micro:bit e observe o gráfico.

## Passo 6: Enviar dois valores

Substitua o bloco de ``||basic:sempre||`` por ``||FisicaBitSerial:enviar para fisicabit.com ... e ...||`` e envie a aceleração em **x** e em **y**. No fisicabit.com, defina o número de variáveis como **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y))
})
```

## Passo 7: Amostragem mais rápida (opcional)

Para experimentos rápidos como queda livre, use ``||FisicaBitSerial:amostrar para fisicabit.com a||`` em vez de ``||basic:sempre||``. Ele mantém **50 Hz** com precisão, sem o atraso oculto do laço sempre. Coloque o bloco de envio dentro.

```blocks
FisicaBitSerial.bucleMuestreo(FrecuenciaMuestreo.Hz50, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X))
})
```

## Pronto @showdialog

Você já está enviando dados para fisicabit.com. Ideias para testar:

* Pendure o micro:bit como um pêndulo e meça o período.
* Solte-o sobre uma almofada para ver a queda livre (use 50 Hz).
* Troque o sensor: nível de luz, temperatura, direção da bússola.
