import type { SheetSnapshot } from '../src/domain/Sheet.ts';

export const BUDGET: SheetSnapshot = {
  tabs: [
    {
      title: 'Partidas',
      rows: [
        ['Código', 'Descripción', 'Precio unitario', 'Unidad'],
        ['03.02', 'Hormigón H30 en losas', 145000, 'm³'],
        ['03.03', 'Acero de refuerzo en losas', 1350, 'kg'],
      ],
    },
    { title: 'Notas', rows: [['Revisado por Daniela']] },
  ],
};
