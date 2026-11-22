import { draftNotifications } from '../../src/domain/Notification.ts';
import type { Stakeholder } from '../../src/domain/Stakeholder.ts';

const STAKEHOLDERS: Stakeholder[] = [
  {
    id: 'calculista',
    name: 'Paula',
    role: 'Calculista',
    channel: 'email',
    handle: 'paula@obra.example',
  },
  {
    id: 'costos',
    name: 'Daniela',
    role: 'Costos',
    channel: 'slack',
    handle: '#costos',
  },
  {
    id: 'electricas',
    name: 'Camila',
    role: 'Eléctricas',
    channel: 'slack',
    handle: '#instalaciones',
  },
];

describe('draftNotifications', () => {
  it('arma un aviso por afectado, en su canal, juntando lo que le toca', () => {
    const drafts = draftNotifications(
      {
        projectId: 'edificio-norte',
        changeId: 'c1',
        title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
        findings: [
          {
            stakeholderId: 'costos',
            summary: 'Sube el costo',
            details: ['+$1'],
            action: 'Actualiza',
          },
          {
            stakeholderId: 'calculista',
            summary: 'Peso propio',
            details: [],
            action: 'Revisa',
          },
          {
            stakeholderId: 'costos',
            summary: 'Otra partida',
            details: [],
            action: 'Revisa',
          },
        ],
      },
      STAKEHOLDERS,
    );

    expect(
      drafts.map((draft) => [
        draft.stakeholderId,
        draft.channel,
        draft.findings.length,
      ]),
    ).toEqual([
      ['calculista', 'email', 1],
      ['costos', 'slack', 2],
    ]);
    expect(drafts[0]?.link).toBe('/proyectos/edificio-norte/cambios/c1');
    expect(drafts.map((draft) => draft.email)).toEqual([
      'paula@obra.example',
      null,
    ]);
  });

  it('ignora a quien no está en el directorio', () => {
    expect(
      draftNotifications(
        {
          projectId: 'edificio-norte',
          changeId: 'c1',
          title: 'x',
          findings: [
            { stakeholderId: 'nadie', summary: 's', details: [], action: 'a' },
          ],
        },
        STAKEHOLDERS,
      ),
    ).toEqual([]);
  });
});
