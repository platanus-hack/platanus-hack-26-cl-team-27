# tool-use-case

Conectores reales con el software donde ocurre el cambio. Cada uno captura el cambio en la herramienta del autor y lo manda a la API, sin que nadie lo reporte a mano ([HU-02](../docs/negocio.md#historias-de-usuario)). No son parte de Nx ni de pnpm: `pnpm check` no los compila.

| Carpeta              | Qué es                                                                                                                                   | Doc                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| [`revit/`](./revit/) | Add-in de Revit 2025, 2026 y 2027 en C#: al guardar el modelo arma la minuta de cambios y la manda a `POST /api/integrations/revit/minutes` | [revit/README.md](./revit/README.md) |
