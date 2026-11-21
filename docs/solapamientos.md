# Solapamientos: cada documento es un PR contra la fuente única

Vigente mantiene **una sola verdad del proyecto**: lo vigente. Todo lo que llega (un plano, una planilla, un mensaje, un folio, la minuta de Revit) se parte en fragmentos y se compara contra esa verdad, como un pull request contra `main`. Así se detecta no solo cuándo un documento cambia un dato, sino también cuándo **toca la misma área** que otro documento, aunque hablen de elementos distintos. El lago y el consenso están en [multijugador](multijugador.md), y el problema, en [negocio](negocio.md).

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

Lo vigente sabe el valor de cada dato y, además, qué ocupa cada elemento:

- **Niveles:** del 1 al 5, más la cubierta.
- **Grilla de ejes:** longitudinales A a E, a 0, 4, 8, 12 y 16 m del eje A, y transversales del 1 al 4. Una **celda** es un tramo con un eje transversal, por ejemplo `C-D/3`.
- **Sistemas:** estructura, arquitectura, sanitarias y eléctricas. Costos y plazo no ocupan espacio.

La **huella** de cada elemento se calcula a partir de sus valores:

| Elemento       | Huella                                                                                        | Tipo     |
| -------------- | --------------------------------------------------------------------------------------------- | -------- |
| Losas          | Su nivel, todas las celdas, estructura                                                        | Soporte  |
| Shaft S1       | Todos los niveles, la celda que da su distancia al eje A en el eje 3, sanitarias y eléctricas | Ocupante |
| Ventanas norte | Niveles 1 a 5, fachada norte (eje 1), arquitectura                                            | Ocupante |
| Colector B2    | Nivel 3, la celda que da su distancia al eje A en el eje 3, sanitarias                        | Ocupante |

Los soportes no generan solapamientos de área, porque lo que los atraviesa ya lo cubren las dependencias de impacto: la calculista se entera de las perforaciones del shaft.

## Fragmentos

Cada revisión llega partida en fragmentos, y cada hecho guarda el localizador de su fragmento:

- **Estructurados:** una fila de un cuadro de un plano, una fila de una planilla o un parámetro de la minuta de Revit. Traen sus hechos ya extraídos por el conector.
- **Texto libre:** un mensaje de WhatsApp, un folio del libro de obra o un acuerdo de un acta. Los lee la API con `context/inference`, y cada hecho queda con su confianza. Lo que no alcanza 0,7 se ve, pero no tiene efecto.
  - Con `ANTHROPIC_API_KEY`, lee Claude y la primera respuesta queda grabada.
  - Sin la clave (la variable va vacía en `.env.example`), la lectura es **determinista**: se usan respuestas fijas y grabadas, y nada sale a la red.

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

## En la muestra

1. La carga inicial suma el plano **IS-301** (instalaciones sanitarias, nivel 3), de Javier, con el colector B2 a 10 m del eje A: celda C-D/3.
2. Llega el **A-201 rev D** y el shaft S1 pasa de 6 a 8,5 m. Es un PR con un hunk que cambia (la posición del shaft) y cuatro de contexto sin cambio (las ventanas y el ancho del shaft). Avisa a 3 de 7 y no tiene costo ni atraso.
3. **Antes de que nadie lo diga**, el telón muestra: «Solapamiento: Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias».
4. Javier confirma «Se tocan»: «El shaft a 8,5 m cruza el colector B2 en el nivel 3». El PR del shaft queda bloqueado aunque sus revisores lo aprueben.
5. Paso x3: Javier sube el **IS-301 rev B** y mueve el colector a 13,5 m (D-E/3). El solapamiento queda resuelto y el PR del shaft entra solo.

Las cifras del guion no cambian:

| Cambio   | Costo       | Plazo  | Revisores                                          |
| -------- | ----------- | ------ | -------------------------------------------------- |
| Losa     | +$3.636.500 | +1 día | 4                                                  |
| Ventanas | +$1.998.000 | —      | 4, y Marcos queda filtrado por 38 días de holgura  |
| Shaft    | —           | —      | 3, bloqueado por el colector hasta el IS-301 rev B |

## Glosario

| Término             | En el código    | Qué es                                                                                               |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| Área                | `AreaCell`      | Nivel, celda de la grilla y sistemas                                                                 |
| Huella              | `footprint`     | Las áreas que ocupa un elemento según sus valores                                                    |
| Fragmento           | `Chunk`         | La parte de una revisión que se compara por separado: una fila, un mensaje, un acuerdo, un parámetro |
| Solapamiento        | `Overlap`       | Un fragmento que toca el mismo elemento o la misma área que otro documento o que otro PR             |
| Validación conjunta | `Overlap.votes` | La decisión de los dueños de ambos lados: se tocan o no se tocan                                     |
| PR de la obra       | `Proposal`      | Una revisión con autoridad que llega, con sus hunks, checks, revisores y conflictos                  |
