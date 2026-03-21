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
├── pxt.json          ← Manifiesto: dependencias, archivos, metadatos
├── enums.d.ts        ← Enumeraciones (tipos de sensor, unidades, pines)
├── fisicabit.ts      ← Extensión principal: bloques MakeCode en TypeScript
├── shims.d.ts        ← Declaraciones: puente TypeScript ↔ C++
├── shims.cpp         ← Código nativo C++: acceso directo al hardware nRF52833
├── asm_sensors.S     ← Ensamblador ARM: rutinas de máximo rendimiento
├── test.ts           ← 8 ejemplos completos con diagramas de cableado
└── README.md         ← Esta documentación
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

## Licencia

MIT — Libre para uso educativo y comercial.

## Metadatos (MakeCode)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script>
<script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
