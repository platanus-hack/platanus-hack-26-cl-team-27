import type { ReasonWriter } from '../../src/application/ports/ReasonWriter.ts';
import { ExplainNotices } from '../../src/application/use-cases/ExplainNotices.ts';

const change = {
  id: 'c1',
  subjectId: 'losa-n3',
  summary: 'Losa nivel 3 (modified) · Espesor: 15 → 20 cm',
  detectedAt: '2026-11-22T00:00:00Z',
};

const recipients = [
  {
    stakeholderId: 'costos',
    name: 'Daniela Soto',
    role: 'Costos',
    findings: ['El presupuesto sube $3.636.500'],
  },
];

describe('ExplainNotices', () => {
  it('pide una frase por persona y deja solo las que pasan el filtro', async () => {
    const writer: ReasonWriter = {
      write: vi.fn<ReasonWriter['write']>().mockResolvedValue([
        {
          stakeholderId: 'costos',
          why: 'El hormigón de la losa es partida tuya.',
        },
        { stakeholderId: 'otro', why: 'No estaba.' },
      ]),
    };

    const reasons = await new ExplainNotices(writer).execute({
      change,
      recipients,
    });

    expect(writer.write).toHaveBeenCalledWith({ change, recipients });
    expect(reasons).toEqual([
      {
        stakeholderId: 'costos',
        why: 'El hormigón de la losa es partida tuya.',
      },
    ]);
  });

  it('sin personas avisadas no llama a ningún modelo', async () => {
    const writer: ReasonWriter = { write: vi.fn<ReasonWriter['write']>() };

    expect(
      await new ExplainNotices(writer).execute({ change, recipients: [] }),
    ).toEqual([]);
    expect(writer.write).not.toHaveBeenCalled();
  });
});
