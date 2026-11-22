# ETL de la muestra

`@team27/etl` es la única pieza simulada de la muestra: los conectores y las personas que no tomaron su asiento. La API no sabe que existe una demo. Recibe revisiones de documentos por una puerta genérica (`POST /api/revisions`), igual que las recibiría de un conector real, y el ETL se las entrega como un cliente más, con la clave del presentador y `x-act-as` del dueño de cada documento.

Hace tres cosas:

1. **Conectores.** Lee archivos del lago ficticio (`lago/`), extrae los hechos con un parser determinista por tipo de documento y los carga a la API.
2. **Guion.** Ordena la carga: una carga inicial con los diez documentos que ya existían y nueve pasos que cambian la obra.
3. **Jugadores simulados.** Mira los eventos, los PR y los solapamientos, y vota por los revisores y validadores cuyo asiento no tiene una persona, con los retardos y las notas del guion.

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

Cada revisión es un PR contra lo vigente. Cada paso imprime lo que extrajo (archivo, documento, revisión y cuántos hechos o fragmentos de texto), el PR con sus cambios, el resultado de la carga y los eventos en vivo hasta que no queda un PR abierto ni un solapamiento por validar:

```text
Paso s1 · Llega el plano E-102 rev C
  Extraje drive-proyecto/E-102_revC.json: e102 rev C, 5 hechos.
  PR · E-102 rev C (Fernanda) · 1 cambio, 4 sin cambio · 4 de 7 avisados · +$3.636.500 · +1 día
    losa N3, espesor: 15 cm → 20 cm · cuadro de losas rev C · Losa nivel 3
  · Paula Rojas tiene un problema con …
  Paula Rojas disputó: «Necesito 2 días …» — [o] reabrir
```

Los solapamientos se imprimen al detectarse y al cambiar de estado:

```text
Solapamiento: Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias
· Javier Muñoz votó que se tocan: «El shaft a 8,5 m cruza el colector B2 en el nivel 3»
Solapamiento confirmado: Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias — «El shaft a 8,5 m cruza el colector B2 en el nivel 3»
Solapamiento resuelto: Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev B) · nivel 3 · D-E/3 · sanitarias
```

Un paso se da por asentado cuando no queda un PR abierto ni un solapamiento abierto o confirmado. Una excepción: si todavía faltan pasos posteriores, un solapamiento confirmado, y el PR que ya tiene todas sus aprobaciones y espera por él, no retienen el paso. Así `x2` termina con el solapamiento confirmado y lo resuelve `x3`.

Mientras espera una propuesta, `Enter` deja de esperar y sigue, `o` reabre una disputa y `q` sale. Otros resultados posibles de la carga: `Discrepancia para Fernanda Lagos: …`, `Respaldo: …` y `Desfasados: …`.

Al terminar todo el guion, sin personas en los asientos, la sala queda en «Obra consensuada»:

- losa: +$3.636.500, +1 día, 4 revisores;
- ventanas: +$1.998.000, 4 revisores, Marcos filtrado por sus 38 días de holgura;
- shaft: 3 revisores, sin costo ni atraso, fusionado cuando `x3` mueve el colector;
- colector B2: a 13,5 m, sin revisores.

### Una demo

1. `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed` y `pnpm dev`.
2. En otra terminal, `pnpm etl`: carga el lago y queda esperando.
3. Abre `/sala` (telón) y `/presentador`. Los invitados toman asientos desde su celular; los asientos vacíos los juega el ETL.
4. `Enter` en cada paso. Si Paula disputa, `o` (o el botón de `/presentador`) reabre y aprueba.
5. Para repetir: `r`.

Un asiento con una persona (latido de menos de 20 s) es suyo: la API responde 409 `seat_held` y el ETL no vota por ella. Si Fernanda la juega una persona, el ETL tampoco sube documentos ni reabre por ella.

## El lago

`lago/` es el repositorio ficticio de donde leen los conectores: una carpeta por espacio, con archivos de una obra chilena (Edificio Los Aromos, Ñuñoa). Cada carpeta tiene un `origen.json` que dice, por archivo, de dónde vino en el sistema real (`pointer`) y de qué tipo es (`tipo`).

