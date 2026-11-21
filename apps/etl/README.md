# ETL de la muestra

`@team27/etl` es la única pieza simulada de la muestra: los conectores y las personas que no tomaron su asiento. La API no sabe que existe una demo. Recibe revisiones de documentos por una puerta genérica (`POST /api/revisions`), igual que las recibiría de un conector real, y el ETL se las entrega como un cliente más, con la clave del presentador y `x-act-as` del dueño de cada documento.

Hace tres cosas:

1. **Conectores.** Lee archivos del lago ficticio (`lago/`), extrae los hechos con un parser determinista por tipo de documento y los carga a la API.
2. **Guion.** Ordena la carga: una carga inicial con los nueve documentos que ya existían y ocho pasos que cambian la obra.
3. **Jugadores simulados.** Mira los eventos y las propuestas, y vota por los revisores cuyo asiento no tiene una persona, con los retardos y las notas del guion.

No tiene servidor ni dependencias nuevas: Node 24 ejecuta el TypeScript quitando los tipos (`node src/main.ts`), por eso usa solo sintaxis borrable y `fetch`, `readline`, `crypto` y `fs` de Node.

## Cómo correrlo

Con la API arriba (`pnpm dev:api`) y, si quieres ver el telón y los celulares, la web (`pnpm dev:web`):

```bash
pnpm etl                       # interactivo
pnpm etl auto --velocidad 2    # todo el guion, sin pausas
pnpm etl reiniciar             # reinicia la sala y hace la carga inicial
pnpm etl paso s3               # un paso suelto
pnpm etl estado                # cómo va la sala
```

| Variable        | Por defecto             | Qué es                              |
| --------------- | ----------------------- | ----------------------------------- |
| `API_URL`       | `http://localhost:3001` | Dónde está la API                   |
| `PRESENTER_KEY` | `sala-los-aromos`       | La clave de presentador de la sala  |

`pnpm etl` toma el `.env` de la raíz. Si la API no responde, o rechaza la clave, el ETL lo dice y sale con código 1.

### Modo interactivo

Si el lago está vacío, hace la carga inicial. Después muestra el paso siguiente y espera:

| Tecla   | Qué hace                                      |
| ------- | --------------------------------------------- |
| `Enter` | Carga el paso siguiente                       |
| `a`     | Automático desde aquí hasta el final          |
| `r`     | Reinicia la sala y repite la carga inicial    |
| `o`     | Reabre las propuestas en disputa              |
| `q`     | Sale                                          |

Cada paso imprime lo que extrajo (archivo, documento, revisión y cuántos hechos), el resultado de la carga y los eventos en vivo hasta que no queda una propuesta abierta:

```text
Paso s1 · Llega el plano E-102 rev C
  Extraje drive-proyecto/E-102_revC.json: e102 rev C, 5 hechos.
  Propuesta: Losa nivel 3 · Espesor: 15 cm → 20 cm · 4 de 7 avisados · +$3.636.500 · +1 día
  · Paula Rojas tiene un problema con …
  Paula Rojas disputó: «Necesito 2 días …» — [o] reabrir
```

Mientras espera una propuesta, `Enter` deja de esperar y sigue, `o` reabre una disputa y `q` sale. Otros resultados posibles de la carga: `Discrepancia para Fernanda Lagos: …`, `Respaldo: …` y `Desfasados: …`.

Al terminar todo el guion, sin personas en los asientos, la sala queda en «Obra consensuada»:

- losa: +$3.636.500, +1 día, 4 revisores;
- ventanas: +$1.998.000, 4 revisores, Marcos filtrado por sus 38 días de holgura;
- shaft: 3 revisores, sin costo ni atraso.

### Una demo

1. `pnpm db:up`, `pnpm db:migrate` y `pnpm dev`.
2. En otra terminal, `pnpm etl`: carga el lago y queda esperando.
3. Abre `/sala` (telón) y `/presentador`. Los invitados toman asientos desde su celular; los asientos vacíos los juega el ETL.
4. `Enter` en cada paso. Si Paula o Javier disputan, `o` (o el botón de `/presentador`) reabre y aprueban.
5. Para repetir: `r`.

Un asiento con una persona (latido de menos de 20 s) es suyo: la API responde 409 `seat_held` y el ETL no vota por ella. Si Fernanda la juega una persona, el ETL tampoco sube documentos ni reabre por ella.

## El lago

`lago/` es el repositorio ficticio de donde leen los conectores: una carpeta por espacio, con archivos de una obra chilena (Edificio Los Aromos, Ñuñoa). Cada carpeta tiene un `origen.json` que dice, por archivo, de dónde vino en el sistema real (`pointer`) y de qué tipo es (`tipo`).

