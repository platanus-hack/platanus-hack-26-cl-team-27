# Auditoría de la idea

Un debate adversarial puso a prueba la idea del proyecto: detractores contra defensores, con foco en romper los esquemas actuales de la industria y en lo multijugador, sin cambiar el problema. Este doc resume qué sobrevivió, cómo funciona la idea purificada y cuánto la soporta el producto. El problema y la propuesta vigentes están en [negocio](negocio.md), la sala en [multijugador](multijugador.md) y la muestra en [muestra](muestra.md).

Se auditó el commit `4cd493b` (2026-11-21). Es una evaluación de documentos y código, sin entrevistas ni pruebas con usuarios: las horas son estimaciones y los puntajes son juicios, no mediciones. Las citas `ruta:línea` se verificaron contra ese commit.

## Veredicto

- **La idea actual no gana el track tal como está.** Los tres detractores coinciden: vista desde fuera, es un flujo de aprobación unánime con un disfraz de juego, y en la demo los bots se llevan la nota. Los defensores coinciden en otra cosa: lo valioso no es el aviso, sino lo vigente consensuado, la procedencia de cada valor y el desfase con dueño.
- **Ganó «Mano alzada».** Tuvo el primer lugar de los tres jueces (7,1 ponderado) y fidelidad 9 al problema. Ataca la cara más dura del problema, el afectado que ni el autor ni las reglas vieron.
- **El producto la soporta a medias (5/10, juicio sin escala).** Consenso, impacto, procedencia, asientos y bots están construidos y probados en dominio. Lo que hace distinta a la idea no existe todavía: declarar una dependencia, validarla, la ronda 2 con un revisor nuevo y el silencio por asiento.
- **El plan suma unas 23 h de trabajo**, con la ronda 2 como pieza más frágil (spike de 1 h y corte a las 6 h).
- **Lo que no se puede prometer:** que el sistema descubra dependencias (la pregunta del guion es sembrada), que la obra adopte la idea (el incentivo no está probado y puede ser negativo) ni que sea la primera en hacerlo.

## Método

| Fase            | Qué hizo                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terreno         | Dos auditorías del producto (dominio y API; web y experiencia multijugador) y dos investigaciones (cómo se coordinan hoy los cambios en obra y qué es novedoso)                                                                                                     |
| Ronda 0         | Tres detractores contra la idea actual: una persona con 28 años en obra y experiencia de ITO, un jurado del track que invierte y un ingeniero escéptico. Dos defensores: la persona fundadora y alguien de coordinación BIM                                         |
| Divergencia     | Siete innovadores con lentes distintos: prácticas del desarrollo de software, diseño de juego cooperativo, decidir antes del cambio, todo dentro del canal, incentivos y confianza, contra la unanimidad y el pitch como evento multijugador. Salieron 14 conceptos |
| Fuego cruzado   | Cinco candidatos, cada uno atacado por los tres detractores y corregido por un defensor                                                                                                                                                                             |
| Jurado          | Tres jueces (track Multiplayer, industria chilena, producto e inversión) puntuaron de 1 a 10. Ponderación: novedad ×3, multijugador ×3, factibilidad ×2, demo ×2, valor ×2; con fidelidad al problema menor que 7, el candidato queda descalificado                 |
| Crisol y cierre | La idea purificada pasó por un último ataque de los tres detractores contra dos defensores, una evaluación de soporte del producto, un crítico de completitud y una verificación de cada afirmación contra el código                                                |

## El problema, sin cambios

> En proyectos de construcción, múltiples equipos toman decisiones interdependientes mientras trabajan con distintas herramientas, documentos y modelos. Cuando un actor modifica una decisión, elemento, especificación o condición del proyecto, los equipos que dependen de ese cambio no siempre pueden identificar a tiempo cómo los afecta ni qué deben actualizar.
>
> Como estas dependencias están distribuidas entre personas y sistemas, detectar el impacto y coordinar una respuesta depende de revisión, interpretación y comunicación manual entre equipos. Esto hace que información desactualizada siga avanzando por el proyecto y termine generando retrabajo, conflictos entre disciplinas, retrasos y sobrecostos.

Mano alzada ataca una cara del problema, el afectado que nadie vio, pero el pitch enuncia el problema completo, incluido «qué deben actualizar». Lo que se pone en pantalla es qué hay que actualizar y quién usa el dato desactualizado, no quién calló: si el registro se lee como asignación de culpa, la idea se acerca a la disputa contractual, que es otro problema.

## La idea actual frente a sus detractores

