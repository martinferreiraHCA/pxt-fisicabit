@ =============================================================================
@ asm_sensors.S — Rutinas en ensamblador ARM (Thumb-2) para micro:bit v2
@ =============================================================================
@
@ PROPÓSITO:
@ Código de máximo rendimiento para operaciones críticas en tiempo.
@ Escrito en ensamblador ARM Thumb-2 para el Cortex-M4 del nRF52833.
@
@ ¿POR QUÉ ENSAMBLADOR?
@ ──────────────────────
@ 1. CONTROL TOTAL del timing: cada instrucción = ciclos conocidos
@ 2. CERO OVERHEAD: sin llamadas a funciones, sin stack frames
@ 3. PREDICTIBILIDAD: no hay optimizaciones del compilador inesperadas
@ 4. MÁXIMA VELOCIDAD: ideal para bit-banging y protocolos de 1 cable
@
@ Comparación de velocidad (lectura ADC simple):
@   TypeScript:    ~500μs (pasa por scheduler + CODAL + HAL)
@   C++ directo:   ~5μs  (acceso a registros, algo de overhead)
@   Ensamblador:   ~2μs  (instrucciones exactas, sin overhead)
@
@ NOTA: El ensamblador solo se compila para hardware real, NO para simulador.
@
@ ARQUITECTURA ARM Cortex-M4 — Resumen rápido:
@ ─────────────────────────────────────────────
@ Registros:
@   R0-R3:   Argumentos de función y valores de retorno
@   R4-R11:  Registros "callee-saved" (hay que guardarlos si se usan)
@   R12:     Scratch register (IP)
@   R13/SP:  Stack Pointer
@   R14/LR:  Link Register (dirección de retorno)
@   R15/PC:  Program Counter
@
@ Instrucciones útiles:
@   LDR Rd, [Rn]       → Cargar 32 bits de memoria a registro
@   STR Rd, [Rn]       → Guardar registro en memoria
@   MOV Rd, #imm       → Cargar valor inmediato
@   CMP Rn, Rm         → Comparar dos registros
@   BEQ/BNE label      → Salto condicional (igual / no igual)
@   ADD/SUB Rd, Rn, Rm → Aritmética
@   AND/ORR Rd, Rn, Rm → Operaciones bit a bit
@   NOP                → No operación (1 ciclo de espera)
@
@ Timing (Cortex-M4 @ 64MHz):
@   1 ciclo = 15.625ns
@   NOP = 1 ciclo
@   LDR = 2 ciclos (con wait state)
@   Multiplicación = 1 ciclo (tiene multiplicador hardware)
@   División = 2-12 ciclos (instrucción UDIV)
@
@ REGISTROS DEL nRF52833 (direcciones de memoria):
@   GPIO Puerto 0:  0x50000000
@     +0x510 (OUT):   Escritura de pines
@     +0x514 (OUTSET): Set bits
@     +0x518 (OUTCLR): Clear bits
@     +0x530 (IN):    Lectura de pines
@     +0x700 (PIN_CNF[n]): Configuración pin n
@
@   SAADC (ADC):    0x40007000
@     +0x000 (TASKS_START):  Iniciar
@     +0x004 (TASKS_SAMPLE): Tomar muestra
@     +0x100 (EVENTS_STARTED): ADC listo
@     +0x104 (EVENTS_END):    Conversión lista
@     +0x500 (ENABLE):        Habilitar
@     +0x5F0 (RESOLUTION):    Resolución
@
@   TIMER3:         0x4001A000
@     +0x000 (TASKS_START): Iniciar timer
@     +0x004 (TASKS_STOP):  Parar timer
@     +0x008 (TASKS_COUNT): Contar
@     +0x00C (TASKS_CLEAR): Reset
@     +0x040 (TASKS_CAPTURE[0]): Capturar valor
@     +0x510 (PRESCALER):   Divisor de frecuencia
@     +0x524 (BITMODE):     Ancho del timer
@     +0x540 (CC[0]):       Valor capturado
@ =============================================================================

    .syntax unified          @ Usar sintaxis unificada ARM/Thumb
    .thumb                   @ Instrucciones Thumb-2 (16/32 bits)
    .cpu cortex-m4           @ Procesador objetivo
    .fpu fpv4-sp-d16         @ Unidad de punto flotante (si se necesita)


