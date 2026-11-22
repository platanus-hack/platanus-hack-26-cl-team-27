# Solapamientos: cada documento es un PR contra la fuente única

Vigente mantiene **una sola verdad del proyecto**: lo vigente. Todo lo que llega (un plano, una planilla, un mensaje, un folio, una versión del modelo) se parte en fragmentos y se compara contra esa verdad, como un pull request contra `main`. Así se detecta no solo cuándo un documento cambia un dato, sino también cuándo **toca la misma área** que otro documento, aunque hablen de elementos distintos. El lago y el consenso están en [motor](motor.md), y el problema, en [negocio](negocio.md).

## La analogía

| En git                     | En Vigente                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `main`                     | **Lo vigente**: el valor consolidado y consensuado de cada dato, con su procedencia y **dónde está** cada elemento |
| El PR                      | Una **revisión con autoridad** que llega (el plano A-201 rev D, la cotización Q-118 rev 2)                         |
| Los hunks                  | Sus **fragmentos** que cambian algo; los que coinciden quedan como contexto                                        |
| Los checks de CI           | Las **reglas de impacto** (costo, plazo, afectados) y la **detección de solapamientos**                            |
| Los revisores              | Los **afectados** por cualquiera de los hunks                                                                      |
| Los conflictos de merge    | Los **solapamientos** y las **disputas**                                                                           |
| El auto-merge              | Con todas las aprobaciones y sin conflictos, el PR entra solo a lo vigente y la versión del proyecto sube en uno   |
| El force-push              | Una revisión nueva del mismo documento reemplaza el PR abierto, con los votos en limpio                            |
| `git blame`                | La **procedencia** de cada valor                                                                                   |
| Un comentario sin permisos | Un WhatsApp o un folio: no abre un PR, abre una **discrepancia** para el dueño del valor                           |

## La fuente única tiene áreas

Lo vigente sabe el valor de cada dato y, además, qué ocupa cada elemento. El modelo de áreas sale de la definición de cada proyecto (`project_levels`, `project_systems`, los ejes de `projects` y la huella de cada sujeto):

- **Niveles:** por ejemplo, del 1 al 5, más la cubierta.
- **Grilla de ejes:** los longitudinales con su distancia en metros (por ejemplo A a E, a 0, 4, 8, 12 y 16 m del eje A) y los transversales (por ejemplo del 1 al 4). Una **celda** es un tramo con un eje transversal, por ejemplo `C-D/3`.
- **Sistemas:** por ejemplo estructura, arquitectura, sanitarias y eléctricas. Costos y plazo no ocupan espacio.

La **huella** de cada elemento es una regla en datos, que se calcula a partir de sus valores: el tipo (`soporte` u `ocupante`), los niveles, las celdas (todas, las de un eje transversal, o la del tramo donde cae un atributo de posición sobre un eje) y los sistemas. Por ejemplo:

| Elemento       | Huella                                                                                        | Tipo     |
| -------------- | --------------------------------------------------------------------------------------------- | -------- |
| Losas          | Su nivel, todas las celdas, estructura                                                        | Soporte  |
| Shaft S1       | Todos los niveles, la celda que da su distancia al eje A en el eje 3, sanitarias y eléctricas | Ocupante |
| Ventanas norte | Niveles 1 a 5, fachada norte (eje 1), arquitectura                                            | Ocupante |
| Colector B2    | Nivel 3, la celda que da su distancia al eje A en el eje 3, sanitarias                        | Ocupante |

Un proyecto sin ejes ni niveles no tiene áreas: sus elementos no generan solapamientos de área.

Los soportes no generan solapamientos de área, porque lo que los atraviesa ya lo cubren las dependencias de impacto: la calculista se entera de las perforaciones del shaft.

## Fragmentos

Cada revisión llega partida en fragmentos, y cada hecho guarda el localizador de su fragmento:

- **Estructurados:** una fila de un cuadro de un plano, una fila de una planilla o un parámetro de un modelo BIM. Traen sus hechos ya extraídos por el conector.
- **Texto libre:** un mensaje de WhatsApp, un folio del libro de obra o un acuerdo de un acta. Los lee la API con `context/impact`, y cada hecho queda con su confianza. Lo que no alcanza 0,7 se ve, pero no tiene efecto.
  - Con `ANTHROPIC_API_KEY`, lee Claude, y la API recuerda en memoria la respuesta de cada consulta.
  - Sin la clave (la variable va vacía en `.env.example`), la API no lee texto libre: una revisión con un fragmento de texto responde `503 inference_unavailable`.

## Detección, en anillos

Cada fragmento se compara contra lo vigente y contra los PR abiertos:

1. **Mismo dato.** Si coincide, corrobora. Si es distinto y viene de una fuente con autoridad, es un hunk del PR. Si es distinto y viene de una fuente sin autoridad, es una discrepancia. Si un documento usaba el valor viejo, queda desfasado.
2. **Mismo elemento.** Otro dato del mismo elemento está en un PR abierto.
3. **Misma área.** Con los **valores nuevos**, el elemento comparte nivel y celda con otro ocupante. Si el sistema es el mismo, es un _cruce de trazado_; si es distinto, una _interferencia_.
4. **Simultáneo.** Dos PR abiertos terminan ocupando el mismo lugar.

## Validación conjunta

Un solapamiento no cambia nada por sí solo: abre una validación.

- **Validan** el autor de la revisión que llega y el dueño del documento que respalda al otro elemento.
- **Votan** «Se tocan» o «No se tocan», con una nota opcional.
- **Si todos dicen que no se tocan**, el solapamiento queda **descartado**.
- **Si alguno dice que se tocan**, queda **confirmado**: es un conflicto real.
- **Mientras haya un solapamiento abierto o confirmado, el PR no entra**, aunque todos sus revisores hayan aprobado.
- **El conflicto se resuelve** cuando llega una revisión que separa las huellas (la detección corre de nuevo después de cada ingreso y de cada merge), o cuando el PR se retira o se reemplaza. Al resolverse, si el PR ya tenía todas las aprobaciones, entra solo.

## Un ejemplo

1. El plano **IS-301** (instalaciones sanitarias, nivel 3), de quien lleva sanitarias, pone el colector B2 a 10 m del eje A: celda C-D/3.
2. Llega el **A-201 rev D** y el shaft S1 pasa de 6 a 8,5 m. Es un PR con un hunk que cambia (la posición del shaft) y otros de contexto sin cambio.
3. **Antes de que nadie lo diga**, se abre el solapamiento «Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias», que validan el autor del A-201 y el dueño del IS-301.
4. El dueño del IS-301 confirma «Se tocan»: el PR del shaft queda bloqueado aunque sus revisores lo aprueben.
5. Llega el **IS-301 rev B**, que mueve el colector a 13,5 m (D-E/3). El solapamiento queda resuelto y el PR del shaft entra solo.

## Glosario

| Término             | En el código    | Qué es                                                                                               |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| Área                | `AreaCell`      | Nivel, celda de la grilla y sistemas                                                                 |
| Huella              | `footprint`     | Las áreas que ocupa un elemento según sus valores                                                    |
| Fragmento           | `Chunk`         | La parte de una revisión que se compara por separado: una fila, un mensaje, un acuerdo, un parámetro |
| Solapamiento        | `Overlap`       | Un fragmento que toca el mismo elemento o la misma área que otro documento o que otro PR             |
| Validación conjunta | `Overlap.votes` | La decisión de los dueños de ambos lados: se tocan o no se tocan                                     |
| PR de la obra       | `Proposal`      | Una revisión con autoridad que llega, con sus hunks, checks, revisores y conflictos                  |
