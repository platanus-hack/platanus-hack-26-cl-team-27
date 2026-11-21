# @team27/web

El panel del proyecto: Next.js 16 (App Router, Turbopack), React 19 y Tailwind 4, con el tema y los componentes de [`@team27/ui`](../../packages/ui/README.md). Los datos los pide a la [API](../api/README.md).

## Comandos

```sh
pnpm dev:web                          # http://localhost:3000 (o pnpm dev, con la API)
pnpm nx run @team27/web:build         # typecheck de sus dependencias y next build
pnpm nx run @team27/web:start         # sirve el build
pnpm nx run @team27/web:lint
pnpm nx run @team27/web:test          # Vitest: los *.spec.ts de src/
```

## Estructura

```
src/
├── app/
│   ├── layout.tsx         encabezado y contenedor de todas las páginas
│   ├── page.tsx           el panel (/): por ahora, el estado de la API y de la base
│   ├── not-found.tsx      404
│   ├── globals.css        Tailwind, el tema de @team27/ui y su @source
│   └── icon.svg           favicon
└── lib/
    ├── api.ts             llamadas a la API desde el servidor (API_URL), con su api.spec.ts
    └── brand.ts           nombre y bajada del proyecto
```

- `@/*` apunta a `src/*`.
- `next.config.ts` reenvía todo `/api/*` a `API_URL` y transpila los paquetes del workspace (`transpilePackages`). Por eso la web no define rutas en `app/api/`.
- Los tests van junto al código (`*.spec.ts`) e importan `describe`, `it` y `vi` desde `vitest`, para que los tipe el mismo `tsconfig.json` de la app.