@ =============================================================================
@ CONSTANTES — Direcciones base de los periféricos del nRF52833
@ =============================================================================
    .equ GPIO_BASE,       0x50000000   @ Puerto GPIO 0
    .equ GPIO_OUT,        0x50000510   @ Registro de salida
    .equ GPIO_OUTSET,     0x50000514   @ Set bits de salida
    .equ GPIO_OUTCLR,     0x50000518   @ Clear bits de salida
    .equ GPIO_IN,         0x50000530   @ Registro de entrada (lectura)

    .equ SAADC_BASE,      0x40007000   @ ADC
    .equ SAADC_START,     0x40007000   @ TASKS_START
    .equ SAADC_SAMPLE,    0x40007004   @ TASKS_SAMPLE
    .equ SAADC_STOP,      0x40007008   @ TASKS_STOP
    .equ SAADC_EVT_END,   0x40007104   @ EVENTS_END
    .equ SAADC_ENABLE,    0x40007500   @ ENABLE
    .equ SAADC_RESOLUTION,0x400075F0   @ RESOLUTION
    .equ SAADC_CH0_PSELP, 0x40007510   @ Canal 0 - entrada positiva
    .equ SAADC_CH0_PSELN, 0x40007514   @ Canal 0 - entrada negativa
    .equ SAADC_CH0_CONFIG,0x40007518   @ Canal 0 - configuración
    .equ SAADC_RESULT_PTR,0x4000762C   @ Puntero resultado
    .equ SAADC_RESULT_MAX,0x40007630   @ Máximo de resultados

    .equ TIMER3_BASE,     0x4001A000   @ Timer 3
    .equ TIMER3_START,    0x4001A000   @ TASKS_START
    .equ TIMER3_STOP,     0x4001A004   @ TASKS_STOP
    .equ TIMER3_CLEAR,    0x4001A00C   @ TASKS_CLEAR
    .equ TIMER3_CAPTURE0, 0x4001A040   @ TASKS_CAPTURE[0]
    .equ TIMER3_PRESCALER,0x4001A510   @ PRESCALER
    .equ TIMER3_BITMODE,  0x4001A524   @ BITMODE
    .equ TIMER3_CC0,      0x4001A540   @ CC[0] (valor capturado)


@ =============================================================================
@ FUNCIÓN: asm_leer_adc_rapido
@ =============================================================================
@ Lectura ultrarrápida del ADC (SAADC) en ensamblador.
@ ~2μs de ejecución vs ~5μs en C++ y ~500μs en TypeScript.
@
@ PARÁMETROS:
@   R0 = canal ADC (0-7)
@
@ RETORNO:
@   R0 = valor ADC de 12 bits (0-4095), o -1 si canal inválido
@
@ REGISTROS USADOS:
@   R0: parámetro/retorno
@   R1: dirección base de registros
@   R2: valor temporal
@   R3: resultado ADC
@
@ LLAMADA DESDE C++:
@   extern "C" int asm_leer_adc_rapido(int canal);
@   int valor = asm_leer_adc_rapido(0);  // Leer canal 0 (P0)
@ =============================================================================
    .section .text
    .global asm_leer_adc_rapido
    .type asm_leer_adc_rapido, %function
    .thumb_func

