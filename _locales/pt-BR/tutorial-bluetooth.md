# Enviar dados para fisicabit.com por Bluetooth

### @explicitHints true
### @diffs true

## Introdução @showdialog

Neste tutorial você vai programar o micro:bit para enviar as leituras dos sensores para **fisicabit.com** sem fio, por Bluetooth. Durante a medição não é preciso nenhum cabo, então o micro:bit pode oscilar, cair ou andar em cima de um carrinho.

Você precisa de: um micro:bit, o cabo USB (só para baixar o programa) e Chrome ou Edge em um computador ou Android com Bluetooth.

## Passo 1: Iniciar o Bluetooth

Arraste ``||FisicaBitBT:iniciar Bluetooth para fisicabit.com||`` para dentro de ``||basic:ao iniciar||``. Ele deve ser o **primeiro** bloco. Liga o serviço Bluetooth que o fisicabit.com procura e mostra um alvo enquanto espera a conexão.

```blocks
FisicaBitBT.inicioRapido()
```

## Passo 2: Enviar o tempo e o valor de um sensor

Arraste ``||FisicaBitBT:enviar para fisicabit.com por Bluetooth tempo e ... a cada ... ms||`` para dentro de ``||basic:sempre||``, coloque ``||input:aceleração (mg) x||`` no espaço e deixe **100 ms** (10 amostras por segundo). O bloco envia `tempo,valor` e só transmite enquanto o fisicabit.com está conectado.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar1(input.acceleration(Dimension.X), 100)
})
```

## Passo 3: Baixar @showdialog

Clique em **Baixar** e copie o programa para o micro:bit. Quando o alvo (◎) aparecer, o micro:bit está esperando o fisicabit.com. Você já pode desconectar o cabo.

## Passo 4: Conectar no fisicabit.com @showdialog

Abra **fisicabit.com** no Chrome ou Edge:

1. Escolha **Bluetooth** e clique em **Conectar**. Selecione `BBC micro:bit [xxxxx]` na lista.
2. A tela de LED muda para um coração (♥) ao conectar.
3. Defina **Número de variáveis** como **1** e deixe **Micro:bit envia timestamp** ativado.
4. Clique em **Iniciar** e mova o micro:bit.

Se um micro:bit que já foi pareado não conectar, remova-o das configurações de Bluetooth do computador ou do celular e tente de novo.

## Passo 5: Enviar três valores

Substitua o bloco de ``||basic:sempre||`` por ``||FisicaBitBT:enviar para fisicabit.com por Bluetooth tempo, ... , ... e ... a cada ... ms||`` e envie a aceleração em **x**, **y** e **z**. No fisicabit.com, defina o número de variáveis como **3**.

```blocks
basic.forever(function () {
    FisicaBitBT.enviar3(input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z), 100)
})
```

## Passo 6: Saber quando está conectado (opcional)

Adicione ``||FisicaBitBT:ao conectar fisicabit.com por Bluetooth||`` e coloque um som curto dentro, para ouvir quando a página conectar.

```blocks
FisicaBitBT.alConectar(function () {
    music.playTone(Note.C5, music.beat(BeatFraction.Quarter))
})
```

## Pronto @showdialog

Seu micro:bit já envia dados sem fio. Dicas:

* O Bluetooth funciona bem até uns 20 Hz. Para 50 a 100 Hz use o tutorial de USB.
* Bluetooth e a extensão Rádio não podem ser usados no mesmo programa.
* iPhone e iPad não conseguem usar Bluetooth com o fisicabit.com; use Android, Windows, macOS, Linux ou ChromeOS.
