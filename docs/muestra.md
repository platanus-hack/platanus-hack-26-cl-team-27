# La muestra

Lo que mostramos en la hackatón: un proyecto ficticio, con un elenco fijo, en el que un cambio en el modelo de arquitectura llega solo a quien le impacta, con su costo y su plazo, en el canal de cada uno, y vuelve con la respuesta de cada afectado. No es un MVP: es una muestra en un espacio controlado. El problema y la propuesta están en [negocio](negocio.md); cómo está construida, en [arquitectura](arquitectura.md#coordinación-de-un-cambio).

## Qué demuestra

| Historia                                                         | Cómo se ve en la muestra                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [HU-02](negocio.md#historias-de-usuario) · captura automática    | La arquitecta publica una versión del modelo y el cambio aparece solo, sin que nadie lo reporte               |
| [HU-03](negocio.md#historias-de-usuario) · solo lo que impacta   | De siete personas, avisamos a tres o cuatro; las demás no reciben nada                                        |
| [HU-04](negocio.md#historias-de-usuario) · en su canal           | Cada aviso llega al canal de su destinatario: correo, WhatsApp o Slack                                        |
| [HU-05](negocio.md#historias-de-usuario) · resumen, costo, plazo | El aviso trae el cambio, lo que le toca a esa persona, el costo y el plazo calculados, y el enlace al detalle |
| [HU-06](negocio.md#historias-de-usuario) · respuesta             | El afectado responde «Revisado» o «Tengo un problema», y el autor lo ve                                       |

## Espacio controlado

- **Todo es ficticio.** El proyecto, el elenco y sus contactos son inventados: los correos usan el dominio `.example` y los teléfonos, `0000`.
- **Nada sale de la app.** El software de origen y los canales están simulados dentro de la web. No se manda ni un correo, mensaje o post real.
- **El software de origen es un editor del modelo.** Publica versiones a la API igual que lo haría un conector con un BIM real.
- **Revit es el conector real.** El add-in de [`tool-use-case/revit`](../tool-use-case/revit/README.md) arma la minuta de cambios cada vez que se guarda el modelo y la manda a `POST /api/integrations/revit/minutes`, que la ingiere como una revisión del «Modelo Revit de arquitectura» y corre la misma cadena que cualquier revisión que llega por `POST /api/revisions`.
- **Los números salen de reglas.** Cantidades, precios unitarios y ruta crítica; ningún modelo de lenguaje los inventa. El mismo guion da siempre el mismo resultado.
- **Sin gestión de equipos ni organizaciones.** El elenco, el grafo del proyecto y los atajos del guion vienen en [`apps/api/src/scenario/los-aromos.ts`](../apps/api/src/scenario/los-aromos.ts). No hay usuarios ni permisos.
- **La API no conoce la demo.** Los documentos de la muestra son archivos del lago ficticio que el ETL (`pnpm etl`, ver [`apps/etl/README.md`](../apps/etl/README.md)) lee y entrega a la API paso a paso, y el ETL juega a los asientos que nadie tomó.
- **Se reinicia en un paso.** `POST /api/room/reset` vacía la sala y el ETL hace la carga inicial.

## El proyecto: Edificio Los Aromos

Cinco pisos y veinte departamentos en Ñuñoa, en obra gruesa. El modelo de arquitectura es de **Fernanda Lagos**, la arquitecta, que es quien hace los cambios.

| Elemento                  | Propiedades base                                       | Se puede editar                  |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| Losas nivel 2 a 5         | Espesor 15 cm · área 280 m² · hormigón H30             | Espesor                          |
| Losa de cubierta          | Igual que las otras losas                              | Espesor                          |
| Shaft de instalaciones S1 | A 6 m del eje A · 80 × 120 cm · del nivel 1 a cubierta | Distancia al eje A, ancho, largo |
| Ventanas fachada norte    | 24 ventanas de 120 × 150 cm · PVC termopanel           | Ancho, alto                      |

- **Plazo:** 108 días. La ruta crítica va de las fundaciones a las losas y los muros de cada nivel, la cubierta, las instalaciones del shaft, las terminaciones y la recepción. Las ventanas quedan fuera de la ruta crítica, con 38 días de holgura.
- **Presupuesto:** cuatro partidas:

  | Partida                                | Precio                    |
  | -------------------------------------- | ------------------------- |
  | 03.02 Hormigón H30 en losas            | $145.000/m³               |
  | 03.03 Acero de refuerzo en losas       | $1.350/kg, a 85 kg por m³ |
  | 05.04 Perforaciones y sellos del shaft | $95.000/m², en 6 losas    |
  | 07.01 Ventanas de PVC termopanel       | $185.000/m²               |

## El elenco

| Persona          | Rol                      | Canal                       | Recibe avisos cuando cambia…                                |
| ---------------- | ------------------------ | --------------------------- | ----------------------------------------------------------- |
| Paula Rojas      | Ingeniera calculista     | Correo                      | El espesor de una losa, el shaft o el ancho de las ventanas |
| Marcos Fuentes   | Jefe de obra             | WhatsApp                    | La fecha de entrega (solo si se mueve)                      |
| Daniela Soto     | Control de costos        | Slack, `#costos-los-aromos` | El presupuesto (solo si cambia)                             |
| Javier Muñoz     | Instalaciones sanitarias | WhatsApp                    | El espesor de una losa o el shaft                           |
| Camila Vera      | Instalaciones eléctricas | Slack, `#instalaciones`     | El shaft                                                    |
| Tomás Reyes      | Terminaciones            | Correo                      | Las medidas de las ventanas                                 |
| Ventanas Quillay | Proveedor de ventanas    | Correo                      | Las medidas de las ventanas                                 |

## El guion

Tres cambios, cada uno con un resultado distinto. Cada uno tiene un atajo en el editor.

1. **Engrosar la losa del nivel 3, de 15 a 20 cm.** Avisa a 4 de 7:
   - **Paula:** el peso propio pasa de 3,75 a 5 kN/m². Debe revisar las vigas y pilares que la reciben.
   - **Javier:** las pasadas sanitarias que cruzan la losa cambian de largo.
   - **Daniela:** el presupuesto sube $3.636.500 (+14 m³ de hormigón y +1.190 kg de acero).
   - **Marcos:** el hormigonado pasa de 3 a 4 días y está en la ruta crítica, así que la entrega se corre 1 día.

   Camila, Tomás y Ventanas Quillay no reciben nada.

2. **Mover el shaft S1, de 6 a 8,5 m del eje A.** Avisa a 3 de 7: Paula (perforaciones en las losas), Javier (bajadas y ventilaciones) y Camila (montantes eléctricas). No cambia el costo ni el plazo, así que Daniela y Marcos no se enteran.
3. **Ensanchar las ventanas norte, de 120 a 150 cm.** Avisa a 4 de 7:
   - **Ventanas Quillay:** la superficie pasa de 43,2 a 54 m².
   - **Paula:** debe revisar los dinteles.
   - **Tomás:** los vanos cambian de medida.
   - **Daniela:** el presupuesto sube $1.998.000.

   **Marcos no recibe aviso, y el panel muestra por qué:** la instalación pasa de 4 a 5 días, pero tiene 38 días de holgura y la entrega no se mueve.

Para cerrar, un afectado responde desde su canal. Por ejemplo, Paula responde «Tengo un problema: necesito 2 días para recalcular», y el panel de la arquitecta lo muestra.

## Segmentos

La muestra se construye por segmentos. Cada uno se cierra con sus tests, su doc y `pnpm check` en verde antes de empezar el siguiente.

| Segmento               | Qué cubre                                                                                                                          | Dónde                             | Estado                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------ |
| 1. Dominio y datos     | Contextos `capture`, `impact` y `notification`, con sus tests; tablas y migración                                                  | `context/*`, `data/main`          | Listo                          |
| 2. API de coordinación | El guion, los módulos de Nest, la cadena captura → impacto → aviso, las rutas y el reinicio                                        | `apps/api`                        | Listo                          |
| 3. Web de la muestra   | Editor del modelo con atajos, feed de cambios con impacto, canales simulados con respuesta, detalle del cambio y vista por persona | `apps/web`                        | Pendiente                      |
| 4. Pulido del pitch    | Animación de la propagación, ensayo cronometrado del guion y despliegue                                                            | `apps/web`, `docs/`               | Pendiente                      |
| 5. Conector de Revit   | Add-in que arma la minuta de cambios al guardar el modelo, y la ruta de la API que la ingiere                                      | `tool-use-case/revit`, `apps/api` | Falta probarlo dentro de Revit |