| Carpeta           | Espacio (`spaceId`) | Archivos                                                                                                                         |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `drive-proyecto`  | `drive-proyecto`    | Planos `E-102` (rev B, C), `A-201` (rev B, C, D) e `IS-301` (rev A, B) en JSON con cuadro de rotulación; `EETT-03` (rev A, B) en `.md`; `Acta_12.txt` |
| `carpeta-costos`  | `carpeta-costos`    | `Presupuesto_itemizado` (v2, v3) y `Carta_Gantt` (v4, v5) en `.csv`                                                              |
| `correo-quillay`  | `correo-quillay`    | Cotización `Q-118` (rev 1, 2) en `.csv`                                                                                          |
| `whatsapp-obra`   | `whatsapp-obra`     | Exportaciones del chat: `mensaje-1.txt` y `mensaje-2.txt`                                                                        |
| `libro-de-obra`   | `libro-obra`        | Folios 41 y 44 en `.txt`                                                                                                         |

Son 20 archivos: las diez revisiones de la carga inicial y las diez del guion.

## Extract, transform, load

```text
lago/ → extract → transform → load → POST /api/revisions
```

- **Extract** (`src/extract`): recorre las carpetas, lee cada archivo con su `origen.json` y calcula su sha256 (`contentHash`).
- **Transform** (`src/transform`): un parser por tipo, sin azar ni modelos de lenguaje. Mapea nombres a sujetos con el vocabulario (`src/vocabulary.ts`: «Losa nivel 3» es `losa-n3`, «ventanas del norte» es `ventanas-norte`, «Colector B2» es `colector-b2`, las partidas van por código) y devuelve una revisión con `documentId`, `label`, `spaceId`, autor, `pointer` y sus **fragmentos** (`chunks`).
- **Load** (`src/load`): cliente HTTP de la API.

### Fragmentos

Una revisión viaja como `chunks: [{ locator, kind, text?, claims? }]`. El localizador de un fragmento es el que usaban sus hechos, y los hechos lo heredan.

- **Estructurados** (planos, EETT, presupuesto, Gantt, cotización): un fragmento `fila` por fila de cuadro o de planilla, con sus hechos ya extraídos (sujeto, atributo, valor, unidad, rol `afirma` o `usa`, localizador). Las filas que comparten localizador, como la tabla de precios de la cotización, van en un solo fragmento.
- **Texto libre** (WhatsApp, libro de obra, acta): un fragmento de texto por mensaje (`mensaje`), folio (`anotacion`) o acuerdo (`acuerdo`), con `text` y **sin `claims`**. El ETL no extrae nada de ellos: la API los lee con `context/impact`. Con `ANTHROPIC_API_KEY` en el `.env` de la raíz, los lee Claude, y la primera lectura queda grabada. Si la clave está vacía, como en `.env.example`, la lectura es determinista: usa respuestas fijas y grabadas, sin red. Lo que esas respuestas deben devolver está en `tests/free-text-claims.json`.

| Tipo          | Parser            | De dónde saca los hechos                                                                                           | Localizador                                  |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `plano`       | `plano.ts`        | Rótulo (documento, revisión, autor) y cuadros: losas, vanos, detalle del shaft, colectores                         | Título del cuadro y el elemento              |
| `eett`        | `eett.ts`         | Encabezado y la tabla de espesores de la sección 3.2                                                               | `§3.2 · Losa nivel 3` (con `rev B` si la marca) |
| `presupuesto` | `presupuesto.ts`  | Columna de precio unitario (afirma) y «Dimensión de diseño usada» (usa)                                            | Celda: `Partidas!C14`                        |
| `gantt`       | `gantt.ts`        | Fila «Entrega final» (afirma) y la columna «Supuesto de diseño» (usa)                                              | Celda: `Carta!H48`                           |
| `cotizacion`  | `cotizacion.ts`   | Tabla de precios (afirma) y medidas por ítem: fabricación (afirma) y según plano (usa)                             | `tabla de precios`, `ítem 1 · medidas`       |
| `acta`        | `acta.ts`         | Un fragmento de texto por acuerdo                                                                                  | `acuerdo 4`                                  |
| `whatsapp`    | `whatsapp.ts`     | Un fragmento de texto por mensaje de la exportación; la etiqueta cuenta los mensajes y el autor es quien escribió el último | `mensaje de las 14:32`                |
| `libro`       | `libro.ts`        | El texto del folio, como un fragmento                                                                              | `folio 41`, `folio 44`                       |

Un archivo mal formado falla con su nombre y el motivo. Lo que el vocabulario no conoce (otras partidas, otras columnas) se ignora.

### Prueba de oro

`tests/golden-catalog.json` es la foto de lo que el catálogo de la API producía antes de que la simulación saliera de ella. `tests/golden.spec.ts` exige, para cada revisión sembrada y cada fixture:

- **Documentos estructurados:** los fragmentos dan exactamente la misma lista de hechos de la foto, en el mismo orden, con el mismo `documentId`, `label`, `spaceId`, autor y `pointer`.
- **Documentos de texto libre:** los fragmentos no llevan hechos. La prueba verifica sus textos y localizadores (los mensajes del chat, los folios 41 y 44, los cinco acuerdos del acta) y que los hechos esperados de `tests/free-text-claims.json` coincidan con los de la foto, salvo el localizador.

También verifica que el guion repite las escenas, la cadena y los requisitos de la foto, con los cambios de la muestra: la carga inicial suma `IS-301 rev A`, `x2` amplía su descripción y `x3` entra después de `x2`.

**Hechos esperados de los textos libres** (`tests/free-text-claims.json`), para cotejar con las respuestas fijas de inferencia de la API. El localizador es el del fragmento; todos son `afirma`:

| Documento              | Fragmento              | Sujeto · atributo                | Valor      |
| ---------------------- | ---------------------- | -------------------------------- | ---------- |
| `whatsapp` mensaje 1   | `mensaje de las 08:05` | ninguno                          | —          |
| `whatsapp` mensaje 2   | `mensaje de las 14:32` | `ventanas-norte` · `ancho_cm`    | 150 cm     |
| `libro` folio 41       | `folio 41`             | `shaft-s1` · `posicion_m`        | 6 m        |
| `libro` folio 44       | `folio 44`             | `shaft-s1` · `posicion_m`        | 8,5 m      |
| `acta` N° 12           | `acuerdo 4`            | `proyecto` · `entrega_dias`      | 108 días   |

El resto de los fragmentos de texto no produce hechos: el mensaje de las 08:05 (sin dato), los folios sin otra cifra y los acuerdos 1, 2, 3 y 5 del acta.

### Llamadas a la API

Todas llevan `x-presenter-key`.