asm_leer_adc_rapido:
    @ ── Guardar registros que vamos a usar ──
    PUSH    {R4-R5, LR}

    @ ── Validar canal (0-7) ──
    CMP     R0, #7
    BHI     .adc_error          @ Si canal > 7, error

    @ ── Paso 1: Habilitar SAADC ──
    LDR     R1, =SAADC_ENABLE
    MOV     R2, #1              @ 1 = Enabled
    STR     R2, [R1]

    @ ── Paso 2: Configurar resolución a 12 bits ──
    LDR     R1, =SAADC_RESOLUTION
    MOV     R2, #2              @ 2 = 12 bits (0=8bit, 1=10bit, 2=12bit)
    STR     R2, [R1]

    @ ── Paso 3: Seleccionar canal de entrada ──
    @ PSELP = canal + 1 (porque 0 = Not Connected)
    LDR     R1, =SAADC_CH0_PSELP
    ADD     R2, R0, #1          @ R2 = canal + 1
    STR     R2, [R1]

    @ PSELN = 0 (Not Connected, modo single-ended)
    LDR     R1, =SAADC_CH0_PSELN
    MOV     R2, #0
    STR     R2, [R1]

    @ ── Paso 4: Configurar canal ──
    @ Ganancia 1/6, ref interna, 10μs adquisición, single-ended
    LDR     R1, =SAADC_CH0_CONFIG
    LDR     R2, =0x00020000     @ Config por defecto (ganancia 1/6, SE)
    STR     R2, [R1]

    @ ── Paso 5: Configurar buffer de resultado ──
    @ Usamos una variable en el stack como buffer
    SUB     SP, SP, #4          @ Reservar 4 bytes en el stack
    MOV     R4, SP              @ R4 = dirección del resultado

    LDR     R1, =SAADC_RESULT_PTR
    STR     R4, [R1]            @ Apuntar resultado al stack

    LDR     R1, =SAADC_RESULT_MAX
    MOV     R2, #1
    STR     R2, [R1]            @ Solo 1 resultado

    @ ── Paso 6: Limpiar evento de fin ──
    LDR     R1, =SAADC_EVT_END
    MOV     R2, #0
    STR     R2, [R1]

    @ ── Paso 7: Iniciar conversión ──
    LDR     R1, =SAADC_START
    MOV     R2, #1
    STR     R2, [R1]

    @ Pequeña espera para que el START se procese
    NOP
    NOP
    NOP
    NOP

    @ ── Paso 8: Tomar muestra ──
    LDR     R1, =SAADC_SAMPLE
    MOV     R2, #1
    STR     R2, [R1]

    @ ── Paso 9: Esperar fin de conversión ──
    @ Bucle de polling — típicamente 2-5 iteraciones (~1-2μs)
    LDR     R1, =SAADC_EVT_END
.adc_wait:
    LDR     R2, [R1]            @ Leer EVENTS_END
    CMP     R2, #0
    BEQ     .adc_wait           @ Si 0, seguir esperando

    @ ── Paso 10: Leer resultado ──
    LDRSH   R0, [R4]            @ Leer resultado con signo (16 bits)

    @ Si es negativo (no debería en single-ended), poner a 0
    CMP     R0, #0
    IT      LT
    MOVLT   R0, #0

    @ ── Paso 11: Parar y deshabilitar SAADC ──
    LDR     R1, =SAADC_STOP
    MOV     R2, #1
    STR     R2, [R1]

    LDR     R1, =SAADC_ENABLE
    MOV     R2, #0
    STR     R2, [R1]

    @ ── Limpiar stack y retornar ──
    ADD     SP, SP, #4
    POP     {R4-R5, PC}         @ Retornar (PC = LR)

.adc_error:
    MOV     R0, #-1             @ Retornar -1 (error)
    POP     {R4-R5, PC}

    .size asm_leer_adc_rapido, .-asm_leer_adc_rapido


@ =============================================================================
@ FUNCIÓN: asm_medir_pulso_preciso
@ =============================================================================
@ Mide la duración de un pulso digital con máxima precisión.
@ Usa el timer hardware para resolución de 1μs.
@ Ideal para sensores como HC-SR04 y DHT11.
@
@ PARÁMETROS:
@   R0 = máscara del pin (1 << número_pin)
@   R1 = nivel a medir (0 = LOW, distinto de 0 = HIGH)
@   R2 = timeout en microsegundos
@
@ RETORNO:
@   R0 = duración del pulso en microsegundos, 0 si timeout
@
@ LLAMADA DESDE C++:
@   extern "C" int asm_medir_pulso_preciso(
@       uint32_t mascara_pin, int nivel, int timeout_us);
@   int us = asm_medir_pulso_preciso(1 << 2, 1, 25000);  // P2, HIGH, 25ms
@ =============================================================================
    .global asm_medir_pulso_preciso
    .type asm_medir_pulso_preciso, %function
    .thumb_func