| Carpeta           | Espacio (`spaceId`) | Archivos                                                                                                                         |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `drive-proyecto`  | `drive-proyecto`    | Planos `E-102` (rev B, C) y `A-201` (rev B, C, D) en JSON con cuadro de rotulación; `EETT-03` (rev A, B) en `.md`; `Acta_12.txt` |
| `carpeta-costos`  | `carpeta-costos`    | `Presupuesto_itemizado` (v2, v3) y `Carta_Gantt` (v4, v5) en `.csv`                                                              |
| `correo-quillay`  | `correo-quillay`    | Cotización `Q-118` (rev 1, 2) en `.csv`                                                                                          |
| `whatsapp-obra`   | `whatsapp-obra`     | Exportaciones del chat: `mensaje-1.txt` y `mensaje-2.txt`                                                                        |
| `libro-de-obra`   | `libro-obra`        | Folios 41 y 44 en `.txt`                                                                                                         |

Son 18 archivos: las nueve revisiones de la carga inicial y las nueve del guion.

## Extract, transform, load

```text
lago/ → extract → transform → load → POST /api/revisions
```

- **Extract** (`src/extract`): recorre las carpetas, lee cada archivo con su `origen.json` y calcula su sha256 (`contentHash`).
- **Transform** (`src/transform`): un parser por tipo, sin azar ni modelos de lenguaje. Mapea nombres a sujetos con el vocabulario (`src/vocabulary.ts`: «Losa nivel 3» es `losa-n3`, «ventanas del norte» es `ventanas-norte`, las partidas van por código) y devuelve una revisión con `documentId`, `label`, `spaceId`, autor, `pointer` y sus hechos (sujeto, atributo, valor, unidad, rol `afirma` o `usa`, localizador).
- **Load** (`src/load`): cliente HTTP de la API.

| Tipo          | Parser            | De dónde saca los hechos                                                                                           | Localizador                                  |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `plano`       | `plano.ts`        | Rótulo (documento, revisión, autor) y cuadros: losas, vanos, detalle del shaft                                     | Título del cuadro y el elemento              |
| `eett`        | `eett.ts`         | Encabezado y la tabla de espesores de la sección 3.2                                                               | `§3.2 · Losa nivel 3` (con `rev B` si la marca) |
| `presupuesto` | `presupuesto.ts`  | Columna de precio unitario (afirma) y «Dimensión de diseño usada» (usa)                                            | Celda: `Partidas!C14`                        |
| `gantt`       | `gantt.ts`        | Fila «Entrega final» (afirma) y la columna «Supuesto de diseño» (usa)                                              | Celda: `Carta!H48`                           |
| `cotizacion`  | `cotizacion.ts`   | Tabla de precios (afirma) y medidas por ítem: fabricación (afirma) y según plano (usa)                             | `tabla de precios`, `ítem 1 · medidas`       |
| `acta`        | `acta.ts`         | El acuerdo que fija el plazo de entrega                                                                            | `acuerdo 4`                                  |
| `whatsapp`    | `whatsapp.ts`     | Cada mensaje de la exportación; la etiqueta cuenta los mensajes y el autor es quien escribió el último              | `mensaje de las 14:32: «…»`                  |
| `libro`       | `libro.ts`        | El texto del folio: un replanteo (solo el folio) o una decisión de obra (el folio y la cita)                       | `folio 41`, `folio 44: «…»`                  |

Un archivo mal formado falla con su nombre y el motivo. Lo que el vocabulario no conoce (otras partidas, otras columnas) se ignora.

### Prueba de oro

`tests/golden-catalog.json` es la foto de lo que el catálogo de la API producía antes de que la simulación saliera de ella. `tests/golden.spec.ts` exige que, para cada revisión sembrada y cada fixture, el parser de su archivo dé exactamente el mismo `documentId`, `label`, `spaceId`, autor, `pointer` y la misma lista de hechos, en el mismo orden. También verifica que el guion repite las escenas, la cadena y los requisitos de esa foto.

### Llamadas a la API

Todas llevan `x-presenter-key`.

