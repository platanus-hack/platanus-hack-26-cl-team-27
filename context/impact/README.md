# @team27/context-impact

Decide a quién afecta un cambio y cuánto. `AnalyzeChange` cruza el cambio con el grafo del proyecto (`ProjectGraph`) y devuelve un `Impact`: costo, atraso, partidas y tareas que cambian, un hallazgo (`Finding`) por afectado y los que se dejaron fuera a propósito (`filtered`), con su razón.

## Reglas

- **Cantidades por tipo de elemento** (`QUANTITIES`):

  | Tipo      | Cantidad               | Fórmula                                |
  | --------- | ---------------------- | -------------------------------------- |
  | `losa`    | `volumen` (m³)         | área × espesor                         |
  | `losa`    | `peso_propio` (kN/m²)  | espesor × 25 kN/m³                     |
  | `ventana` | `superficie` (m²)      | cantidad × ancho × alto                |
  | `shaft`   | `perforacion` (m²)     | ancho × largo                          |

- **Dependencias.** Una `Dependency` dice que un afectado vigila ciertas propiedades de un tipo de elemento. Si alguna cambia, recibe un hallazgo con su texto y su acción (`{elemento}` se reemplaza por el nombre del elemento), más las cantidades que pide (`measures`), con antes, después y diferencia.
- **Costo.** Por cada partida del tipo de elemento: (cantidad después − cantidad antes) × `factor` × precio unitario. Si el total no es cero, quien lleva el presupuesto (`costOwnerId`) recibe un hallazgo con cada línea.
- **Plazo.** Las tareas con `driver` en el elemento duran cantidad ÷ rendimiento, redondeado hacia arriba a días enteros, con mínimo 1; las demás conservan sus `days`. `criticalPath` calcula el plazo y la holgura antes y después.
  - Si la entrega se mueve, quien lleva el plazo (`scheduleOwnerId`) recibe un hallazgo.
  - Si la holgura lo absorbe, no se le avisa y la razón queda en `filtered`.
- **Formato.** Los números van en español de Chile: `3,75`, `$3.636.500`, `1 día` y `4 días`.

## Casos de uso y adapters

| Caso de uso     | Qué hace                                         |
| --------------- | ------------------------------------------------ |
| `AnalyzeChange` | Analiza un cambio contra el grafo y guarda el impacto |
| `GetImpacts`    | Los impactos de varios cambios                   |

- `InMemoryProjectGraph`: el grafo que le pasa la API, sacado del guion de la muestra.
- `PrismaImpactRepository`: la tabla `impacts`, con el detalle en JSON.