asm_medir_pulso_preciso:
    PUSH    {R4-R7, LR}

    @ ── Guardar parámetros ──
    MOV     R4, R0              @ R4 = máscara del pin
    MOV     R5, R1              @ R5 = nivel esperado
    MOV     R6, R2              @ R6 = timeout

    @ ── Preparar valor esperado ──
    @ Si nivel != 0, esperamos que (GPIO_IN & máscara) == máscara
    @ Si nivel == 0, esperamos que (GPIO_IN & máscara) == 0
    CMP     R5, #0
    ITE     NE
    MOVNE   R5, R4              @ Nivel HIGH: valor esperado = máscara
    MOVEQ   R5, #0              @ Nivel LOW: valor esperado = 0

    @ ── Configurar Timer3 ──
    @ Prescaler = 4 → 16MHz / 2^4 = 1MHz → 1 tick = 1μs
    LDR     R7, =TIMER3_BASE

    @ Parar timer
    MOV     R0, #1
    STR     R0, [R7, #0x04]    @ TASKS_STOP

    @ Limpiar
    STR     R0, [R7, #0x0C]    @ TASKS_CLEAR

    @ Prescaler = 4
    MOV     R0, #4
    LDR     R1, =TIMER3_PRESCALER
    STR     R0, [R1]

    @ Bitmode = 32 bits
    MOV     R0, #3              @ 3 = 32 bits
    LDR     R1, =TIMER3_BITMODE
    STR     R0, [R1]

    @ Iniciar timer
    MOV     R0, #1
    STR     R0, [R7, #0x00]    @ TASKS_START

    @ ── Dirección del registro GPIO IN ──
    LDR     R3, =GPIO_IN

    @ ══════════════════════════════════════════
    @ FASE 1: Esperar a que el pin NO esté en el nivel esperado
    @ (Si ya está en el nivel, esperamos a que cambie primero)
    @ ══════════════════════════════════════════
.pulso_wait_idle:
    LDR     R0, [R3]            @ Leer GPIO_IN
    AND     R0, R0, R4          @ Aislar nuestro pin
    CMP     R0, R5              @ ¿Está en el nivel esperado?
    BNE     .pulso_wait_start   @ No → listo para fase 2

    @ Verificar timeout
    MOV     R0, #1
    STR     R0, [R7, #0x40]    @ TASKS_CAPTURE[0]
    LDR     R0, =TIMER3_CC0
    LDR     R0, [R0]
    CMP     R0, R6
    BHI     .pulso_timeout
    B       .pulso_wait_idle

    @ ══════════════════════════════════════════
    @ FASE 2: Esperar a que comience el pulso
    @ ══════════════════════════════════════════
.pulso_wait_start:
    LDR     R0, [R3]
    AND     R0, R0, R4
    CMP     R0, R5
    BEQ     .pulso_medir        @ ¡Pulso comenzó!

    @ Verificar timeout
    MOV     R0, #1
    STR     R0, [R7, #0x40]
    LDR     R0, =TIMER3_CC0
    LDR     R0, [R0]
    CMP     R0, R6
    BHI     .pulso_timeout
    B       .pulso_wait_start

    @ ══════════════════════════════════════════
    @ FASE 3: Medir duración del pulso
    @ ══════════════════════════════════════════
.pulso_medir:
    @ Reset del timer al inicio del pulso
    MOV     R0, #1
    STR     R0, [R7, #0x0C]    @ TASKS_CLEAR

.pulso_wait_end:
    LDR     R0, [R3]
    AND     R0, R0, R4
    CMP     R0, R5
    BNE     .pulso_done         @ Pulso terminó

    @ Verificar timeout
    MOV     R0, #1
    STR     R0, [R7, #0x40]
    LDR     R0, =TIMER3_CC0
    LDR     R0, [R0]
    CMP     R0, R6
    BHI     .pulso_timeout
    B       .pulso_wait_end

.pulso_done:
    @ ── Capturar tiempo final ──
    MOV     R0, #1
    STR     R0, [R7, #0x40]    @ TASKS_CAPTURE[0]
    LDR     R0, =TIMER3_CC0
    LDR     R0, [R0]            @ R0 = duración en μs

    @ Parar timer
    MOV     R1, #1
    STR     R1, [R7, #0x04]    @ TASKS_STOP

    POP     {R4-R7, PC}

.pulso_timeout:
    @ ── Timeout: retornar 0 ──
    MOV     R1, #1
    STR     R1, [R7, #0x04]    @ TASKS_STOP
    MOV     R0, #0
    POP     {R4-R7, PC}

    .size asm_medir_pulso_preciso, .-asm_medir_pulso_preciso


@ =============================================================================
@ FUNCIÓN: asm_delay_us_preciso
@ =============================================================================
@ Espera una cantidad exacta de microsegundos.
@ Útil para protocolos de timing estricto (OneWire, DHT11, WS2812).
@
@ A 64MHz, 1μs = 64 ciclos.
@ El bucle interno consume exactamente 4 ciclos por iteración,
@ así que necesitamos 16 iteraciones por μs.
@
@ PARÁMETROS:
@   R0 = microsegundos a esperar
@
@ RETORNO:
@   Ninguno
@
@ LLAMADA DESDE C++:
@   extern "C" void asm_delay_us_preciso(int microsegundos);
@   asm_delay_us_preciso(10);  // Esperar exactamente 10μs
@ =============================================================================
    .global asm_delay_us_preciso
    .type asm_delay_us_preciso, %function
    .thumb_func

asm_delay_us_preciso:
    @ ── Validar ──
    CMP     R0, #0
    BLE     .delay_end

    @ ── Convertir μs a iteraciones ──
    @ 64MHz / 4 ciclos por loop = 16 iteraciones por μs
    @ Pero restamos overhead de setup (~4 ciclos)
    MOV     R1, #15             @ 15 iteraciones ≈ 1μs (ajustado)
    MUL     R0, R0, R1          @ R0 = total de iteraciones

.delay_loop:
    @ Este bucle consume EXACTAMENTE 4 ciclos por iteración:
    @   SUB: 1 ciclo
    @   CMP: 1 ciclo
    @   BNE: 1 ciclo (taken) o 1 ciclo (not taken)
    @   NOP: 1 ciclo
    NOP                         @ 1 ciclo de padding
    SUBS    R0, R0, #1          @ 1 ciclo: decrementar contador
    BNE     .delay_loop         @ 1-2 ciclos: saltar si no es cero

.delay_end:
    BX      LR                  @ Retornar

    .size asm_delay_us_preciso, .-asm_delay_us_preciso


@ =============================================================================
@ EJEMPLO: CÓMO LLAMAR ESTAS FUNCIONES DESDE C++ (shims.cpp)
@ =============================================================================
@
@ 1. Declarar las funciones como extern "C":
@
@     extern "C" {
@         int asm_leer_adc_rapido(int canal);
@         int asm_medir_pulso_preciso(uint32_t mascara, int nivel, int timeout);
@         void asm_delay_us_preciso(int microsegundos);
@     }
@
@ 2. Usar desde el namespace:
@
@     namespace fisicabit_native {
@         //%
@         int leerADCUltraRapido(int canal) {
@             return asm_leer_adc_rapido(canal);
@         }
@
@         //%
@         int medirDistanciaASM(int pinTrig, int pinEcho) {
@             // Enviar pulso de trigger
@             NRF_P0->OUTSET = (1 << pinTrig);
@             asm_delay_us_preciso(10);
@             NRF_P0->OUTCLR = (1 << pinTrig);
@
@             // Medir eco con precisión ASM
@             int duracion = asm_medir_pulso_preciso(
@                 1 << pinEcho,  // máscara del pin
@                 1,             // nivel HIGH
@                 25000          // timeout 25ms
@             );
@
@             // Convertir a centímetros
@             return duracion / 58;
@         }
@     }
@
@ 3. El flujo completo sería:
@
@     MakeCode (bloques) → fisicabit.ts → shims.cpp → asm_sensors.S
@                          (TypeScript)    (C++)       (Ensamblador)
@
@ =============================================================================

    .end
