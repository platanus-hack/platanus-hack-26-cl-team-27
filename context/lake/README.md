# @team27/context-lake

El lago de hechos con procedencia y el consenso. Cada revisión de cada documento se ingiere como un conjunto de hechos con puntero a su origen y se compara contra **lo vigente**. Una diferencia con autoridad produce un borrador de propuesta, una sin autoridad abre una discrepancia, y lo vigente solo cambia cuando todos los revisores aprueban. El contexto no conoce a `capture`, `impact` ni `notification`: la API lo compone con ellos ([diseño completo](../../docs/multijugador.md#el-lago-y-el-consenso)).

## Dominio

Todo es puro: las funciones reciben los datos y devuelven el resultado.

- **Tipos:** `Space`, `DocumentKind` (`plano`, `eett`, `cotizacion`, `presupuesto`, `carta_gantt`, `acta`, `mensaje`, `libro_obra`), `Revision`, `Claim` (rol `afirma` o `usa`, con localizador), `BaselineEntry` y su historial, `Proposal` con sus `Review`, `Discrepancy` y `Acknowledgement`.
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

- **`groupBySubject`:** agrupa los `change` por elemento en `ProposalDraft`, con `before` y `after` como mapas atributo → valor de todo el elemento.
- **`decideProposal`, `applyReview`, `reopenFor`:** el voto y su resultado. Todos aprueban, o cero revisores: `merged`. Alguna disputa: `disputed`. Si no, `open`. Reabrir limpia solo a quien disputó y conserva las aprobaciones.
- **`computeStaleness`:** el desfase, derivado y de un nivel. De la última revisión de cada documento cuentan los hechos que usa y los que afirma con autoridad, cuando difieren de lo vigente y no pertenecen a una propuesta abierta. Cada documento desfasado lleva una `signature` de sus valores; una confirmación sin cambio solo vale mientras la firma coincida.
- **`consensusIndex`:** documentos al día sobre documentos totales, más los conteos que deciden el sello. Un documento no está al día si está desfasado sin confirmar o si su revisión discrepa de lo vigente en una discrepancia abierta. `sealed` es verdadero sin propuesta abierta, sin discrepancia abierta y sin desfase sin confirmar.
- **`buildProvenance`:** la cadena de un valor vigente: hecho, revisión, propuesta, aprobaciones, fuentes (hechos de revisiones vigentes que dicen lo mismo), discrepancias respaldadas y valores anteriores.
- **`valueStatus`:** `confirmed`, `proposed` o `disputed`, según las propuestas abiertas que tocan el valor.

## Casos de uso

| Caso de uso          | Entrada → salida                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `IngestRevision`     | `RevisionDraft` → `IngestedRevision`: la revisión, sus hechos, el resultado de cada hecho, un `ProposalDraft` por elemento, las discrepancias abiertas y las respaldadas. Idempotente por documento y etiqueta (`alreadyIngested`) |
| `OpenProposal`       | `{ draft, changeId, reviewerIds, filtered }` → `{ proposal, superseded }`. Reemplaza las propuestas activas del mismo elemento y atributo; con cero revisores se fusiona al abrir |
| `RecordReview`       | `{ proposalId, reviewerId, decision, note? }` → `{ proposal, changed, merged }`. Idempotente si repite el voto; cambiarlo es `ValidationError`  |
| `ReopenProposal`     | `{ proposalId, actorId? }` → `{ proposal, reopenedReviewerIds }`. Solo una propuesta en disputa, y solo su autor                              |
| `WithdrawProposal`   | `{ proposalId, actorId? }` → `Proposal`. Solo el autor                                                                                       |
| `DismissDiscrepancy` | `{ discrepancyId, actorId?, note? }` → `Discrepancy`. Solo el dueño del valor                                                                |
| `AcknowledgeStale`   | `{ documentId, ownerId, note }` → `Acknowledgement`. La nota es obligatoria y el documento debe estar desfasado                              |
| `GetBaseline`        | → `BaselineView[]`: cada valor vigente con su estado, el número de fuentes y las propuestas que lo tocan                                     |
| `GetProvenance`      | `{ subject, attribute }` → `Provenance` o `null`                                                                                            |
| `ListStale`          | → `StaleDocument[]`, con su confirmación si la tienen                                                                                        |
| `ListProposals`      | `{ status? }` (un estado o `active`) → `Proposal[]`                                                                                          |
| `GetConsensus`       | → `Consensus`: el índice, las propuestas abiertas y fusionadas, las discrepancias abiertas y los desfases                                     |
| `SeedLake`           | `{ revisions: { revision, claims }[] }` → `SeededLake`. Borra el lago, guarda las revisiones y siembra lo vigente con el primer hecho con autoridad de cada valor; dos valores con autoridad distintos son `ValidationError` |

`IngestRevision` no abre propuestas ni sabe de costos o avisos: devuelve los borradores y quien lo llama decide. Las violaciones de invariantes lanzan `ValidationError`.

## Adapters

Subpath `@team27/context-lake/adapters`.

- `PrismaRevisionRepository`, `PrismaClaimRepository`, `PrismaBaselineRepository`, `PrismaProposalRepository`, `PrismaDiscrepancyRepository` y `PrismaAcknowledgementRepository`, sobre las tablas del lago de [`data/main`](../../data/main/README.md). Reciben un `PrismaClient`. Al reemplazar un valor vigente, `PrismaBaselineRepository` guarda el anterior en el historial en la misma transacción.
- `FixtureFactExtractor(catalog)`: los hechos escritos a mano de cada revisión del catálogo, con la clave `fixtureKey(documentId, label)`. Una revisión fuera del catálogo no tiene hechos.

El lector de la plantilla CSV y el lector con modelo de lenguaje entran detrás del mismo puerto `FactExtractor`; la muestra no los usa.

## Pruebas

`tests/` usa puertos falsos en memoria hechos con `vi.fn()` (`fakeLake.ts`) y recorre el flujo completo: siembra, ingesta, propuesta, voto, fusión, desfase, confirmación sin cambio y sello.
