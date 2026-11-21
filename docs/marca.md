# Marca

El producto se llama **Vigente**: lo que vale hoy en la obra. El nombre responde la pregunta que nadie sabe contestar en un proyecto, qué versión vale, y sirve tanto para el aviso como para el consenso de la [sala](multijugador.md).

## Nombre

- En el texto se escribe «Vigente»; en el logotipo, «vigente», en minúsculas.
- Es el `project-name` de la página de votación ([`platanus-hack-project.jsonc`](../platanus-hack-project.jsonc)) y el `APP_NAME` de la web ([`apps/web/src/lib/brand.ts`](../apps/web/src/lib/brand.ts)), que cierra el título de cada pestaña: «La sala · Vigente».
- «La sala» es el nombre de la pantalla multijugador, no del producto.
- Frase: «Lo que vale hoy en tu obra».
- El nombre no está revisado en el registro de marcas de INAPI.

## Isotipo

El triángulo de revisión de los planos, dado vuelta: forma una V y deja adentro, relleno, la revisión que vale. Se dibuja en una grilla de 64 × 64. El contorno es un trazo de 6 con uniones redondas, y el triángulo interior es el exterior a escala 0,35 desde su centroide.

## Logotipo

«vigente» en [Archivo](https://fonts.google.com/specimen/Archivo) (licencia OFL) a ancho 112 y peso 750, con −0,02 em de espaciado, convertido a trazos. No depende de que la fuente esté instalada.

## Color

| Uso                        | Color                                    |
| -------------------------- | ---------------------------------------- |
| Isotipo en modo claro      | `#256abf`, el `accent` del tema          |
| Isotipo en modo oscuro     | `#6da7ec`, el `accent-text` oscuro       |
| Logotipo                   | `ink` del tema                           |
| Fondo de la ficha cuadrada | `#1c5cab`, con una grilla blanca al 13 % |

El azul es el de un plano y es el mismo del [tema](../packages/ui/README.md#tema): la marca no agrega colores.

## Archivos

| Archivo                                                     | Qué es                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`packages/ui/src/Brand.tsx`](../packages/ui/src/Brand.tsx) | `BrandMark` (isotipo, decorativo) y `BrandWordmark` (logotipo, con nombre accesible), los dos en `currentColor` |
| [`apps/web/src/app/icon.svg`](../apps/web/src/app/icon.svg) | El favicon: el isotipo, que cambia de azul según el modo del navegador                                          |
| [`docs/marca/logo.svg`](marca/logo.svg)                     | Isotipo y logotipo en horizontal, para fondo claro: láminas y presentaciones                                    |
| [`docs/marca/ficha.svg`](marca/ficha.svg)                   | La ficha cuadrada de 1000 × 1000                                                                                |
| [`project-logo.png`](../project-logo.png)                   | La ficha exportada a PNG para la entrega, que pide 1000 × 1000 y máximo 500 KB                                  |

Para regenerar el PNG, exporta `docs/marca/ficha.svg` a 1000 × 1000 con cualquier rasterizador de SVG (sharp, Inkscape o `rsvg-convert`).

## En la web

El encabezado del sitio y la cabecera de la sala muestran el isotipo en `text-accent-text` y el logotipo en `text-ink`. La sala es lo que se proyecta en el pitch.
