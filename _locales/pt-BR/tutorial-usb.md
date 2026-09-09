# Enviar dados para fisicabit.com por USB

### @explicitHints true
### @diffs true

## Introdução @showdialog

Neste tutorial você vai programar o micro:bit para enviar as leituras dos sensores para **fisicabit.com** pelo cabo USB. Um único bloco envia o tempo e o valor do sensor.

Você precisa de: um micro:bit, o cabo USB e Chrome ou Edge.

## Passo 1: Mostrar que o programa está rodando

Arraste ``||basic:mostrar ícone||`` para dentro de ``||basic:ao iniciar||``, para o micro:bit mostrar um sinal de certo quando o programa iniciar.

```blocks
basic.showIcon(IconNames.Yes)
```

## Passo 2: Enviar o tempo e o valor de um sensor

Arraste ``||FisicaBitSerial:enviar para fisicabit.com tempo e ... a cada ... ms||`` para dentro de ``||basic:sempre||``. Coloque ``||input:aceleração (mg) x||`` no espaço e deixe **100 ms** (10 amostras por segundo). Esse único bloco pega o tempo do micro:bit, envia a linha `tempo,valor` e espera até a próxima amostra.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 100)
})
```

## Passo 3: Baixar @showdialog

Clique em **Baixar** e copie o programa para o micro:bit. Espere o sinal de certo aparecer na tela de LED.

## Passo 4: Conectar no fisicabit.com @showdialog

Abra **fisicabit.com** no Chrome ou Edge:

1. Escolha **USB** e clique em **Conectar**. Selecione o micro:bit na lista.
2. Defina **Número de variáveis** como **1**.
3. Deixe **Micro:bit envia timestamp** ativado.
4. Clique em **Iniciar**. Incline o micro:bit e observe o gráfico.

## Passo 5: Enviar dois valores

Substitua o bloco de ``||basic:sempre||`` por ``||FisicaBitSerial:enviar para fisicabit.com tempo, ... e ... a cada ... ms||`` e envie a aceleração em **x** e em **y**. No fisicabit.com, defina o número de variáveis como **2**.

```blocks
basic.forever(function () {
    FisicaBitSerial.enviar2(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), 100)
})
```

## Passo 6: Amostragem mais rápida (opcional)

Para experimentos rápidos como queda livre, use ``||FisicaBitSerial:laço rápido para fisicabit.com a cada ... ms||`` em vez de ``||basic:sempre||`` com **20 ms** (50 amostras por segundo). Ele mantém o ritmo com precisão, sem o atraso oculto do laço sempre. Coloque o bloco de envio dentro.

```blocks
FisicaBitSerial.bucleMuestreo(20, function () {
    FisicaBitSerial.enviar1(input.acceleration(Dimension.X), 20)
})
```

## Pronto @showdialog

Você já está enviando dados para fisicabit.com. Ideias para testar:

* Pendure o micro:bit como um pêndulo e meça o período.
* Solte-o sobre uma almofada para ver a queda livre (use 50 Hz).
* Troque o sensor: nível de luz, temperatura, direção da bússola.
