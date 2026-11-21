# @team27/ui

El tema y los componentes de React que comparten las apps. Se consume como TypeScript (`exports` apunta a `src/`): no se compila aparte.

## Uso

En el CSS global de la app:

```css
@import 'tailwindcss';
@import '@team27/ui/theme.css';
@source '<ruta relativa>/packages/ui/src';
```

En `next.config.ts`, agrega `'@team27/ui'` a `transpilePackages`.

## Tema

`src/theme.css` define los tokens como variables CSS, con su valor claro y oscuro. El modo oscuro sigue a `prefers-color-scheme`, y `data-theme="light"` o `data-theme="dark"` en `<html>` lo fuerzan. Tailwind los expone como utilidades: `bg-surface`, `text-ink-2`, `border-hairline`, `bg-accent`, `bg-series-1`…

| Tokens | Para qué |
|---|---|
| `plane`, `surface`, `surface-2` | Fondo de página, tarjetas y relleno suave |
| `ink`, `ink-2`, `ink-3` | Texto principal, secundario y de ejes |
| `hairline`, `grid`, `axis` | Bordes, grillas y líneas base de gráficos |
| `accent`, `accent-strong`, `accent-soft`, `accent-text`, `on-accent` | Botones, foco, navegación activa y enlaces; contraste AA en los dos modos |
| `series-1` a `series-3` | Colores categóricos de gráficos (azul, naranjo, aqua), validados para daltonismo en ambos modos. El aqua claro queda bajo 3:1 sobre la superficie: siempre va con etiquetas visibles |
| `good`, `warning`, `serious`, `critical` | Estados. Siempre con ícono y texto, nunca solo color |

## Componentes

| Componente | Qué es |
|---|---|
| `Button` | Variantes `primary`, `secondary`, `ghost`, `danger`; tamaños `sm` y `md` |
| `Card`, `PageHeader` | Tarjeta con título, descripción y acciones; encabezado de página |
| `Field`, `Input`, `Select` | Campos de formulario con etiqueta |
| `Notice` | Aviso `info`, `success` o `error` |
| `StatTile`, `formatCount` | Un número con su etiqueta (compacta desde 10.000) |
| `StatusBadge` | Estado con ícono y texto |
| `SplitBar` | Un total repartido en hasta 3 partes, con la lista de nombres, cifras y porcentajes |
| `ColumnChart` | Columnas de una serie, con tooltip al pasar o enfocar, etiqueta del máximo y del último, y la tabla equivalente |
| `cx` | Une clases condicionales |