| Quién                        | Veredicto                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Detractor: veterano de obra  | Buen guion de demo y mal producto: pide unanimidad a quienes no contestan correos                            |
| Detractor: jurado e inversor | «Git para planos» más avisos con un voto unánime pegado encima. No gana el track                             |
| Detractor: ingeniero         | Un flujo de aprobación unánime con teatro técnico: lo que se le ve al jurado es un contador de bots votando  |
| Defensor: fundador           | El producto no es un notificador sino el «git de la obra»: lo vigente consensuado, con procedencia por valor |
| Defensor: coordinación BIM   | La obra no sufre por falta de avisos, sino porque nadie sabe qué versión vale; eso es lo que hay que vender  |

Los cinco coinciden en un punto: `README.md` y `project-description.md` venden «detectar, calcular y avisar», la parte más fácil de copiar, y no mencionan la sala ni el consenso.

## Candidatos

Los 14 conceptos se agruparon en cinco candidatos. C0 es el control: la idea actual en su mejor versión.

| Candidato                                        | Qué rompe                                                                             | Fid. | Nov. | Multi. | Fact. | Demo | Valor | Pond.   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---- | ---- | ------ | ----- | ---- | ----- | ------- |
| **C2 Mano alzada**                               | La lista de distribución que fija el autor y el grafo inferido que nadie corrige      | 9    | 7    | 8      | 5     | 8    | 7     | **7,1** |
| C1 Dos instrucciones, un solo aviso              | El aviso por cambio aislado: dos cambios simultáneos se apilan sobre el cronograma    | 8    | 6,3  | 4      | 7,7   | 7,3  | 7,3   | 6,3     |
| C3 Tanteo                                        | Emitir primero y descubrir el impacto después: cada afectado fija su tolerancia antes | 7,3  | 5,3  | 6,3    | 6     | 6,3  | 5     | 5,8     |
| C0 La sala que no deja avanzar lo desactualizado | El último plano emitido como verdad                                                   | 9    | 4    | 5,3    | 7,7   | 6    | 6     | 5,6     |
| C4 Enmienda                                      | El sí o no de la orden de cambio: los afectados enmiendan sobre opciones calculadas   | 7,3  | 6    | 6,3    | 3,3   | 7    | 5     | 5,6     |

Los tres jueces pusieron a C2 en primer lugar y ninguno descalificó a nadie. C2 ganó porque es la única en que lo multijugador existe porque hay varias personas: las reglas saben una cosa, el declarante otra y quien valida una tercera. Su punto débil es la factibilidad (5), y por eso el plan empieza estabilizando y corta temprano.

## Mano alzada

> El sistema calcula quién depende de un cambio. Si falta alguien, la persona afectada alza la mano con su nombre y su hora, y el costo se recalcula. Lo vigente cambia solo cuando confirman todos los que dependen de ello, y callar no aprueba nada: se ve.

### El esquema que rompe

Hoy el alcance de un cambio lo fija el autor (la lista de distribución del transmittal o de la orden de cambio) o un grafo que alguien infirió y que nadie puede corregir con su nombre. En los dos casos, quien no figura no se entera. La regla nueva: el alcance es lo que calculan las reglas más lo que cualquier persona de la obra declare, con autor y hora. La unidad de verdad deja de ser el último plano emitido y pasa a ser el valor que confirmaron los que dependen de él, con cada cifra respondiendo por su origen.

### Cómo funciona, sobre el guion de Los Aromos

