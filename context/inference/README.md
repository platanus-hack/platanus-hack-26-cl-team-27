# @team27/context-inference

La capa de probabilidad de [Mano alzada](../../docs/auditoria.md#mano-alzada). Un modelo de lenguaje o de visión estima lo que las reglas no saben, y este contexto filtra lo que devuelve contra el vocabulario del proyecto:

- **Quién más puede estar afectado por un cambio.** Las reglas calculan los afectados seguros. El modelo estima la probabilidad de que alguien a quien las reglas no ven dependa del cambio, con su razón, la evidencia que cita y una pregunta de sí o no para esa persona. La persona confirma alzando la mano.
- **Qué afirma un documento.** Mensajes de WhatsApp, folios del libro de obra y planos en PDF o imagen se convierten en afirmaciones sobre los elementos del proyecto, cada una con su confianza.

El modelo nunca calcula costos ni plazos: eso sigue saliendo de las reglas de `impact`. Lo que devuelve el modelo es una sugerencia hasta que una persona la confirma.

## Dominio

- **`ProjectVocabulary`:** los elementos del proyecto con sus atributos y unidades, y las personas con su rol. Es lo único que el modelo puede nombrar.
- **`Evidence`:** texto (`mensaje`, `libro_obra`, `documento`) o archivo (`plano`, `documento`) en PDF, PNG, JPEG o WebP, en base64.
- **`screenEstimates(estimaciones, candidatos)`:** descarta a quien no es candidato y lo que llega sin razón o sin pregunta, acota la probabilidad a [0, 1] con dos decimales, deja la más alta por persona, le pone banda (`alta` desde 0,7, `media` desde 0,4, `baja`) y ordena de mayor a menor.
- **`splitByThreshold(sugerencias, umbral)`:** `ask` (desde el umbral: se le pregunta a la persona) y `watch` (bajo el umbral: queda visible, sin preguntar).
- **`screenClaims(candidatas, vocabulario, confianzaMínima)`:** acepta solo sujetos y atributos del vocabulario, con un número si el atributo tiene unidad, la unidad del proyecto, un localizador y la confianza mínima. Si dos lecturas del mismo valor tienen el mismo rol, deja la más confiable. Cada rechazo trae su razón, por ejemplo «Confianza 0,65, bajo el mínimo de 0,70».
- **`stableStringify`:** JSON con las llaves ordenadas, para las llaves de caché.

## Casos de uso

| Caso de uso       | Qué hace                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SuggestAffected` | `{ change, vocabulary, notifiedIds, authorId, evidence, threshold? }`: consulta solo por quienes no avisaron las reglas ni son la autora, y devuelve `{ ask, watch }`. Umbral por defecto: 0,5 |
| `ExtractClaims`   | `{ evidence, vocabulary, minConfidence? }`: lee la evidencia y devuelve `{ accepted, rejected }`. Confianza mínima por defecto: 0,7                                                            |

Ambos rechazan con `ValidationError` lo que no tiene sentido consultar: un cambio fuera del vocabulario, un umbral fuera de (0, 1] o evidencia vacía. Si no queda nadie por evaluar, `SuggestAffected` no llama al modelo.

## Puertos y adapters

| Puerto              | Adapters                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| `AffectedEstimator` | `ClaudeAffectedEstimator`, `FixtureAffectedEstimator`, `CachedAffectedEstimator` |
| `ClaimReader`       | `ClaudeClaimReader`, `FixtureClaimReader`, `CachedClaimReader`                   |

- **Claude.** Usa el SDK oficial (`@anthropic-ai/sdk`) con `claude-opus-5-5`, esfuerzo `medium` por defecto (`ClaudeOptions` lo cambia) y salida estructurada validada con zod (`betaZodOutputFormat`). Los planos en PDF van como bloque `document` y las imágenes como bloque `image`, siempre antes del texto. Activa `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`): si el modelo declina por una política, el servidor reintenta con otro modelo en la misma llamada. Una negativa, una respuesta cortada, un formato inválido o un error de la API llegan como `InferenceUnavailableError`. Las credenciales se resuelven como en cualquier cliente del SDK: `ANTHROPIC_API_KEY` o un perfil de `ant auth login`.
- **Fixture.** Respuestas fijas del guion: por sujeto y atributo del cambio, o por título del documento. Sirven para la demo sin red y para los tests.
- **Caché.** Decoran a otro adapter y guardan cada respuesta bajo el SHA-256 de la consulta con sus llaves ordenadas y un espacio de nombres (por ejemplo, el modelo). `MemoryResponseCache` dura lo que dura el proceso. `FileResponseCache` escribe un JSON por consulta en una carpeta y la reproduce entre procesos. El modelo no es determinista y no acepta `temperature`, así que la demo se vuelve repetible grabando la primera respuesta y reproduciéndola.

Los tests no llaman a la API: los adapters de Claude se prueban con un cliente falso que revisa el modelo, el beta de fallback, el esfuerzo, los bloques de PDF e imagen y el texto del pedido.
