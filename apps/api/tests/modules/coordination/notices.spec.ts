import { ExplainNotices, type ReasonWriter } from '@team27/context-impact';
import type { Notification } from '@team27/context-notification';

import {
  chooseReasonWriter,
  MISSING_REASON_MESSAGE,
} from '../../../src/modules/impact/reason-writer.ts';
import {
  estimatedClashes,
  noticePreviews,
  reasonsFor,
} from '../../../src/modules/coordination/notices.ts';
import { project } from '../../project.ts';

const [first, second] = project.stakeholders;
if (!first || !second) throw new Error('El proyecto de prueba no tiene equipo');

const notificationFor = (stakeholderId: string): Notification => ({
  id: `n-${stakeholderId}`,
  changeId: '00000000-0000-4000-8000-000000000001',
  stakeholderId,
  channel: 'email',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  findings: [
    {
      topic: 'dependency',
      summary: 'Cambia el peso propio de la losa nivel 3',
      details: ['Peso propio: 3,75 → 5 kN/m² (+1,25)'],
      action: 'Revisa vigas bajo la losa nivel 3',
    },
  ],
  link: '/proyectos/p/cambios/00000000-0000-4000-8000-000000000001',
  context: null,
  sentAt: new Date('2026-11-22T12:00:00Z'),
  response: null,
});

const notifications = [notificationFor(first.id), notificationFor(second.id)];

const change = {
  id: '00000000-0000-4000-8000-000000000001',
  subjectId: 'losa-n3',
  summary: 'Losa nivel 3 (modified) · Espesor: 15 → 20 cm',
  detectedAt: '2026-11-22T12:00:00Z',
};

const clash = {
  with: 'Shaft S1',
  question: '¿La pasada del shaft corta el refuerzo?',
  combined: { costDelta: 3_636_500, delayDays: 1 },
};

describe('el porqué de cada aviso', () => {
  it('sin clave de Claude ni de Gemini no falla: no hay frases y lo dice', async () => {
    const { writer, mode } = chooseReasonWriter(undefined, {
      apiKey: undefined,
    });

    expect(mode).toBe('unavailable');
    await expect(writer.write({ change, recipients: [] })).rejects.toThrow(
      MISSING_REASON_MESSAGE,
    );
    expect(
      await reasonsFor(
        new ExplainNotices(writer),
        change,
        project,
        notifications,
      ),
    ).toEqual({ reasons: [], inference: 'unavailable' });
  });

  it('le pasa al modelo el nombre, el rol y los hallazgos de cada persona', async () => {
    const writer: ReasonWriter = {
      write: vi
        .fn<ReasonWriter['write']>()
        .mockResolvedValue([
          { stakeholderId: first.id, why: 'Tus vigas sostienen esta losa.' },
        ]),
    };

    const result = await reasonsFor(
      new ExplainNotices(writer),
      change,
      project,
      notifications,
    );

    expect(writer.write).toHaveBeenCalledWith({
      change,
      recipients: [first, second].map((member) => ({
        stakeholderId: member.id,
        name: member.name,
        role: member.role,
        findings: ['Cambia el peso propio de la losa nivel 3'],
      })),
    });
    expect(result).toEqual({
      reasons: [
        { stakeholderId: first.id, why: 'Tus vigas sostienen esta losa.' },
      ],
      inference: 'ok',
    });
  });
});

describe('la vista previa de los avisos de un cambio', () => {
  it('rinde un aviso por persona en su canal, con el choque y el impacto', () => {
    const previews = noticePreviews({
      project,
      notifications,
      impact: { costDelta: 3_636_500, delayDays: 1 },
      clashes: [clash],
      reasons: [
        { stakeholderId: first.id, why: 'Tus vigas sostienen esta losa.' },
      ],
      baseUrl: 'https://vigente.example',
    });

    expect(
      previews.map((preview) => [
        preview.stakeholderId,
        preview.name,
        preview.channel,
        preview.whySource,
      ]),
    ).toEqual([
      [first.id, first.name, first.channel, 'modelo'],
      [second.id, second.name, second.channel, 'plantilla'],
    ]);
    for (const preview of previews) {
      expect(preview.text).toContain('Puede chocar con Shaft S1.');
      expect(preview.text).toContain('+$3.636.500');
      expect(preview.text).toContain(
        'https://vigente.example/proyectos/p/cambios/00000000-0000-4000-8000-000000000001',
      );
    }
    expect(previews[0]?.text).toContain('Tus vigas sostienen esta losa.');
    expect(previews[1]?.why).toBe(
      'Te avisamos porque tu trabajo depende de lo que cambió.',
    );
  });

  it('prefiere el impacto y suma los choques que el aviso guardó al crearse', () => {
    const [preview] = noticePreviews({
      project,
      notifications: [
        {
          ...notificationFor(first.id),
          context: {
            role: first.role,
            recipientName: first.name,
            impact: { costDelta: 9_000_000, delayDays: 4 },
            clashes: [
              clash,
              { with: 'Colector B2', question: null, combined: null },
            ],
          },
        },
      ],
      impact: { costDelta: 3_636_500, delayDays: 1 },
      clashes: [clash],
      reasons: [],
      baseUrl: 'https://vigente.example',
    });

    expect(preview?.text).toContain('+$9.000.000');
    expect(preview?.text.match(/Puede chocar con Shaft S1/g)).toHaveLength(1);
    expect(preview?.text).toContain('Puede chocar con Colector B2.');
  });
});

describe('los choques estimados como líneas del aviso', () => {
  it('nombra el otro elemento, lleva la pregunta y deja la cifra conjunta en null si no hay impactos', () => {
    expect(
      estimatedClashes(
        [
          {
            otherChangeId: '00000000-0000-4000-8000-000000000002',
            question: '¿Se tocan?',
            otherSummary: 'Shaft S1 cambia',
            otherElement: { name: 'Shaft S1' },
          },
          {
            otherChangeId: '00000000-0000-4000-8000-000000000003',
            question: '¿Se cruzan?',
            otherSummary: 'Ventanas norte cambia',
            otherElement: null,
          },
        ],
        new Map(),
        change.id,
        project.graph,
      ),
    ).toEqual([
      { with: 'Shaft S1', question: '¿Se tocan?', combined: null },
      {
        with: 'Ventanas norte cambia',
        question: '¿Se cruzan?',
        combined: null,
      },
    ]);
  });
});