1. **Cambio.** Fernanda suelta el E-102 rev C: losa N3 de 15 a 20 cm. Como hoy, las reglas avisan a 4 de 7 (Paula, Javier, Daniela y Marcos), con +$3.636.500 y +1 día en la ruta crítica. Camila, Tomás y Quillay no reciben nada.
2. **Pregunta guiada, rotulada como sembrada.** Al asiento de Camila (instalaciones eléctricas) le llega «¿tus canalizaciones van embutidas en la losa N3?». Ninguna regla la une a la losa, porque sus dependencias son las del shaft. Se dice en voz alta que la pregunta está sembrada: muestra el mecanismo, no descubre nada.
3. **Declaración.** «Me afecta» entra al lago como un hecho «usa», con autor, hora y estado: sin validar, validada o rechazada con nota.
4. **Validación con plazo.** Quien valida tiene un plazo de demo para hacerlo o rechazar con nota visible. Si calla, la declaración entra igual, rotulada «sin validar».
5. **Ronda 2.** La propuesta reabre con Camila como revisora y todos los votos se reinician. Es una operación nueva del lago: `reopenFor` solo devuelve a pendiente a quienes disputaron (`context/lake/src/domain/Proposal.ts:81-96`) y `ReopenProposal` no admite revisores nuevos (`context/lake/src/application/use-cases/ReopenProposal.ts:23-35`). `decideProposal` queda intacto (`Proposal.ts:54-64`).
6. **Costo con origen.** El costo se recalcula con la dependencia declarada y cada cifra lleva su rótulo: «por reglas», «declarada» o «sin validar». Lo que no está en el catálogo entra «por estimar» y no mueve la cifra.
7. **Silencio visible.** Cada asiento tiene un plazo de demo. Al vencer, el telón dice «sin respuesta» con nombre y hora; no aprueba ni fusiona. Lo que usa el valor viejo queda «en uso con dato desactualizado», con su dueño.
8. **Registro de proceso.** Al tocar la cifra: «declarada por Camila, 14:02; validada por Paula (o sin validar); Daniela, sin respuesta». Extiende `buildProvenance` (`context/lake/src/domain/buildProvenance.ts:60`).

### Reglas

- El alcance es lo calculado por reglas más lo declarado por cualquier persona; nunca lo elige solo el autor.
- Una declaración sin validar entra al alcance con voto, rotulada. Si quien valida acepta o calla, el declarante vota igual. Si rechaza con nota, la declaración queda visible, el declarante pasa a observador y puede disputar la nota.
- Una declaración que cambia el alcance abre la ronda 2 y reinicia todos los votos. No se agregan revisores a una propuesta abierta sin reabrirla.
- El silencio nunca aprueba ni fusiona.
- Las cifras salen de reglas deterministas, sin modelo de lenguaje.
- Un bot nunca reemplaza en silencio a un humano presente: el humano que no responde queda «sin respuesta».
- El registro anota proceso (quién declaró, validó o calló), no culpa ni costos asignados.
- Lo simulado y lo sembrado se rotulan en voz alta.

### Por qué es multijugador

| Rol                                 | Qué aporta                                                    | Qué no puede                       |
| ----------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| Autora (Fernanda, la presentadora)  | Suelta el cambio                                              | Ver lo que solo sabe quien declara |
| Quien valida (Paula, en el guion)   | Valida o rechaza con nota, dentro de un plazo                 | Controlar el alcance por omisión   |
| Declarantes (cualquier asiento)     | Saben lo que las reglas no saben; alzan la mano con su nombre | Fijar el costo o el alcance final  |
| Revisores (por reglas o declarados) | Confirman o disputan                                          | Fusionar sin los demás             |
| Bots                                | Juegan los asientos vacíos de forma determinista              | Votar por un humano presente       |
| Público sin asiento                 | Mira el telón, contado como presente                          | Votar                              |

Nadie puede solo: las reglas saben lo que está en el catálogo, quien declara sabe lo que no está y quien valida responde con plazo y nota visibles. Con un asiento menos, el alcance queda subestimado y se ve con plata. Límites que el pitch dice en voz alta: no hay edición simultánea sobre un valor; la asimetría es de conocimiento y de autoridad, no de información oculta, porque el telón proyecta todo; con bots en todos los asientos la demo corre igual, así que el momento central lo hace una persona real. El público puede tomar 7 asientos: con 30 personas, 23 quedan sin asiento.

### Lo que aporta

Detectar un cambio, calcular su impacto y avisar no basta para diferenciarse: la idea no se vende así. Lo que aporta, como hipótesis sin validar con usuarios:

- El alcance se corrige con atribución: el afectado se declara con su nombre y quien valida responde con plazo y nota.
- El silencio se mide y se expone con nombre, hora y consecuencia, sin convertirlo en aprobación.
- Cada cifra muestra su origen.
- La combinación como unidad de verdad: lo vigente es lo que confirmaron los que dependen de ello. Cada pieza suelta es fácil de copiar.

La neutralidad entre fuentes, el foco en Latinoamérica y WhatsApp son hoy un argumento, no una demostración, porque los canales están simulados.

## El pitch de 3 minutos

