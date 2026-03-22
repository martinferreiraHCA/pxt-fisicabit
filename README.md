# FisicaBit Sensores — Extensión micro:bit

> Plantilla de extensión MakeCode para micro:bit con ejemplos de integración C++ y Ensamblador ARM.
> Proyecto: [fisicabit.com](https://fisicabit.com)

## Usar esta extensión

En MakeCode, ir a **Extensiones** → pegar la URL de este repositorio:

```
https://github.com/martinferreiraHCA/Extension-de-prueba
```

## Estructura del proyecto

```
├── pxt.json               ← Manifiesto: dependencias, archivos, metadatos
├── enums.d.ts             ← Enumeraciones (tipos de sensor, unidades, pines)
├── fisicabit.ts           ← Bloques de sensores (FisicaBit Sensores — rojo)
├── bluetooth_sensores.ts  ← Bloques Bluetooth BLE UART (FisicaBit BT — azul)
├── shims.d.ts             ← Declaraciones: puente TypeScript ↔ C++
├── shims.cpp              ← Código nativo C++: acceso directo al hardware nRF52833
├── asm_sensors.S          ← Ensamblador ARM: rutinas de máximo rendimiento
├── test.ts                ← 12 ejemplos completos con diagramas de cableado
├── icon.png               ← Ícono de la extensión (rayo + onda)
└── README.md              ← Esta documentación
```

## Arquitectura de capas

```
┌──────────────────────────────────────────────┐
│  MakeCode (Bloques / TypeScript)             │
│  └─► fisicabit.ts                            │
│      Velocidad: ~500μs por lectura ADC       │
├──────────────────────────────────────────────┤
│  C++ Nativo (Shims)                          │
│  └─► shims.cpp                               │
│      Velocidad: ~5μs por lectura ADC         │
├──────────────────────────────────────────────┤
│  Ensamblador ARM (Thumb-2)                   │
│  └─► asm_sensors.S                           │
│      Velocidad: ~2μs por lectura ADC         │
└──────────────────────────────────────────────┘
```

## Bloques disponibles

### Sensores Internos
| Bloque | Descripción |
|--------|-------------|
| `leer sensor interno [Temperatura]` | Lee sensores integrados del micro:bit |

### Sensores Externos
| Bloque | Descripción |
|--------|-------------|
| `leer sensor analógico en [P0]` | Lee potenciómetro, LDR, NTC (0-1023) |
| `leer sensor digital en P[8]` | Lee PIR, infrarrojo, interruptor (0/1) |
| `distancia ultrasónica TRIG P1 ECHO P2 en [cm]` | Mide distancia con HC-SR04 |

### Conversiones
| Bloque | Descripción |
|--------|-------------|
| `convertir [23] de [°C] a [°F]` | Convierte temperatura entre unidades |
| `mapear [512] de (0—1023) a (0—100)` | Escala valores a otro rango |

### Nativo C++ (Avanzado)
| Bloque | Descripción |
|--------|-------------|
| `[C++] leer ADC nativo canal [0]` | ADC de 12 bits directo (0-4095) |
| `[C++] leer ADC promedio canal [0] muestras [16]` | Sobremuestreo para reducir ruido |
| `[C++] medir pulso pin P[2] nivel [HIGH] timeout [25000] μs` | Timing de alta precisión |

## Pines del micro:bit — Referencia rápida

```
Pines analógicos (ADC):  P0, P1, P2
Pines digitales libres:  P8, P12, P16
Bus I2C:                 P19 (SCL), P20 (SDA)
Bus SPI:                 P13 (SCK), P14 (MISO), P15 (MOSI)
⚠ Compartidos con LEDs:  P3, P4, P5, P6, P7, P9, P10, P11
```

## Ejemplos incluidos (test.ts)

1. **Estación meteorológica** — Temperatura con botones A/B
2. **Monitor serie** — Todos los sensores internos por USB
3. **Medidor de distancia** — HC-SR04 ultrasónico
4. **Control con potenciómetro** — Lectura analógica + mapeo
5. **Medidor de luz (LDR)** — Sensor resistivo + umbrales
6. **Detector de movimiento (PIR)** — Sensor digital + alarma
7. **Lectura nativa C++** — Comparación 10 bits vs 12 bits
8. **Termómetro NTC** — Termistor analógico + aproximación

## Cómo agregar un sensor nuevo

### Paso 1: Agregar al enum (enums.d.ts)
```typescript
declare const enum TipoSensorExterno {
    // ... sensores existentes ...
    //% block="Mi Nuevo Sensor"
    MiSensor = 8
}
```

### Paso 2: Agregar bloque TypeScript (fisicabit.ts)
```typescript
//% block="leer mi sensor en pin %pin"
//% group="Sensores Externos"
export function leerMiSensor(pin: DigitalPin): number {
    // Implementación del sensor
    return pins.digitalReadPin(pin)
}
```

### Paso 3 (opcional): Agregar implementación C++ (shims.cpp)
```cpp
//%
int leerMiSensorNativo(int pin) {
    // Acceso directo al hardware para más velocidad
    return NRF_P0->IN & (1 << pin) ? 1 : 0;
}
```

## Cómo conectar con el puente C++ (Shims)

El mecanismo shim conecta TypeScript con C++ en 3 pasos:

```
fisicabit.ts                 shims.d.ts                  shims.cpp
─────────────                ──────────                  ─────────
//% shim=ns::fn    ←link→    //% shim=ns::fn   ←link→   //%
export function fn()         function fn()               int fn()
  return fallback              (declaración)              { código C++ }
  (solo simulador)
```

## Hardware: micro:bit v2 (nRF52833)

| Característica | Especificación |
|---|---|
| CPU | ARM Cortex-M4F @ 64MHz |
| RAM | 128KB |
| Flash | 512KB |
| ADC | SAADC 12 bits, 8 canales |
| GPIO | 48 pines |
| Radio | Bluetooth 5.0 |

## Bluetooth — Envío inalámbrico de datos

La extensión incluye bloques para enviar datos de sensores por **Bluetooth Low Energy (BLE)** usando el servicio UART (Nordic UART Service). Los datos se reciben en [fisicasimple.com](https://fisicasimple.com) en tiempo real.

### Compatibilidad Bluetooth

| Plataforma | Navegador | Funciona |
|---|---|---|
| Windows / macOS / Linux | Chrome, Edge | ✅ |
| Android | Chrome | ✅ |
| iOS / iPadOS | Safari | ❌ (Apple no soporta Web Bluetooth) |

### Configuración obligatoria para Bluetooth

#### Paso 1: Habilitar "No Pairing Required"

En tu programa MakeCode, abrí **⚙ → Project Settings** y activá **"No Pairing Required: JustWorks pairing"**. Esto permite la conexión sin PIN.

#### Paso 2: Verificar pxt.json

En el archivo `pxt.json` la sección `bluetooth` debe tener estos valores:

```json
"bluetooth": {
    "open": 1,
    "pairing_mode": 0,
    "whitelist": 0,
    "security_level": null
}
```

#### Paso 3: Saber que Bluetooth reemplaza Radio y Serial USB

> ⚠ **Importante:** Al agregar Bluetooth se desactiva automáticamente la extensión Radio y el serial USB. Para volver a usar USB, eliminá la extensión Bluetooth y agregá serial.

### Bloques Bluetooth disponibles

#### Conexión
| Bloque | Descripción |
|--------|-------------|
| `iniciar Bluetooth UART` | Inicia el servicio UART (llamar en "al iniciar") |
| `iniciar Bluetooth UART con todos los servicios` | UART + acelerómetro + temperatura + brújula + botones + LED + I/O |
| `configurar indicador de conexión BT` | Muestra ❤ al conectar y ✕ al desconectar |

#### Envío de datos manual
| Bloque | Descripción |
|--------|-------------|
| `enviar por BT valor [valor]` | Envía timestamp,valor |
| `enviar por BT valores [v1] y [v2]` | Envía timestamp,valor1,valor2 |
| `enviar por BT valores [v1], [v2] y [v3]` | Envía timestamp,valor1,valor2,valor3 |
| `enviar por BT sensor [Temperatura]` | Lee y envía un sensor con timestamp |
| `enviar por BT texto [texto]` | Envía texto libre |

#### Envío continuo (automático)
| Bloque | Descripción |
|--------|-------------|
| `configurar velocidad de muestreo [normal 100ms]` | Velocidad predefinida |
| `configurar muestreo cada [ms] ms` | Velocidad personalizada |
| `iniciar envío continuo de [sensor]` | Envía 1 variable continuamente |
| `iniciar envío continuo de [s1] y [s2]` | Envía 2 variables continuamente |
| `iniciar envío continuo de [s1], [s2] y [s3]` | Envía 3 variables continuamente |
| `detener envío continuo` | Detiene el envío |
| `envío BT activo` | Devuelve verdadero si está enviando |

### Formato de datos

Cada línea enviada tiene el formato CSV:
```
timestamp,valor1,valor2,...
```
- El **timestamp** es `input.runningTime()` en milisegundos
- Los valores se separan con coma
- En fisicasimple.com, activar **"Micro:bit envía timestamp"**

### Sensores disponibles para Bluetooth

- Acelerómetro X, Y, Z
- Temperatura
- Nivel de Luz
- Brújula (heading)
- Nivel Sonido (micro:bit v2)
- Fuerza G (magnitud del acelerómetro)
- Analógico P0, P1, P2 (sensores externos conectados a pines)

### Ejemplos de uso Bluetooth

#### 1 variable — Temperatura
```typescript
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()
FisicaBitBT.configurarVelocidad(VelocidadMuestreo.MuyLento)
FisicaBitBT.iniciarEnvio1Sensor(SensorBT.Temperatura)
```

#### 2 variables — Acelerómetro X e Y
```typescript
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()
FisicaBitBT.configurarVelocidadMs(50)
FisicaBitBT.iniciarEnvio2Sensores(SensorBT.AcelerometroX, SensorBT.AcelerometroY)
```

#### 3 variables — Acelerómetro completo
```typescript
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()
FisicaBitBT.configurarVelocidad(VelocidadMuestreo.MuyRapido)
FisicaBitBT.iniciarEnvio3Sensores(SensorBT.AcelerometroX, SensorBT.AcelerometroY, SensorBT.AcelerometroZ)
```

#### Envío manual en un loop personalizado
```typescript
FisicaBitBT.iniciarUART()
FisicaBitBT.configurarIndicadorConexion()

basic.forever(function () {
    let temp = input.temperature()
    let luz = input.lightLevel()
    FisicaBitBT.enviar2Valores(temp, luz)
    basic.pause(200)
})
```

### Conectar desde fisicasimple.com

1. Abrir [fisicasimple.com](https://fisicasimple.com) en **Chrome** o **Edge**
2. Presionar el botón **BLUETOOTH** (azul)
3. En el selector del navegador, elegir tu micro:bit (aparece como `BBC micro:bit [XXXXX]`)
4. Esperar a que se conecte — el botón cambia a "BLUETOOTH CONECTADO"
5. Presionar **CAPTURAR** para iniciar la toma de datos

> **Reconexión automática:** Si la micro:bit se desconecta (por ejemplo, al alejarse), la app intenta reconectarse automáticamente hasta 4 veces.

### Solución de problemas Bluetooth

| Problema | Solución |
|----------|----------|
| No aparece en el selector | Verificar que el programa tenga `iniciar Bluetooth UART`. Reiniciar la micro:bit. Verificar que no esté conectada a otro dispositivo. |
| Se conecta pero no llegan datos | Verificar que uses bloques de envío. Presionar CAPTURAR después de conectar. Verificar que "Micro:bit envía timestamp" coincida con el formato. |
| Error "UART no encontrado" | El programa no tiene `iniciar Bluetooth UART`. Recompilar y descargar. |
| Error "Not supported" en notificaciones | Cache BLE corrupto. Ir a `chrome://bluetooth-internals`, olvidar el dispositivo y reconectar. En macOS: también eliminar desde Preferencias del Sistema > Bluetooth. |
| Se desconecta frecuentemente | Acercar la micro:bit (rango BLE ~10m). Verificar batería. La app reconecta automáticamente. |
| No funciona en iPhone/iPad | Apple no soporta Web Bluetooth en Safari/iOS. Usar Chrome en Android o computadora. |

### Servicios BLE adicionales (avanzado)

Además del UART, se pueden habilitar servicios BLE individuales para lectura directa:

```typescript
FisicaBitBT.iniciarServicioAcelerometro()
FisicaBitBT.iniciarServicioTemperatura()
FisicaBitBT.iniciarServicioMagnetometro()
FisicaBitBT.iniciarServicioBotones()
FisicaBitBT.iniciarServicioLED()
FisicaBitBT.iniciarServicioIO()
```

El UART es el método principal y recomendado para captura de datos.

---

## Licencia

MIT — Libre para uso educativo y comercial.

## Metadatos (MakeCode)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