| Llamada                                     | Cuándo                                    | Cabeceras y cuerpo                                                                                                    |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/lake/seed`                       | Carga inicial (lago vacío)                | `{ revisions: [{ documentId, label, spaceId, pointer, contentHash, chunks, authorId }] }`                             |
| `POST /api/revisions`                       | Cada revisión de un paso                  | `x-act-as: <dueño>`, `x-action-id: <hash de documento y etiqueta>`; `{ documentId, label, spaceId, pointer, contentHash, chunks }` |
| `POST /api/notifications/:id/response`      | Voto de un jugador simulado               | `x-act-as: <revisor>`, `x-action-id`; `{ kind: 'reviewed' \| 'issue', note }`                                         |
| `POST /api/overlaps/:id/vote`               | Voto de un validador simulado             | `x-act-as: <validador>`, `x-action-id`; `{ kind: 'se_tocan' \| 'no_se_tocan', note }`                                  |
| `POST /api/proposals/:id/reopen`            | Reabrir (sin `x-act-as`: actúa Fernanda)  | —                                                                                                                     |
| `POST /api/room/reset`                      | `r` y `reiniciar`                         | —                                                                                                                     |
| `GET /api/room`, `/spaces`, `/proposals`, `/overlaps` | Estado, requisitos, votos pendientes y solapamientos | —                                                                                                  |
| `GET /api/events?after&epoch&limit=200`     | Eventos en vivo, época y reaperturas       | —                                                                                                                     |

Cada fragmento viaja como `{ locator, kind, text?, claims? }`: los estructurados con `claims` y los de texto libre con `text` y sin `claims`.

Un 409 `already_ingested` se cuenta como «ya estaba cargado». Un 409 `seat_held` significa que ese asiento es de una persona.

## El guion

`src/guion.ts`. El paso 0 es la carga inicial: los diez documentos que ya existían (los nueve de siempre y `IS-301 rev A`, con el colector B2 a 10 m), confirmados como lo vigente.

| Paso | Qué pasa                              | Archivos                                                        | Antes necesita   |
| ---- | ------------------------------------- | --------------------------------------------------------------- | ---------------- |
| `s1` | Llega el plano E-102 rev C            | `drive-proyecto/E-102_revC.json`                                | —                |
| `s2` | Daniela corrige el presupuesto        | `carpeta-costos/Presupuesto_itemizado_v3.csv`                   | E-102 rev C      |
| `s3` | Marcos avisa por WhatsApp             | `whatsapp-obra/mensaje-2.txt`                                   | —                |
| `s4` | Llega el plano A-201 rev C            | `drive-proyecto/A-201_revC.json`                                | —                |
| `x1` | Decisión en el libro de obra          | `libro-de-obra/folio-44.txt`                                    | —                |
| `x2` | Llega el plano A-201 rev D            | `drive-proyecto/A-201_revD.json`                                | A-201 rev C      |
| `x3` | Javier mueve el colector B2           | `drive-proyecto/IS-301_revB.json`                               | A-201 rev D      |
| `s5` | Quillay vuelve a cotizar              | `correo-quillay/Q-118_rev2.csv`                                 | A-201 rev C      |
| `s6` | Cierre: los demás se ponen al día     | `carpeta-costos/Carta_Gantt_v5.csv`, `drive-proyecto/EETT-03_revB.md` | E-102 rev C |

El orden de la tabla es el del modo automático: s1, s2, s3, s4, x1, x2, x3, s5, s6. El ETL lo hace cumplir: consulta `GET /api/spaces` y no carga un paso cuyo requisito no esté en la sala. La API ya no exige ese orden.

`x2` trae el shaft a 8,5 m, en la celda C-D/3 del nivel 3, donde el `IS-301 rev A` tiene el colector B2 a 10 m. El sistema abre un solapamiento y el PR del shaft espera su validación. `x3` sube el `IS-301 rev B` con el colector a 13,5 m (D-E/3): el solapamiento queda resuelto y el PR del shaft se fusiona.

## Los jugadores simulados

`src/players`. Las decisiones están en funciones puras con pruebas (`plan.ts`: qué votar y cuándo); el bucle que habla con la API está en `players.ts`.

- **Qué mira:** `GET /api/events` (cursor y época; cuenta las reaperturas de cada propuesta), `GET /api/proposals` (por revisor, `notificationId` y `decision`) y `GET /api/overlaps` (estado, validadores y votos). Con `GET /api/room` sabe qué asientos tienen una persona.
- **Cuándo vota:** por cada revisor pendiente cuyo asiento no tiene una persona, a los `retardo / velocidad` del asiento: Paula 2,5 s, Daniela 3 s, Marcos 3,5 s, Javier 4 s, Quillay 4,5 s, Camila 5 s, Tomás 6 s. Cada uno aprueba con su nota.
- **Las disputas:** en la primera ronda Paula disputa la losa del nivel 3. Después de reabrir, aprueba a los 3 s. Javier ya no disputa el shaft: el cruce con el colector lo detecta el solapamiento.
- **Los solapamientos:** por cada solapamiento abierto, cada validador que no ha votado y cuyo asiento no tiene una persona vota con `POST /api/overlaps/:id/vote`. En el cruce del shaft con el colector B2, Javier vota `se_tocan` con la nota «El shaft a 8,5 m cruza el colector B2 en el nivel 3» y Fernanda `no_se_tocan`; en cualquier otro, `no_se_tocan`. Un solo `se_tocan` lo confirma.
- **Reabrir:** en modo automático, Fernanda reabre a los 4 s. En modo interactivo el ETL avisa «Paula disputó: … — [o] reabrir» y espera; el presentador también puede reabrir desde `/presentador`.
- **Personas primero:** si la API responde `seat_held`, el ETL no insiste: ese voto es de la persona.
- **Velocidad:** `--velocidad 1|2|4` divide todos los retardos y la pausa de 3 s entre pasos.

## La carga: 30 celulares

`pnpm etl carga` simula un público de celulares contra la API y mide cuánto tarda cada cambio en verse. Cada espectador sondea `GET /api/events` con cursor y época como el cliente de hoy (1000 ms ±150 ms en `/caso`, 700 ms en `/sala`, backoff de 2 s y 3 s ante un error, timeout de 10 s por petición) y, ante eventos nuevos o un reinicio, recarga lo que recarga su pantalla. No usa dependencias nuevas: `fetch`, `AbortSignal.timeout` y `crypto.randomUUID`.

```bash
pnpm etl carga                                          # 30 clientes, 5 min, escenario caso
pnpm etl carga --clientes 10 --minutos 1 --ciclo 25     # una pasada corta
pnpm etl carga --escenario sala --json informe.json
pnpm etl carga --base https://<api>/api --produccion    # contra otra API
```

| Opción         | Por defecto                 | Qué hace                                                                                       |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `--clientes`   | 30                          | Espectadores sin asiento                                                                       |
| `--minutos`    | 5                           | Duración total                                                                                 |
| `--escenario`  | `caso`                      | `caso` o `sala`: qué se simula                                                                 |
| `--pulsos`     | 1                           | `1` o `2`. Con 2, cada espectador corre además un segundo bucle que recarga `/flow/history`    |
| `--historial`  | apagado                     | Recarga también `/flow/history` en el bucle único                                              |
| `--ciclo`      | 60                          | Segundos entre el inicio de un ciclo y el siguiente (un ciclo dura unos 30 s)                  |
| `--base`       | `http://localhost:3001/api` | URL de la API, con `/api`                                                                      |
| `--produccion` | apagado                     | Obligatorio si la base no es `localhost` ni `127.0.0.1`; sin él, el comando se niega           |
| `--forzar`     | apagado                     | Corre aunque haya alguien conectado o un caso abierto                                          |
| `--json`       | sin informe                 | Ruta donde escribe el informe en JSON                                                          |