| Tramo     | Qué pasa                                                                                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | El problema completo, tal cual. «Proyecto ficticio, fuentes y canales simulados.» Fernanda suelta la losa de 15 a 20 cm: 4 de 7 avisados por reglas, +$3.636.500, +1 día. El telón muestra cuántas personas hay y qué asientos juega un humano o un bot                                                                                                  |
| 0:30–1:50 | **Momento central, hecho por una persona real** en el asiento de Camila. Se rotula «esta pregunta la sembramos». Toca «Me afecta»; Paula valida, o vence su plazo y queda «sin validar». La propuesta pasa a ronda 2 y el costo sube de X a Y con su rótulo. «La afectada que la lista no incluía se declaró con nombre y el sistema recalculó el costo» |
| 1:50–2:40 | **El silencio se ve.** Daniela no responde y un plazo de demo de 15 s corre a la vista. El telón dice «sin respuesta: Daniela» con la hora. Nada se fusiona y lo que usa el valor viejo queda «en uso con dato desactualizado», con su dueño. Si no cabe en el cronómetro, el presentador vence el plazo con un botón rotulado                           |
| 2:40–3:00 | Cierre con el registro de proceso al tocar la cifra. «Lo vigente es lo que confirmaron quienes dependen de ello.»                                                                                                                                                                                                                                        |

X e Y no existen todavía: el presupuesto tiene cuatro partidas y ninguna es de canalizaciones en losas (`apps/api/src/scenario/los-aromos.ts:139-174`). Para que la declaración de Camila mueva el costo hace falta una partida nueva en `budgetItems`, una dependencia con `measures` que la mida y su precio en `documents.ts`. Además, `analyzeChange` trabaja sobre un `ProjectGraph` fijo (`context/impact/src/domain/analyzeChange.ts:221-224`, `context/impact/src/infra/adapters/InMemoryProjectGraph.ts:4-11`): sumar una dependencia declarada exige pasarle un grafo extendido.

## Objeciones

El estado dice cómo queda cada objeción con la idea y el plan; nada de esto está construido.

| Objeción                                               | Quién la levantó         | Estado          | Cómo se trata                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La unanimidad bloquea: un afectado mudo es un veto     | Los tres detractores     | Abierta         | El silencio se ve, pero sigue bloqueando. El consentimiento por objeción queda como decisión del equipo                                                                                                                        |
| Lo multijugador es teatro: corre igual con bots        | Jurado, ingeniero        | Abierta         | Una persona real hace el momento central y se ensaya con humanos. Se admite que con bots corre igual                                                                                                                           |
| El momento central es circular                         | Los tres, en el crisol   | Mitigada        | Se rotula lo sembrado y la frase no promete descubrimiento                                                                                                                                                                     |
| El incentivo para alzar la mano puede ser negativo     | Veterano de obra         | Riesgo aceptado | No se promete adopción. Falta conversar con una ITO u oficina técnica; no hay nada agendado                                                                                                                                    |
| Quien valida reinstala el defecto que se quiere romper | Crisol                   | Mitigada        | Plazo, nota visible y entrada «sin validar» si calla                                                                                                                                                                           |
| Los hechos se escriben a mano                          | Ronda 0                  | Mitigada        | El ETL (`apps/etl`) lee archivos reales del lago ficticio (CSV, texto, Markdown y JSON) con parsers deterministas. Leer planos en PDF o con un modelo de lenguaje sigue fuera de la muestra                                    |
| El registro choca con la responsabilidad legal         | Veterano de obra, jurado | Mitigada        | El sistema propone y no decide; el registro anota proceso, no culpa                                                                                                                                                            |
| Detectar y avisar no es novedad                        | Jurado, ingeniero        | Mitigada        | Se vende el mecanismo de mano alzada, como hipótesis                                                                                                                                                                           |
| Sin «por qué ahora» ni modelo de negocio               | Jurado                   | Riesgo aceptado | Una hipótesis de una frase, si entra al pitch                                                                                                                                                                                  |
| Sumar revisores rompe el consenso                      | Ingeniero                | Mitigada        | Operación nueva que reinicia todos los votos; spike de 1 h y corte a las 6 h                                                                                                                                                   |
| Un humano que no vota congela la sala                  | Ingeniero, jurado        | Abierta         | Sigue pasando: la API no deja que el ETL vote por un asiento con una persona presente (409 `seat_held`) y el paso del ETL espera a que la propuesta se resuelva. En modo interactivo, el presentador corta la espera con Enter |
| Carga con 30 celulares                                 | Jurado, auditoría        | Abierta         | Sin medir hasta correr un script de 30 clientes que sondean                                                                                                                                                                    |
| Demasiadas mecánicas para 3 minutos                    | Jurado                   | Riesgo aceptado | Tres tramos duros; se confirma cronometrando                                                                                                                                                                                   |
| La cascada no cierra                                   | Crisol                   | Resuelta        | Un solo nivel                                                                                                                                                                                                                  |

