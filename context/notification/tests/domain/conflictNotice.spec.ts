import {
  type Notice,
  type NoticeConflict,
  noticeKindOf,
  renderNotice,
  WHATSAPP_MAX_LENGTH,
} from '../../src/domain/Notice.ts';
import {
  draftConflictNotices,
  isChangeNotice,
} from '../../src/domain/Notification.ts';
import type { Stakeholder } from '../../src/domain/Stakeholder.ts';

const conflict: NoticeConflict = {
  overlapId: 'o1',
  first: 'Shaft S1',
  firstSource: 'A-201 rev D',
  second: 'Colector B2',
  secondSource: 'IS-301 rev A',
  area: 'Piso 2 · eje 3 · B-C',
  question: '¿Se topan Shaft S1 y Colector B2 en Piso 2 · eje 3 · B-C?',
  combined: { costDelta: 4_000_000, delayDays: 3 },
  part: 'author',
  votes: true,
};

const notice: Notice = {
  title: 'Choque: Shaft S1 y Colector B2',
  findings: [],
  url: 'https://vigente.example/proyectos/los-aromos/cambios/c1',
  recipientName: 'Javier Muñoz',
  impact: { costDelta: 1_000_000, delayDays: 1 },
  conflict,
};

describe('el aviso de conflicto', () => {
  it('por correo dice qué choca con qué, dónde, la pregunta, la cifra conjunta y pide el voto', () => {
    const rendered = renderNotice(notice, 'ingenieria', 'email');

    expect(rendered.subject).toBe('Choque: Shaft S1 y Colector B2');
    expect(rendered.text).toContain('Hola Javier:');
    expect(rendered.text).toContain(
      'Te avisamos porque uno de los dos cambios es tuyo.',
    );
    expect(rendered.text).toContain(
      '• Qué choca: Shaft S1 (A-201 rev D) con Colector B2 (IS-301 rev A)',
    );
    expect(rendered.text).toContain('• Dónde: Piso 2 · eje 3 · B-C');
    expect(rendered.text).toContain(`• ${conflict.question}`);
    expect(rendered.text).toContain(
      'Los dos juntos: costo +$4.000.000 · plazo +3 días',
    );
    expect(rendered.text).toContain(
      `Responde si se tocan o no se tocan: ${notice.url}`,
    );
    expect(rendered.html).toContain('<li>Dónde: Piso 2 · eje 3 · B-C</li>');
  });

  it('por WhatsApp va corto, en texto plano y con el enlace al final', () => {
    const rendered = renderNotice(notice, 'planificacion', 'whatsapp');

    expect(rendered.html).toBeNull();
    expect(rendered.text.length).toBeLessThanOrEqual(WHATSAPP_MAX_LENGTH);
    expect(rendered.text).toContain(
      'Shaft S1 (A-201 rev D) con Colector B2 (IS-301 rev A), en Piso 2 · eje 3 · B-C.',
    );
    expect(rendered.text).toContain(
      'Los dos juntos: plazo +3 días · costo +$4.000.000',
    );
    expect(rendered.text.endsWith(notice.url)).toBe(true);
  });

  it('por Slack usa su formato y el enlace con texto', () => {
    const rendered = renderNotice(notice, 'costos', 'slack');

    expect(rendered.text).toContain('*Choque: Shaft S1 y Colector B2*');
    expect(rendered.text).toContain(
      '• *Qué choca:* Shaft S1 (A-201 rev D) con Colector B2 (IS-301 rev A)',
    );
    expect(rendered.text).toContain(
      `<${notice.url}|Responde si se tocan o no se tocan>`,
    );
  });

  it('a quien no valida le dice que le afecta y solo lo invita a mirar', () => {
    const rendered = renderNotice(
      { ...notice, conflict: { ...conflict, part: 'affected', votes: false } },
      'ingenieria',
      'email',
    );

    expect(rendered.text).toContain(
      'Te avisamos porque uno de los dos cambios te afecta.',
    );
    expect(rendered.text).toContain(`Mira el choque: ${notice.url}`);
    expect(rendered.text).not.toContain('Responde si se tocan');
  });

  it('sin cifra conjunta muestra el impacto del cambio, y sin área no inventa un lugar', () => {
    const rendered = renderNotice(
      {
        ...notice,
        conflict: {
          ...conflict,
          second: 'Shaft S1',
          area: null,
          combined: null,
        },
      },
      'costos',
      'email',
    );

    expect(rendered.subject).toBe('Choque en Shaft S1');
    expect(rendered.text).toContain(
      'A-201 rev D y IS-301 rev A cambian datos distintos de Shaft S1',
    );
    expect(rendered.text).not.toContain('Dónde:');
    expect(rendered.text).toContain(
      'Impacto del cambio: costo +$1.000.000 · plazo +1 día',
    );
  });
});

const STAKEHOLDERS: Stakeholder[] = [
  {
    id: 'arquitecta',
    name: 'Fernanda',
    role: 'Arquitecta',
    channel: 'email',
    handle: 'fernanda@obra.example',
  },
  {
    id: 'sanitarias',
    name: 'Javier',
    role: 'Instalaciones sanitarias',
    channel: 'whatsapp',
    handle: '+56 9 0000 0102',
  },
];

describe('draftConflictNotices', () => {
  const { part, votes, ...shared } = conflict;
  void part;
  void votes;

  it('arma un aviso de conflicto por persona, una sola vez, en su canal y con su papel', () => {
    const drafts = draftConflictNotices(
      {
        projectId: 'los-aromos',
        conflict: shared,
        impact: { costDelta: 1_000_000, delayDays: 1 },
        recipients: [
          {
            stakeholderId: 'arquitecta',
            changeId: 'c1',
            part: 'author',
            votes: true,
          },
          {
            stakeholderId: 'sanitarias',
            changeId: 'c2',
            part: 'affected',
            votes: false,
          },
          {
            stakeholderId: 'sanitarias',
            changeId: 'c1',
            part: 'author',
            votes: true,
          },
          {
            stakeholderId: 'no-existe',
            changeId: 'c1',
            part: 'affected',
            votes: false,
          },
        ],
      },
      STAKEHOLDERS,
    );

    expect(drafts.map((draft) => draft.stakeholderId)).toEqual([
      'arquitecta',
      'sanitarias',
    ]);
    expect(drafts[0]).toMatchObject({
      changeId: 'c1',
      channel: 'email',
      title: 'Choque: Shaft S1 y Colector B2',
      link: '/proyectos/los-aromos/cambios/c1',
      email: 'fernanda@obra.example',
    });
    expect(drafts[1]).toMatchObject({
      changeId: 'c2',
      channel: 'whatsapp',
      email: null,
    });
    expect(drafts[1]?.context?.conflict).toMatchObject({
      overlapId: 'o1',
      part: 'affected',
      votes: false,
    });
    expect(noticeKindOf(drafts[0]?.context)).toBe('conflict');
    expect(isChangeNotice({ context: drafts[0]?.context ?? null })).toBe(false);
  });

  it('un aviso sin tipo es de cambio', () => {
    expect(noticeKindOf(null)).toBe('change');
    expect(isChangeNotice({ context: null })).toBe(true);
  });
});