`PRESENTER_KEY` sale del entorno; solo si la base es local usa `sala-los-aromos` por defecto. `API_URL` no se usa: la base va en `--base`.

### Escenario `caso`

Antes de empezar lee `GET /flow` y `GET /room`: si hay alguien conectado, un asiento tomado o el caso abierto, aborta (salvo `--forzar`). Toma los asientos `paula-rojas` y `camila-vera`, que también sondean con su token para mantener el latido, y Camila manda `POST /flow/presence` con `viewing: propuesta` cada 8 s. Después lanza los espectadores, cada uno con un retraso inicial al azar de 0 a 1000 ms, y repite ciclos:

1. Paula manda `POST /flow/minutes` con la minuta de P-12 (+0,40 m en y). Se mide hasta que el `/flow` recargado de cada espectador muestra la propuesta en estado `propuesta`.
2. A los 10 s Camila acepta (`POST /flow/proposals/:id/accept`). Se mide hasta ver la propuesta `resuelta`.
3. A los 10 s el presentador reinicia (`POST /flow/reset`). Se mide hasta ver el caso limpio.

Al terminar, también con Ctrl+C o ante un error, reinicia el caso y suelta los asientos (`DELETE /api/seats/:castId`).

### Escenario `sala`

Los espectadores sondean a 700 ms y, ante eventos, recargan `GET /room`, `/baseline`, `/spaces` y `/proposals?status=active`. Un actor toma y suelta un asiento libre del elenco (no `paula-rojas`, `camila-vera` ni el de Fernanda). Se mide hasta que el `/room` recargado de cada espectador muestra el asiento ocupado y, después, libre. Aborta si hay asientos con gente (salvo `--forzar`).

No produce votos. Un voto real (`POST /api/overlaps/:id/vote` o `POST /api/notifications/:id/response`) necesita un solapamiento o un aviso abierto, que solo existen después de cargar documentos del lago con la clave del presentador; hacerlo desde el script dejaría datos de prueba en la sala y exigiría tomar asientos de revisores. Tomar o soltar un asiento usa el mismo canal de eventos y la misma recarga, así que mide el mismo camino de lectura.

### Cómo leer el informe

- **Por endpoint:** cantidad de llamadas, errores por código (`500×2`; `timeout` y `red` son llamadas sin respuesta) y p50, p95, p99 y máximo de la latencia de la petición.
- **Por acción:** `propuesta`, `resuelto` y `reinicio` en `caso`; `asiento tomado` y `asiento soltado` en `sala`. `vistas` es cuántas veces lo vio un espectador, de las esperadas (espectadores por ciclos). La latencia corre desde justo antes de mandar la acción hasta que la recarga de ese espectador la refleja, y lo que no se vio cuenta como fallo en `bajo 2 s`.
- **Línea final:** `30 clientes · 5 min · todo se ve en < 2 s: ✓/✗`. Es ✓ solo si todo lo esperado se vio en menos de 2 s; con ✗ el comando sale con código 1.

Contra producción (`--produccion`) hazlo sin nadie conectado: el script toma los asientos de Paula y Camila, reinicia el caso en cada ciclo y le suma a la API la carga de todos los clientes.

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
    transform/          un parser por tipo, que devuelve fragmentos
    load/               cliente HTTP de la API y x-action-id
    carga/              el comando carga: opciones, cliente con timeout, sondeo, escenarios, medición e informe
    players/            plan.ts (puro) y players.ts (E/S)
    cli/                argumentos, sesión, formato y entrada de teclado
  tests/                Vitest, incluida la prueba de oro
```

Tags de Nx: `type:app` y `scope:etl`. No importa contextos ni `data/main`: habla con la API solo por HTTP.