## Calidad y soporte del producto

### Lo que ya está y lo que falta

| Pieza                                          | Estado  | Evidencia o alcance                                                                                                                                             | Horas |
| ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Afectados, costo y plazo por reglas            | Listo   | `analyzeChange.ts:221`, `criticalPath` en `context/impact/src/domain/schedule.ts:19`                                                                            | 0     |
| Consenso, reapertura y reemplazo de propuestas | Listo   | `Proposal.ts:54-96`; `OpenProposal` reemplaza propuestas del mismo sujeto y atributo (`context/lake/src/application/use-cases/OpenProposal.ts:42-48`, `:62-72`) | 0     |
| Procedencia y desfase                          | Listo   | `buildProvenance.ts:60`, `computeStaleness.ts:54`                                                                                                               | 0     |
| Asientos, consola y ETL (guion y jugadores)    | Listo   | Sin prueba con 30 clientes                                                                                                                                      | 0     |
| Declaración con autor, hora y validación       | Falta   | Hecho «usa» declarado, plazo, nota y grafo extendido en `impact`                                                                                                | 6     |
| Ronda 2 con revisor nuevo                      | Falta   | `RecordReview` exige que el votante ya esté en la propuesta (`context/lake/src/application/use-cases/RecordReview.ts:36-40`)                                    | 8–9   |
| Partida y dependencia de Camila en el catálogo | Falta   | Partida, `measures` y precio en `los-aromos.ts` y `documents.ts`                                                                                                | 1–2   |
| Silencio por asiento                           | Parcial | La presencia existe; falta el plazo y el estado «sin respuesta»                                                                                                 | 3–5   |
| Presencia en el telón                          | Parcial | `present`, `occupied` y `bot` ya llegan a la web (`apps/web/src/lib/room-api.ts:16-18`); el telón no los usa                                                    | 2     |
| Registro de proceso con declarante y silencio  | Parcial | Extender `buildProvenance` y `ProvenanceDrawer`                                                                                                                 | 2     |

Los tests unitarios pasan todos. Ninguno corre contra Postgres: el único test de controller es el de health, con Prisma simulado, y `SeatsService` tiene tests con Prisma simulado, pero no hay tests de `CoordinationService`. El ETL tiene su test de oro (cada archivo del lago produce los hechos esperados) y tests de sus jugadores con un `fetch` falso.

### Bloqueadores de la demo

| Bloqueador                                     | Evidencia                                                                                                             | Efecto                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `crypto.randomUUID` sin alternativa            | `apps/web/src/lib/http.ts:29`                                                                                         | Solo existe con HTTPS o en localhost: un celular que entra por `http://<IP de la LAN>` no puede votar |
| El QR codifica el origen del telón             | `apps/web/src/components/sala/JoinQr.tsx:7`                                                                           | Con el telón en localhost nadie entra; por la IP de la LAN se cae en el bloqueador anterior           |
| El telón no muestra personas                   | Ningún componente de `apps/web/src/components/sala/` usa `present`, `occupied` ni `bot`                               | Lo multijugador no se ve. La presencia solo aparece en la portada y en la consola del presentador     |
| Un humano presente que no vota congela la sala | `seat_held` en `apps/api/src/modules/room/seats.service.ts` y la espera de cada paso en `apps/etl/src/cli/session.ts` | La propuesta queda abierta y el ETL espera hasta que la persona vote o su asiento deje de latir       |
| Sin límites de error ni de carga por ruta      | En `apps/web/src/app` solo existe `not-found.tsx`                                                                     | Un error de render tumba la pantalla completa; los componentes cubren carga y error con `LoadState`   |
| Sin tests de integración                       | `apps/api/tests` no toca Postgres                                                                                     | Votos simultáneos, reclamos de asiento y reinicios no están probados                                  |

### Docs desalineados

- `README.md` y `project-description.md` venden «detectar, calcular y avisar» y no mencionan la sala ni el consenso.
- `docs/multijugador.md` describe el consenso de los afectados avisados, no del elenco completo: «unánime» se refiere a los revisores de cada propuesta.

## Plan

