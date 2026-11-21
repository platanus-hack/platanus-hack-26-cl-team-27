# La muestra

Lo que mostramos en la hackatón es un proyecto ficticio con un elenco fijo:

- Sus documentos viven repartidos en cinco espacios: el Drive, la carpeta de costos, el correo, el WhatsApp de la obra y el libro de obra.
- Cada revisión nueva llega sola al lago de hechos.
- Lo que contradice lo vigente se vuelve una propuesta que solo revisan los afectados, con su costo y su plazo, cada uno en su canal.
- Lo vigente cambia cuando todos confirman.

No es un MVP: es una muestra en un espacio controlado. El problema y la propuesta están en [negocio](negocio.md). Cómo funcionan el lago, el consenso y la sala está en [multijugador](multijugador.md), y cómo está construido, en [arquitectura](arquitectura.md#coordinación-de-un-cambio).

## Qué demuestra

| Historia                                                              | Cómo se ve en la muestra                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [HU-02](negocio.md#historias-de-usuario) · captura sin reporte        | Llega el plano E-102 rev C al Drive y el cambio aparece solo, sin que nadie lo informe                                           |
| [HU-03](negocio.md#historias-de-usuario) · solo lo que impacta        | De siete personas, avisamos a tres o cuatro. Las demás no reciben nada, y quien queda fuera por la holgura ve por qué            |
| [HU-04](negocio.md#historias-de-usuario) · en su canal                | Cada aviso llega con el look del canal de su destinatario: correo, WhatsApp o Slack                                              |
| [HU-05](negocio.md#historias-de-usuario) · resumen, costo, plazo      | El aviso trae el cambio, lo que le toca a esa persona, el costo y el plazo calculados, y el enlace al detalle                    |
| [HU-06](negocio.md#historias-de-usuario) · respuesta                  | El afectado responde «Revisado» o «Tengo un problema» desde su celular                                                           |
| [HU-07](negocio.md#historias-de-usuario) · quién falta                | El telón muestra quién aprobó, quién disputó y a quién le falta responder                                                        |
| [HU-08](negocio.md#historias-de-usuario) · lo vigente por consenso    | La losa sigue en 15 cm mientras Paula disputa; pasa a 20 cm cuando todos aprueban                                                |
| [HU-09](negocio.md#historias-de-usuario) · una fuente débil no decide | El WhatsApp que dice «150 cm» solo abre una discrepancia para Fernanda; el plano A-201 rev C la respalda y recién ahí se propone |
| [HU-10](negocio.md#historias-de-usuario) · documentos desfasados      | Al fusionarse la losa, la EETT, el presupuesto y la Carta Gantt quedan desfasados, cada uno con su dueño                         |
| [HU-11](negocio.md#historias-de-usuario) · de dónde salió un valor    | Tocar «20 cm» muestra el plano, el espacio, la autora y las aprobaciones con hora y nota                                         |

## El flujo de 4 pasos

El camino del pitch es un solo caso con dos personas reales y sin bots: Paula Rojas mueve el pilar P-12, Vigente detecta que pisa la bandeja E-B-03 de Camila Vera y propone correrla 40 cm, y Camila acepta. Corre en `/caso/paula-rojas`, `/caso/camila-vera` y `/caso` (presentador), sobre `/api/flow`. El caso, los textos y las cifras están en [docs/spec/fuente-de-verdad.md](spec/fuente-de-verdad.md); la API, en [apps/api/README.md](../apps/api/README.md); la web, en [apps/web/README.md](../apps/web/README.md).

## Espacio controlado

- **Todo es ficticio.** El proyecto, el elenco, sus contactos y sus documentos son inventados. Los correos usan el dominio `.example` y los teléfonos, `0000`.
- **Nada sale de la app.** Los canales son maquetas dentro de la web: no se manda ni un correo, mensaje o post real.
- **La API no conoce la demo.** Recibe revisiones de documentos por `POST /api/revisions`, como de cualquier conector.
- **El único componente simulado es el ETL** ([`apps/etl`](../apps/etl/README.md)). Cumple dos papeles:
  - **Conectores:** lee los archivos del lago ficticio y los carga a la API, partidos en fragmentos. De los documentos estructurados (planos, EETT, planillas) extrae los hechos con parsers deterministas. El texto libre (WhatsApp, libro de obra, actas) lo manda tal cual.
  - **Personas ausentes:** juega los asientos que nadie tomó.
- **El texto libre lo lee la API con `context/impact`.**
  - **Con `ANTHROPIC_API_KEY` en el `.env`:** lo lee Claude, y la primera lectura queda grabada para repetirse igual.
  - **Sin la clave** (en `.env.example` va vacía): la lectura es **determinista**, con respuestas fijas y grabadas, y nada sale a la red.
  - En los dos casos, cada hecho queda con su confianza, y lo que no alcanza 0,7 se ve pero no tiene efecto.
- **Revit es el conector real.** El add-in de [`tool-use-case/revit`](../tool-use-case/revit/README.md) manda la minuta de cambios cada vez que se guarda el modelo, y la API la ingiere por el mismo camino.
- **Los números salen de reglas.** Cantidades, precios unitarios y ruta crítica; ningún modelo de lenguaje los inventa. El mismo guion da siempre el mismo resultado.
- **Sin gestión de equipos ni organizaciones.** No hay usuarios ni permisos.
  - El elenco, el grafo del proyecto y el registro de documentos con sus dueños están en la base. En local se siembran con `pnpm db:seed` desde [`data/main/seed/los-aromos.ts`](../data/main/seed/los-aromos.ts).
  - Un celular toma un asiento del elenco sin cuenta.
- **Se reinicia en un paso.** `pnpm etl reiniciar` vacía la sala y hace la carga inicial.

## El proyecto: Edificio Los Aromos

Cinco pisos y veinte departamentos en Ñuñoa, en obra gruesa.

| Elemento                  | Lo vigente al empezar                                  |
| ------------------------- | ------------------------------------------------------ |
| Losas nivel 2 a 5         | Espesor 15 cm · área 280 m² · hormigón H30             |
| Losa de cubierta          | Igual que las otras losas                              |
| Shaft de instalaciones S1 | A 6 m del eje A · 80 × 120 cm · del nivel 1 a cubierta |
| Ventanas fachada norte    | 24 ventanas de 120 × 150 cm · PVC termopanel           |

- **Plazo:** 108 días. La ruta crítica pasa por:
  1. las fundaciones;
  2. las losas y los muros de cada nivel;
  3. la cubierta;
  4. las instalaciones del shaft;
  5. las terminaciones;
  6. la recepción.

  Las ventanas quedan fuera de la ruta crítica, con 38 días de holgura.

- **Presupuesto:** cuatro partidas:

  | Partida                                | Precio                    |
  | -------------------------------------- | ------------------------- |
  | 03.02 Hormigón H30 en losas            | $145.000/m³               |
  | 03.03 Acero de refuerzo en losas       | $1.350/kg, a 85 kg por m³ |
  | 05.04 Perforaciones y sellos del shaft | $95.000/m², en 6 losas    |
  | 07.01 Ventanas de PVC termopanel       | $185.000/m²               |

## Los espacios y sus documentos

| Espacio                  | Dueño    | Documentos                                                            |
| ------------------------ | -------- | --------------------------------------------------------------------- |
| Drive del proyecto       | Fernanda | Planos A-201 y E-102, EETT-03 (de Paula) y el acta de coordinación 12 |
| Carpeta de costos        | Daniela  | Presupuesto itemizado y Carta Gantt (de Marcos)                       |
| Correo de Quillay        | Quillay  | Cotización Q-118                                                      |
| WhatsApp Obra Los Aromos | Marcos   | Mensajes del grupo                                                    |
| Libro de obra            | Marcos   | Folios                                                                |

En el ETL, cada espacio es una carpeta de `apps/etl/lago/` con archivos reales: los planos en JSON con cuadro de rotulación, la EETT en Markdown, el presupuesto, la Gantt y la cotización en CSV, y el acta, el WhatsApp y los folios en texto.

## El elenco

| Persona          | Rol                      | Canal                       | Recibe avisos cuando cambia…                                |
| ---------------- | ------------------------ | --------------------------- | ----------------------------------------------------------- |
| Fernanda Lagos   | Arquitecta, presentadora | —                           | Recibe las discrepancias de los valores que ella respalda   |
| Paula Rojas      | Ingeniera calculista     | Correo                      | El espesor de una losa, el shaft o el ancho de las ventanas |
| Marcos Fuentes   | Jefe de obra             | WhatsApp                    | La fecha de entrega (solo si se mueve)                      |
| Daniela Soto     | Control de costos        | Slack, `#costos-los-aromos` | El presupuesto (solo si cambia)                             |
| Javier Muñoz     | Instalaciones sanitarias | WhatsApp                    | El espesor de una losa o el shaft                           |
| Camila Vera      | Instalaciones eléctricas | Slack, `#instalaciones`     | El shaft                                                    |
| Tomás Reyes      | Terminaciones            | Correo                      | Las medidas de las ventanas                                 |
| Ventanas Quillay | Proveedor de ventanas    | Correo                      | Las medidas de las ventanas                                 |

## El guion

El ETL parte con la **carga inicial**: lee los 10 documentos de partida (entre ellos el plano IS-301 rev A, con el colector B2 a 10 m) y siembra lo vigente, con 16 valores confirmados y 10 de 10 documentos al día. Cada revisión llega como fragmentos: los estructurados traen sus hechos y los de texto libre (WhatsApp, libro de obra y acta) los lee la API con inferencia. Después, cada paso trae una revisión nueva:

| Paso | Llega                           | Qué pasa                                                                                                                                                                                                                                                                                                       | Al día   |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| s1   | Plano E-102 rev C (Drive)       | Propuesta: losa N3 de 15 a 20 cm. Avisa a 4 de 7 (Paula, Javier, Daniela y Marcos), +$3.636.500 y +1 día. Paula disputa, Fernanda reabre, Paula aprueba: pasa a lo vigente. La EETT, el presupuesto y la Gantt quedan desfasados                                                                               | 7 de 10  |
| s2   | Presupuesto v3 (Costos)         | Daniela pone al día su presupuesto                                                                                                                                                                                                                                                                             | 8 de 10  |
| s3   | Mensaje 2 (WhatsApp)            | «Las ventanas del norte quedaron en 150»: no manda, solo abre una discrepancia para Fernanda                                                                                                                                                                                                                   | 7 de 10  |
| s4   | Plano A-201 rev C (Drive)       | Respalda el mensaje y propone ventanas de 120 a 150 cm: 4 de 7 (Quillay, Paula, Tomás y Daniela), +$1.998.000. Marcos no recibe aviso: 38 días de holgura. La cotización Q-118 queda desfasada                                                                                                                 | 7 de 10  |
| x1   | Folio 44 (libro de obra)        | El shaft S1 se corre a 8,5 m: otra discrepancia para Fernanda                                                                                                                                                                                                                                                  | 6 de 10  |
| x2   | Plano A-201 rev D (Drive)       | Respalda el folio y propone el shaft: 3 de 7 (Paula, Javier y Camila), sin costo ni plazo. A 8,5 m el shaft cae en la celda C-D/3 del nivel 3, donde pasa el colector B2 del IS-301 rev A: se abre un solapamiento que validan Fernanda y Javier. Javier vota que se tocan y la propuesta espera la validación | 7 de 10  |
| x3   | Plano IS-301 rev B (Drive)      | Javier mueve el colector B2 a 13,5 m (celda D-E/3) y el cambio se fusiona solo. El solapamiento queda resuelto y la propuesta del shaft, con sus aprobaciones, pasa a lo vigente                                                                                                                               | 7 de 10  |
| s5   | Cotización Q-118 rev 2 (Correo) | Quillay recotiza con 150 cm: el ancho queda corroborado desde dos espacios                                                                                                                                                                                                                                     | 8 de 10  |
| s6   | Carta Gantt v5 y EETT-03 rev B  | Marcos y Paula se ponen al día: **«Obra consensuada»**                                                                                                                                                                                                                                                         | 10 de 10 |

Al final queda la versión 5 del proyecto (la propuesta del colector suma una), con +$5.634.500 y +1 día, en un plazo de 109 días.

## Cómo correrla

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev          # API en :3001 y web en :3000
pnpm etl          # en otra terminal: carga inicial y luego Enter = paso siguiente
```

- **El telón:** `/sala`, en el proyector.
- **El presentador:** `/presentador`, con la clave de presentador (en desarrollo, `sala-los-aromos`, de `.env.example`). Desde ahí se ven los asientos, se reabren o retiran propuestas y se reinicia.
- **Los celulares:** cada uno elige su asiento en `/` y vota desde `/asiento/<id>`. Si una persona toma un asiento, el ETL no juega por ella.
- **El ETL:** `pnpm etl` es interactivo:
  - Enter: paso siguiente.
  - `a`: pasa a automático.
  - `o`: reabre las disputas.
  - `r`: reinicia.
  - `q`: sale.

  También están `pnpm etl auto --velocidad 1|2|4`, `pnpm etl paso <id>`, `pnpm etl estado` y `pnpm etl reiniciar`. A velocidad 4 el guion completo dura unos 20 segundos. Detalle en [`apps/etl/README.md`](../apps/etl/README.md).

## Segmentos

La muestra se construye por segmentos. Cada uno se cierra con sus tests, su doc y `pnpm check` en verde.

| Segmento             | Qué cubre                                                                                                              | Dónde                             | Estado                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Dominio y datos   | Cambio por elemento (`DetectChanges`), contextos `impact` y `notification`, tablas y migraciones                       | `context/*`, `data/main`          | Listo                                                                                             |
| 2. Lago y consenso   | Contexto `lake`: hechos, lo vigente, propuestas, discrepancias, desfases y procedencia                                 | `context/lake`, `apps/api`        | Listo                                                                                             |
| 3. Sala              | Asientos con token, eventos en tiempo real, época y reinicio                                                           | `apps/api`                        | Listo                                                                                             |
| 4. Web               | Telón, celular con look de canal, presentador, espacios, detalle del cambio y procedencia                              | `apps/web`                        | Listo                                                                                             |
| 5. ETL de la muestra | Lago de archivos, parsers, guion y jugadores, fuera de la API                                                          | `apps/etl`                        | Listo                                                                                             |
| 6. Conector de Revit | Add-in que manda la minuta de cambios al guardar el modelo, y la ruta que la ingiere                                   | `tool-use-case/revit`, `apps/api` | Falta probarlo dentro de Revit                                                                    |
| 7. Mano alzada       | Capa de probabilidad: quién más puede estar afectado y qué afirma un documento ([auditoría](auditoria.md#mano-alzada)) | `context/impact`                  | La capa existe y `ExtractClaims` ya lee el texto libre; falta conectar `SuggestAffected` a la API |
| 8. Pulido del pitch  | Ensayo cronometrado, acceso desde los celulares (despliegue o red local) y animaciones                                 | `apps/web`, `docs/`               | Pendiente                                                                                         |
