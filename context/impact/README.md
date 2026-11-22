# @team27/context-impact

Decide a quién afecta un cambio y cuánto, y lee qué afirma un documento de texto libre. Tiene dos capas:

- **Reglas.** `AnalyzeChange` cruza el cambio con el grafo del proyecto (`ProjectGraph`) y devuelve un `Impact`: costo, atraso, partidas y tareas que cambian, un hallazgo (`Finding`) por afectado y los que se dejaron fuera a propósito (`filtered`), con su razón. Son los afectados seguros.
- **Probabilidad** ([Mano alzada](../../docs/auditoria.md#mano-alzada)). Los modelos estiman lo que las reglas no saben, y el contexto filtra lo que devuelven contra el vocabulario del proyecto:
  - **Quién más puede estar afectado por un cambio.** Un modelo de decisión (Jev) da la probabilidad calibrada de que cada persona a quien las reglas no ven dependa del cambio. Un modelo de lenguaje (Claude) escribe la razón, la evidencia que cita y una pregunta de sí o no, solo para quienes pasan el umbral. La persona confirma alzando la mano.
  - **Qué afirma un documento.** Mensajes de WhatsApp, folios del libro de obra y planos en PDF o imagen se convierten en afirmaciones sobre los elementos del proyecto, cada una con su confianza.

Ningún modelo calcula costos ni plazos: eso sale solo de las reglas. Lo que devuelven los modelos es una sugerencia hasta que una persona la confirma.

## Reglas

- **Cantidades por tipo de elemento** (`QUANTITIES`):

  | Tipo      | Cantidad              | Fórmula                 |
  | --------- | --------------------- | ----------------------- |
  | `losa`    | `volumen` (m³)        | área × espesor          |
  | `losa`    | `peso_propio` (kN/m²) | espesor × 25 kN/m³      |
  | `ventana` | `superficie` (m²)     | cantidad × ancho × alto |
  | `shaft`   | `perforacion` (m²)    | ancho × largo           |

- **Dependencias.** Una `Dependency` dice que un afectado vigila ciertas propiedades de un tipo de elemento. Si alguna cambia, recibe un hallazgo con su texto y su acción (`{elemento}` se reemplaza por el nombre del elemento), más las cantidades que pide (`measures`), con antes, después y diferencia.
- **Costo.** Por cada partida del tipo de elemento: (cantidad después − cantidad antes) × `factor` × precio unitario. Si el total no es cero, quien lleva el presupuesto (`costOwnerId`) recibe un hallazgo con cada línea.
- **Plazo.** Las tareas con `driver` en el elemento duran cantidad ÷ rendimiento, redondeado hacia arriba a días enteros, con mínimo 1; las demás conservan sus `days`. `criticalPath` calcula el plazo y la holgura antes y después.
  - Si la entrega se mueve, quien lleva el plazo (`scheduleOwnerId`) recibe un hallazgo.
  - Si la holgura lo absorbe, no se le avisa y la razón queda en `filtered`.
- **Formato.** Los números van en español de Chile: `3,75`, `$3.636.500`, `1 día` y `4 días`.

## Probabilidad

- **`ProjectVocabulary`:** los elementos del proyecto con sus atributos y unidades, y las personas con su rol. Es lo único que los modelos pueden nombrar.
- **`Evidence`:** texto (`mensaje`, `libro_obra`, `documento`) o archivo (`plano`, `documento`) en PDF, PNG, JPEG o WebP, en base64.
- **`screenEstimates(estimaciones, candidatos)`:** descarta a quien no es candidato y lo que llega sin razón o sin pregunta, acota la probabilidad a [0, 1] con dos decimales, deja la más alta por persona, le pone banda (`alta` desde 0,7, `media` desde 0,4, `baja`) y ordena de mayor a menor.
- **`splitByThreshold(sugerencias, umbral)`:** `ask` (desde el umbral: se le pregunta a la persona) y `watch` (bajo el umbral: queda visible, sin preguntar).
- **`screenScores(puntajes, candidatos)`:** lo mismo para los puntajes del modelo de decisión, que solo traen probabilidad.
- **`withScores(puntajes, textos, preguntaDePlantilla)`:** une el puntaje de cada persona con el texto que escribió el modelo de lenguaje. La probabilidad siempre sale del puntaje. Si no hay texto, usa una razón genérica, «sin evidencia directa» y la pregunta de plantilla.
- **`templateQuestion(cambio, vocabulario)`:** «¿Te afecta el cambio de «Espesor» en «Losa nivel 3», de 15 cm a 20 cm?», con coma decimal.
- **`screenClaims(candidatas, vocabulario, confianzaMínima)`:** acepta solo sujetos y atributos del vocabulario, con un número si el atributo tiene unidad, la unidad del proyecto, un localizador y la confianza mínima. Si dos lecturas del mismo valor tienen el mismo rol, deja la más confiable. Cada rechazo trae su razón, por ejemplo «Confianza 0,65, bajo el mínimo de 0,70».
- **`stableStringify`:** JSON con las llaves ordenadas, para las llaves de caché.

## Casos de uso

| Caso de uso       | Qué hace                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnalyzeChange`   | Analiza un cambio contra el grafo y guarda el impacto                                                                                                                                                                          |
| `GetImpacts`      | Los impactos de varios cambios                                                                                                                                                                                                 |
| `SuggestAffected` | `{ change, vocabulary, notifiedIds, authorId, evidence, threshold? }`: consulta solo por quienes no avisaron las reglas ni son la autora, y devuelve `{ ask, watch }`. Umbral por defecto: 0,5                                 |
| `ExtractClaims`   | `{ evidence, vocabulary, minConfidence? }`: lee la evidencia y devuelve `{ accepted, rejected }`. Confianza mínima por defecto: 0,7. La API lo usa para anclar los fragmentos de texto libre (WhatsApp, libro de obra, actas) |

`SuggestAffected` recibe un `AffectedEstimator` y, opcionalmente, un `DependencyScorer`:

- **Sin puntuador**, el estimador da la probabilidad y el texto de todos.
- **Con puntuador**, el puntuador da la probabilidad de todos en una llamada, y el estimador escribe el texto solo de quienes pasan el umbral. Si nadie pasa, no se le llama. Si el estimador no está disponible (`InferenceUnavailableError`), las sugerencias salen igual, con la pregunta de plantilla. Si el puntuador falla, falla la consulta: sin probabilidad no hay decisión.

`SuggestAffected` y `ExtractClaims` rechazan con `ValidationError` lo que no tiene sentido consultar: un cambio fuera del vocabulario, un umbral fuera de (0, 1] o evidencia vacía. Si no queda nadie por evaluar, `SuggestAffected` no llama a ningún modelo.

## Puertos y adapters

| Puerto                   | Adapters                                                                         |
| ------------------------ | -------------------------------------------------------------------------------- |
| `ProjectGraphRepository` | `InMemoryProjectGraph`                                                           |
| `ImpactRepository`       | `PrismaImpactRepository`                                                         |
| `DependencyScorer`       | `JevDependencyScorer`, `FixtureDependencyScorer`, `CachedDependencyScorer`       |
| `AffectedEstimator`      | `ClaudeAffectedEstimator`, `FixtureAffectedEstimator`, `CachedAffectedEstimator` |
| `ClaimReader`            | `ClaudeClaimReader`, `FixtureClaimReader`, `CachedClaimReader`                   |

- **En memoria.** `InMemoryProjectGraph` es el grafo que le pasa la API, sacado de la definición del proyecto.
- **Prisma.** `PrismaImpactRepository` usa la tabla `impacts`, con el detalle en JSON.
- **Jev.** Es el modelo «System One» de TypeSafe AI: no escribe texto, responde preguntas tipadas con probabilidades calibradas. Usa el SDK oficial (`@typesafe-ai/sdk`), con `jev-latest` por defecto (`JevOptions` lo cambia). Hace una sola llamada a `systemOne` con una pregunta `noul` por candidato («¿El trabajo de Camila Vera (Instalaciones eléctricas) depende de `cambio`…?», con criterios para sí y para no), y toma `answers.<id>.noul` como probabilidad. El estado lleva el proyecto, el cambio y la evidencia de texto. Los planos no van, porque Jev no lee PDF y sus imágenes son experimentales; los lee Claude. Un error del SDK llega como `InferenceUnavailableError`. La clave sale de `TYPESAFE_API_KEY`.
- **Claude.** Usa el SDK oficial (`@anthropic-ai/sdk`) con `claude-opus-5-5`, esfuerzo `medium` por defecto (`ClaudeOptions` lo cambia) y salida estructurada validada con zod (`betaZodOutputFormat`). Los planos en PDF van como bloque `document` y las imágenes como bloque `image`, siempre antes del texto. Activa `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`): si el modelo declina por una política, el servidor reintenta con otro modelo en la misma llamada. Una negativa, una respuesta cortada, un formato inválido o un error de la API llegan como `InferenceUnavailableError`. Las credenciales se resuelven como en cualquier cliente del SDK: `ANTHROPIC_API_KEY` o un perfil de `ant auth login`.
- **Fixture.** Respuestas fijas: por sujeto y atributo del cambio, o por título de la evidencia y, si hace falta distinguir varios textos bajo el mismo título, por un trozo que el texto debe contener (`textIncludes`). Sirven para los tests, sin red. `anthropicClient(apiKey)` crea el cliente de Claude para quien compone.
- **Caché.** Decoran a otro adapter y guardan cada respuesta bajo el SHA-256 de la consulta con sus llaves ordenadas y un espacio de nombres (por ejemplo, el modelo). `MemoryResponseCache` dura lo que dura el proceso. `FileResponseCache` escribe un JSON por consulta en una carpeta y la reproduce entre procesos. Los modelos no son deterministas: grabar la primera respuesta y reproducirla vuelve repetible una corrida.

Los tests no llaman a ninguna API: los adapters de los modelos se prueban con clientes falsos que revisan el modelo, las preguntas, el estado, los bloques de PDF e imagen y el texto del pedido.

La API arma el grafo y el repositorio de cada proyecto con `buildImpact`, y el `ClaimReader` en `ImpactModule` ([`apps/api`](../../apps/api/README.md)). Con una `ANTHROPIC_API_KEY` no vacía lee Claude, con una caché en memoria; con la clave vacía o ausente no lee texto libre (la ingesta de un fragmento de texto responde 503 `inference_unavailable`) y no sale nada a la red. Cada hecho conserva su confianza, y los que quedan bajo 0,7 se ven rechazados, sin efecto.
