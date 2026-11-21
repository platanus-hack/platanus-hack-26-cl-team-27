# @team27/context-lake

El lago de hechos con procedencia y el consenso. Cada revisión de cada documento se ingiere como un conjunto de hechos con puntero a su origen y se compara contra **lo vigente**. Una revisión con autoridad que cambia algo produce un borrador de propuesta (el PR de la obra, con un hunk por cambio), una diferencia sin autoridad abre una discrepancia, un fragmento que toca el mismo elemento o la misma área que otro abre un solapamiento con su validación conjunta, y lo vigente solo cambia cuando todos los revisores aprueban y no queda ningún solapamiento abierto o confirmado ([diseño](../../docs/solapamientos.md)). El contexto no conoce a `capture`, `impact` ni `notification`: la API lo compone con ellos ([diseño completo](../../docs/multijugador.md#el-lago-y-el-consenso)).

## Dominio

Todo es puro: las funciones reciben los datos y devuelven el resultado.

- **Tipos:** `Space`, `DocumentKind` (`plano`, `eett`, `cotizacion`, `presupuesto`, `carta_gantt`, `acta`, `mensaje`, `libro_obra`), `Revision`, `Chunk` (`fila`, `anotacion`, `acuerdo`, `mensaje`, `parametro` o `texto`, con lo que la inferencia rechazó), `Claim` (rol `afirma` o `usa`, con el localizador de su fragmento y una `confidence` opcional), `BaselineEntry` y su historial, `Proposal` (con sus `ProposalChange`, uno por hunk con elemento, atributo, antes, después y localizador, y su `ProposalContext`) y sus `Review`, `Discrepancy`, `Overlap` con sus `OverlapVote`, y `Acknowledgement`. `AreaCell` es un nivel, una celda y sus sistemas; `Footprint` y `FootprintModel` son lo que la API le pasa al lago para saber qué ocupa cada elemento.
- **`AUTHORITY` y `hasAuthority(kind, attribute)`:** qué tipos de documento mandan sobre cada atributo. Diseño (`espesor_cm`, `ancho_cm`, `alto_cm`, `cantidad`, `posicion_m`): `plano` y `eett`. Precio (`precio_unitario`): `cotizacion` y `presupuesto`. Fechas (`entrega_dias`, `duracion_dias`): `carta_gantt` y `acta`. Un atributo fuera de la tabla no lo manda nadie.
- **`classifyClaims`:** clasifica cada hecho de una revisión.

  | Rol      | Resultado       | Cuándo                                                                          |
  | -------- | --------------- | ------------------------------------------------------------------------------- |
  | `afirma` | `same`          | Igual a lo vigente                                                              |
  | `afirma` | `corroborates`  | Igual al valor de una propuesta abierta (con o sin autoridad)                   |
  | `afirma` | `change`        | Distinto, con autoridad                                                         |
  | `afirma` | `discrepancy`   | Distinto, sin autoridad                                                         |
  | `afirma` | `unknown`       | No hay valor vigente para ese sujeto y atributo                                 |
  | `usa`    | `uses_current`  | Igual a lo vigente                                                              |
  | `usa`    | `uses_proposed` | Distinto de lo vigente pero igual al valor de una propuesta abierta             |
  | `usa`    | `stale`         | Distinto de lo vigente y de toda propuesta abierta: el documento queda desfasado |

  Un `change` o `corroborates` con autoridad también lista en `backsDiscrepancyIds` las discrepancias abiertas con su mismo valor.

- **`buildProposalDraft`:** arma **un solo** `ProposalDraft` por revisión, con un hunk por cada `change` y, como contexto sin cambio, los hechos que afirma y coinciden con lo vigente o con otra propuesta; `before` y `after` son mapas elemento → atributo → valor. Si ningún hecho cambia, no hay borrador. Si el documento ya tiene una propuesta abierta, los valores que esa propuesta traía y la revisión nueva repite también son `change` (la revisión nueva la reemplaza entera, como un force-push).
- **`detectOverlaps`:** con la revisión, sus fragmentos, lo vigente, las propuestas activas y un `FootprintModel`, busca tres anillos para cada propuesta nueva: **mismo elemento** (otro dato del mismo elemento está en un PR de otro documento), **misma área** (con los valores nuevos, la huella de un ocupante comparte nivel y celda con la de otro, vigente) y **simultáneo** (la otra huella es el estado final de una propuesta abierta). Los soportes no generan solapamientos de área, y solo cuenta un cambio que mueve la huella. Registra el área (los sistemas en común o, si no hay, la unión: cruce de trazado o interferencia), el fragmento, quién respalda al otro elemento y los validadores: el autor de la revisión y el dueño de la revisión que respalda al otro, sin repetir.
- **`reassessOverlaps`:** decide qué solapamientos vivos quedan **resueltos**: las huellas ya no se intersectan (la del otro, en lo vigente; en `simultaneo`, con las propuestas abiertas), la propuesta se retiró o se reemplazó, o la otra propuesta de un `mismo-elemento` se cerró.
- **`decideOverlap`, `applyOverlapVote`:** un `se_tocan` deja el solapamiento **confirmado**; si todos los validadores dicen `no_se_tocan`, **descartado**; mientras tanto, abierto.
- **`decideProposal`, `applyReview`, `reopenFor`:** el voto y su resultado. Todos aprueban, o cero revisores: `merged`. Alguna disputa: `disputed`. Si no, `open`. Reabrir limpia solo a quien disputó y conserva las aprobaciones.
- **`computeStaleness`:** el desfase, derivado y de un nivel. De la última revisión de cada documento cuentan los hechos que usa y los que afirma con autoridad, cuando difieren de lo vigente y no pertenecen a una propuesta abierta. Cada documento desfasado lleva una `signature` de sus valores; una confirmación sin cambio solo vale mientras la firma coincida.
- **`consensusIndex`:** documentos al día sobre documentos totales, más los conteos que deciden el sello. Un documento no está al día si está desfasado sin confirmar o si su revisión discrepa de lo vigente en una discrepancia abierta. `sealed` es verdadero sin propuesta abierta, sin discrepancia abierta, sin solapamiento abierto o confirmado (`openOverlaps`) y sin desfase sin confirmar.
- **`buildProvenance`:** la cadena de un valor vigente: hecho, revisión, propuesta, aprobaciones, fuentes (hechos de revisiones vigentes que dicen lo mismo), discrepancias respaldadas y valores anteriores.
- **`valueStatus`:** `confirmed`, `proposed` o `disputed`, según las propuestas abiertas que tocan el valor.

## Casos de uso

| Caso de uso          | Entrada → salida                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `IngestRevision`     | `RevisionDraft` → `IngestedRevision`: la revisión, sus fragmentos y hechos, el resultado de cada hecho, el `ProposalDraft` de la revisión (o `null`), las discrepancias abiertas y las respaldadas. Idempotente por documento y etiqueta (`alreadyIngested`) |
| `OpenProposal`       | `{ draft, changeId, changeIds?, reviewerIds, filtered, deferMerge? }` → `{ proposal, superseded }`. Reemplaza las propuestas activas del mismo documento; con cero revisores se fusiona al abrir, salvo con `deferMerge` (queda abierta hasta que `SettleOverlaps` la fusione) |
| `RecordReview`       | `{ proposalId, reviewerId, decision, note? }` → `{ proposal, changed, merged }`. Idempotente si repite el voto; cambiarlo es `ValidationError`. Con todas las aprobaciones pero con un solapamiento abierto o confirmado, la propuesta no se fusiona y sigue abierta |
| `OpenOverlaps`       | `{ revisionId, proposalIds }` → `Overlap[]`: detecta y guarda los solapamientos nuevos de las propuestas de esa revisión. No repite un par y una celda que ya están vivos o descartados |
| `VoteOverlap`        | `{ overlapId, validatorId, kind, note? }` → `{ overlap, changed, from }`. Solo vota un validador; repetir es idempotente, cambiar el voto o votar uno descartado o resuelto es `ValidationError` |
| `ResolveOverlaps`    | → `Overlap[]`: vuelve a detectar y pasa a `resuelto` los vivos que ya no se tocan |
| `SettleOverlaps`     | → `{ resolved, merged }`: repite «resolver y fusionar» hasta que nada cambie. Fusiona las propuestas abiertas con todas las aprobaciones (o sin revisores) y sin solapamientos vivos |
| `ListOverlaps`       | `{ status? }` (un estado o `activo`) → `Overlap[]` |
| `ReopenProposal`     | `{ proposalId, actorId? }` → `{ proposal, reopenedReviewerIds }`. Solo una propuesta en disputa, y solo su autor                              |
| `WithdrawProposal`   | `{ proposalId, actorId? }` → `Proposal`. Solo el autor                                                                                       |
| `DismissDiscrepancy` | `{ discrepancyId, actorId?, note? }` → `Discrepancy`. Solo el dueño del valor                                                                |
| `AcknowledgeStale`   | `{ documentId, ownerId, note }` → `Acknowledgement`. La nota es obligatoria y el documento debe estar desfasado                              |
| `GetBaseline`        | → `BaselineView[]`: cada valor vigente con su estado, el número de fuentes y las propuestas que lo tocan                                     |
| `GetProvenance`      | `{ subject, attribute }` → `Provenance` o `null`                                                                                            |
| `ListStale`          | → `StaleDocument[]`, con su confirmación si la tienen                                                                                        |
| `ListProposals`      | `{ status? }` (un estado o `active`) → `Proposal[]`                                                                                          |
| `GetConsensus`       | → `Consensus`: el índice, las propuestas abiertas y fusionadas, las discrepancias abiertas y los desfases                                     |
| `SeedLake`           | `{ revisions: { revision, chunks }[] }` → `SeededLake`. Borra el lago, guarda las revisiones y siembra lo vigente con el primer hecho con autoridad de cada valor; dos valores con autoridad distintos son `ValidationError` |

`IngestRevision` no abre propuestas ni sabe de costos o avisos: devuelve los borradores y quien lo llama decide. Las violaciones de invariantes lanzan `ValidationError`.

## Adapters

Subpath `@team27/context-lake/adapters`.

- `PrismaRevisionRepository`, `PrismaChunkRepository`, `PrismaClaimRepository`, `PrismaBaselineRepository`, `PrismaProposalRepository`, `PrismaDiscrepancyRepository`, `PrismaOverlapRepository` y `PrismaAcknowledgementRepository`, sobre las tablas del lago de [`data/main`](../../data/main/README.md). Reciben un `PrismaClient`. Al reemplazar un valor vigente, `PrismaBaselineRepository` guarda el anterior en el historial en la misma transacción.
- `InlineFactExtractor(chunks)`: los fragmentos que ya trae la revisión, con sus hechos; entrega una copia de ellos para cualquier revisión.

Los fragmentos estructurados salen del conector (los parsers del ETL, [`apps/etl`](../../apps/etl/README.md), o el add-in de Revit). Los de texto libre los lee la API con `context/impact` antes de entrar al lago, y el lago recibe el resultado detrás del mismo puerto `FactExtractor`, con la confianza de cada hecho y lo rechazado.

## Pruebas

`tests/` usa puertos falsos en memoria hechos con `vi.fn()` (`fakeLake.ts`) y un `FootprintModel` de prueba (`footprints.ts`), y recorre el flujo completo: siembra, ingesta, propuesta, voto, fusión, desfase, confirmación sin cambio y sello, además de la detección de solapamientos por anillo, la validación conjunta, el bloqueo y la resolución.