Los segmentos llevan el prefijo M para no chocar con los de [muestra](muestra.md#segmentos) ni los de [multijugador](multijugador.md#segmentos-de-construcción).

| Segmento            | Alcance                                                                                                                                                                   | Horas | Aceptación                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| M0 Estabilizar      | Alternativa a `randomUUID` o despliegue con HTTPS, URL pública del QR, `error.tsx` y `loading.tsx`, tests contra Postgres y script de 30 clientes                         | 4     | 30 clientes sondean 5 minutos y un voto se refleja en menos de 2 s; un celular externo vota         |
| M1 Ronda 2          | Spike de 1 h con una función de dominio que agrega un revisor y reinicia los votos; después declaración, validación, partida de Camila y grafo extendido. Corte a las 6 h | 9     | Camila declara, el costo pasa de X a Y y todos los votos se reinician; `decideProposal` sin cambios |
| M2 Silencio visible | Plazo de demo con cuenta regresiva, «sin respuesta» derivado en lectura y botón del presentador                                                                           | 3     | Con un asiento que no responde, el telón dice «sin respuesta» y no fusiona                          |
| M3 Registro         | Extender `buildProvenance` y `ProvenanceDrawer` con declarante, validación y silencio; alias de rol para el público                                                       | 2     | Al tocar la cifra aparecen quién declaró, quién validó y quién calló                                |
| M4 Presencia        | Avatares de humano y bot y contador de personas en el telón                                                                                                               | 2     | Con 0, 2 o 30 personas la demo sigue viva                                                           |
| M5 Entrega y ensayo | Alinear `README.md`, `project-description.md` y los docs; tres ensayos cronometrados                                                                                      | 3     | Tres ensayos de 3 minutos sin intervención fuera del botón                                          |

Suma 23 h. Quedan fuera desde ya la vista previa en seco, el impacto apilado de dos cambios y los espectadores con rol propio. M0 y el ensayo no se cortan. Si la ronda 2 no cierra a las 6 h, el plan B es que una propuesta nueva con el alcance corregido reemplace a la anterior vía `OpenProposal`, que ya reemplaza propuestas del mismo sujeto y atributo; bajar a «recalcula sin reabrir» vuelve falsa la frase final del pitch.

## Decisiones para el equipo

1. **¿Se adopta Mano alzada?** Si sí, se alinean [negocio](negocio.md), [muestra](muestra.md), [multijugador](multijugador.md), `README.md` y `project-description.md`.
2. **¿Quién valida una declaración?** En el lago, el dueño de un valor es quien escribió la revisión que lo respalda: Fernanda, para la losa. El guion usa a Paula, que es la calculista.
3. **La regla del declarante.** Aprobar la de [Reglas](#reglas) antes de construir.
4. **Plan B de la ronda 2.** Propuesta nueva que reemplaza a la anterior, o cortar.
5. **X e Y.** Definir la partida de canalizaciones en losas y su precio, con un test de `impact` sobre el grafo extendido. Sin cifras no se puede ensayar.
6. **Consentimiento por objeción.** Resolvería el bloqueo de la unanimidad, pero cambia la tesis. ¿Se ofrece como visión (unanimidad en valores críticos, plazo y objeción en el resto) o se deja fuera?
7. **¿Quién ve el registro de una declaración?** Puede proteger o exponer a quien avisó.
8. **Conversación con una ITO u oficina técnica** antes del pitch. Sin ella no se habla de adopción.
9. **Modelo de negocio.** Hipótesis de una frase (paga la constructora; subcontratistas e ITO entran gratis): ¿va en el pitch?
10. **Acceso desde celulares.** Despliegue con HTTPS o alternativa a `randomUUID` para entrar por la red local.
11. **Ensayo.** Cuántas personas hacen falta para tener dos humanos reales en asientos distintos.

## Textos para la entrega (borrador)

Antes de editar `README.md` y `project-description.md`, hay que leer sus reglas.

**One-liner.** Cuando cambia una decisión de obra, el sistema calcula a quién afecta y cualquiera puede alzar la mano si falta alguien. Lo vigente cambia solo cuando confirman todos los que dependen de ello, y callar queda a la vista.

**Descripción.** En un proyecto de construcción, cuando alguien cambia una decisión, los equipos que dependen de ella no siempre se enteran a tiempo ni saben qué actualizar. Nuestra muestra, sobre un proyecto ficticio con fuentes y canales simulados, calcula con reglas a quién afecta un cambio y deja que cualquier persona de la obra alce la mano si falta alguien, con su nombre y su hora. El costo se recalcula y se muestra con su origen. Lo vigente solo cambia cuando confirman todos los afectados, y el silencio nunca aprueba: se ve quién no respondió y qué sigue usando el dato desactualizado. El público toma asientos desde el celular y bots deterministas juegan los que quedan vacíos; lo sembrado del guion se dice en voz alta.