| Llamada                                     | Cuándo                                    | Cabeceras y cuerpo                                                                                                    |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/lake/seed`                       | Carga inicial (lago vacío)                | `{ revisions: [{ documentId, label, spaceId, pointer, contentHash, claims, authorId }] }`                             |
| `POST /api/revisions`                       | Cada revisión de un paso                  | `x-act-as: <dueño>`, `x-action-id: <hash de documento y etiqueta>`; `{ documentId, label, spaceId, pointer, contentHash, claims }` |
| `POST /api/notifications/:id/response`      | Voto de un jugador simulado               | `x-act-as: <revisor>`, `x-action-id`; `{ kind: 'reviewed' \| 'issue', note }`                                         |
| `POST /api/proposals/:id/reopen`            | Reabrir (sin `x-act-as`: actúa Fernanda)  | —                                                                                                                     |
| `POST /api/room/reset`                      | `r` y `reiniciar`                         | —                                                                                                                     |
| `GET /api/room`, `/spaces`, `/proposals`    | Estado, requisitos y votos pendientes     | —                                                                                                                     |
| `GET /api/events?after&epoch&limit=200`     | Eventos en vivo, época y reaperturas       | —                                                                                                                     |

Un 409 `already_ingested` se cuenta como «ya estaba cargado». Un 409 `seat_held` significa que ese asiento es de una persona.

## El guion

`src/guion.ts`. El paso 0 es la carga inicial: los nueve documentos que ya existían, confirmados como lo vigente.

| Paso | Qué pasa                              | Archivos                                                        | Antes necesita   |
| ---- | ------------------------------------- | --------------------------------------------------------------- | ---------------- |
| `s1` | Llega el plano E-102 rev C            | `drive-proyecto/E-102_revC.json`                                | —                |
| `s2` | Daniela corrige el presupuesto        | `carpeta-costos/Presupuesto_itemizado_v3.csv`                   | E-102 rev C      |
| `s3` | Marcos avisa por WhatsApp             | `whatsapp-obra/mensaje-2.txt`                                   | —                |
| `s4` | Llega el plano A-201 rev C            | `drive-proyecto/A-201_revC.json`                                | —                |
| `x1` | Decisión en el libro de obra          | `libro-de-obra/folio-44.txt`                                    | —                |
| `x2` | Llega el plano A-201 rev D            | `drive-proyecto/A-201_revD.json`                                | A-201 rev C      |
| `s5` | Quillay vuelve a cotizar              | `correo-quillay/Q-118_rev2.csv`                                 | A-201 rev C      |
| `s6` | Cierre: los demás se ponen al día     | `carpeta-costos/Carta_Gantt_v5.csv`, `drive-proyecto/EETT-03_revB.md` | E-102 rev C |

El orden de la tabla es el del modo automático. El ETL lo hace cumplir: consulta `GET /api/spaces` y no carga un paso cuyo requisito no esté en la sala. La API ya no exige ese orden.

## Los jugadores simulados

`src/players`. Las decisiones están en funciones puras con pruebas (`plan.ts`: qué votar y cuándo); el bucle que habla con la API está en `players.ts`.

- **Qué mira:** `GET /api/events` (cursor y época; cuenta las reaperturas de cada propuesta) y `GET /api/proposals` (por revisor, `notificationId` y `decision`). Con `GET /api/room` sabe qué asientos tienen una persona.
- **Cuándo vota:** por cada revisor pendiente cuyo asiento no tiene una persona, a los `retardo / velocidad` del asiento: Paula 2,5 s, Daniela 3 s, Marcos 3,5 s, Javier 4 s, Quillay 4,5 s, Camila 5 s, Tomás 6 s. Cada uno aprueba con su nota.
- **Las disputas:** en la primera ronda Paula disputa la losa del nivel 3 y Javier el shaft. Después de reabrir, aprueban a los 3 s.
- **Reabrir:** en modo automático, Fernanda reabre a los 4 s. En modo interactivo el ETL avisa «Paula disputó: … — [o] reabrir» y espera; el presentador también puede reabrir desde `/presentador`.
- **Personas primero:** si la API responde `seat_held`, el ETL no insiste: ese voto es de la persona.
- **Velocidad:** `--velocidad 1|2|4` divide todos los retardos y la pausa de 3 s entre pasos.

## Estructura

```text
apps/etl/
  lago/                 los archivos de origen, por espacio, con su origen.json
  src/
    main.ts             el CLI
    config.ts           API_URL y PRESENTER_KEY
    guion.ts            la carga inicial y los pasos
    pipeline.ts         extract + transform del lago entero
    vocabulary.ts       sujetos, personas, documentos, atributos y formatos de número
    extract/            lectura del lago y sha256
    transform/          un parser por tipo
    load/               cliente HTTP de la API y x-action-id
    players/            plan.ts (puro) y players.ts (E/S)
    cli/                argumentos, sesión, formato y entrada de teclado
  tests/                Vitest, incluida la prueba de oro
```

Tags de Nx: `type:app` y `scope:etl`. No importa contextos ni `data/main`: habla con la API solo por HTTP.
