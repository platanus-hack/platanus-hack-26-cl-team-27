import {
  answerMemo,
  asReminder,
  closingMemo,
  escalationMemo,
  followUpStep,
} from '../../src/domain/FollowUp.ts';
import { renderNotice, WHATSAPP_MAX_LENGTH } from '../../src/domain/Notice.ts';
import {
  draftMemoNotices,
  expectsAnswer,
} from '../../src/domain/Notification.ts';

const settings = { reminderAfterMs: 60_000, escalateAfterReminders: 2 };

const at = (seconds: number) =>
  new Date(Date.UTC(2026, 10, 22, 12, 0, seconds));

describe('followUpStep', () => {
  it.each([
    ['todavía no pasa el plazo', 30, 0, false, 'wait'],
    ['pasó el plazo sin recordatorios', 60, 0, false, 'remind'],
    ['pasó el plazo con un recordatorio', 90, 1, false, 'remind'],
    [
      'ya van los recordatorios y sigue sin responder',
      90,
      2,
      false,
      'escalate',
    ],
    ['ya se escaló', 900, 2, true, 'wait'],
  ] as const)('%s', (_name, seconds, reminders, escalated, expected) => {
    expect(
      followUpStep(
        { lastContactAt: at(0), reminders, escalated },
        at(seconds),
        settings,
      ),
    ).toBe(expected);
  });

  it('con cero recordatorios configurados escala apenas pasa el plazo', () => {
    expect(
      followUpStep(
        { lastContactAt: at(0), reminders: 0, escalated: false },
        at(60),
        { ...settings, escalateAfterReminders: 0 },
      ),
    ).toBe('escalate');
  });
});

describe('asReminder', () => {
  it('marca el asunto y el texto, y deja nulo el HTML que no existe', () => {
    const reminder = asReminder({
      subject: 'Losa',
      text: 'cuerpo',
      html: null,
    });

    expect(reminder.subject).toBe('Recordatorio: Losa');
    expect(reminder.text).toBe(
      'Recordatorio: todavía falta tu respuesta.\n\ncuerpo',
    );
    expect(reminder.html).toBeNull();
    expect(
      asReminder({ subject: 'Losa', text: 'cuerpo', html: '<p>x</p>' }).html,
    ).toContain('<p>x</p>');
  });
});

describe('answerMemo', () => {
  it('una objeción parte con «Objeción» y dice qué hacer', () => {
    const memo = answerMemo({
      by: 'Paula Rojas',
      role: 'Ingeniera calculista',
      answer: 'issue',
      note: 'Necesito 2 días',
      about: 'Shaft S1 · 6 m → 9 m',
      progress: { approved: 1, required: 3, missing: ['Javier Muñoz'] },
    });

    expect(memo.subject).toBe(
      'Objeción: Paula Rojas objetó · Shaft S1 · 6 m → 9 m',
    );
    expect(memo.lines).toEqual([
      'Paula Rojas (Ingeniera calculista) objetó.',
      'Su nota: «Necesito 2 días»',
      'Van 1 de 3 confirmaciones. Falta Javier Muñoz.',
      'Lo vigente no cambia. Reabre con la observación o retira el cambio.',
    ]);
  });

  it('una confirmación sin nota solo dice quién y cómo va', () => {
    const memo = answerMemo({
      by: 'Javier Muñoz',
      role: '',
      answer: 'reviewed',
      note: null,
      about: 'Shaft S1',
      progress: { approved: 2, required: 2, missing: [] },
    });

    expect(memo.subject).toBe('Javier Muñoz confirmó · Shaft S1');
    expect(memo.lines).toEqual([
      'Javier Muñoz confirmó.',
      'Van 2 de 2 confirmaciones.',
    ]);
  });

  it('el voto de un solapamiento dice si se tocan', () => {
    expect(
      answerMemo({
        by: 'Javier Muñoz',
        role: 'Sanitarias',
        answer: 'se_tocan',
        note: null,
        about: 'Choque: Shaft S1 y Colector B2',
      }).lines,
    ).toEqual([
      'Javier Muñoz (Sanitarias) dice que se tocan.',
      'Es un choque real: el cambio queda bloqueado hasta resolverlo.',
    ]);
  });
});

describe('escalationMemo', () => {
  it('nombra a quien no responde y cuántas veces se le recordó', () => {
    const memo = escalationMemo('Shaft S1', [
      { name: 'Paula Rojas', role: 'Calculista', reminders: 2 },
      { name: 'Javier Muñoz', role: '', reminders: 1 },
    ]);

    expect(memo.subject).toBe('Sin respuesta: Shaft S1');
    expect(memo.lines[0]).toBe(
      'Paula Rojas (Calculista) no ha respondido, con 2 recordatorios.',
    );
    expect(memo.lines[1]).toBe(
      'Javier Muñoz no ha respondido, con 1 recordatorio.',
    );
  });
});

describe('un aviso con memo', () => {
  const memo = escalationMemo('Shaft S1', [
    { name: 'Paula Rojas', role: 'Calculista', reminders: 2 },
  ]);
  const notice = {
    title: memo.subject,
    findings: [],
    url: 'https://vigente.example/proyectos/p/cambios/c1',
    recipientName: 'Fernanda Lagos',
    impact: { costDelta: 1_000_000, delayDays: 0 },
    memo,
  };

  it('por correo lleva el saludo, cada línea, el impacto y el enlace', () => {
    const rendered = renderNotice(notice, 'ingenieria', 'email');

    expect(rendered.subject).toBe('Sin respuesta: Shaft S1');
    expect(rendered.text).toContain('Hola Fernanda:');
    expect(rendered.text).toContain(
      '• Paula Rojas (Calculista) no ha respondido, con 2 recordatorios.',
    );
    expect(rendered.text).toContain('Impacto del cambio: costo +$1.000.000');
    expect(rendered.text).toContain(`Mira el seguimiento: ${notice.url}`);
    expect(rendered.html).toContain('<h2>Sin respuesta: Shaft S1</h2>');
  });

  it('por WhatsApp y Slack sale en su formato', () => {
    const whatsapp = renderNotice(notice, 'ingenieria', 'whatsapp');
    const slack = renderNotice(notice, 'ingenieria', 'slack');

    expect(whatsapp.text.length).toBeLessThanOrEqual(WHATSAPP_MAX_LENGTH);
    expect(whatsapp.text.endsWith(notice.url)).toBe(true);
    expect(slack.text).toContain('*Sin respuesta: Shaft S1*');
    expect(slack.text).toContain(`<${notice.url}|Mira el seguimiento>`);
  });
});

describe('draftMemoNotices y expectsAnswer', () => {
  it('arma un aviso por destinatario conocido, sin repetir, y no espera respuesta', () => {
    const drafts = draftMemoNotices(
      {
        projectId: 'p',
        changeId: 'c1',
        kind: 'answer',
        memo: escalationMemo('Shaft S1', []),
        recipientIds: ['autora', 'autora', 'nadie'],
      },
      [
        {
          id: 'autora',
          name: 'Fernanda',
          role: 'Arquitecta',
          channel: 'email',
          handle: 'f@obra.example',
        },
      ],
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      stakeholderId: 'autora',
      title: 'Sin respuesta: Shaft S1',
      recipient: 'f@obra.example',
      link: '/proyectos/p/cambios/c1',
    });
    expect(expectsAnswer({ context: drafts[0]?.context ?? null })).toBe(false);
  });

  it('esperan respuesta el aviso de cambio y el de conflicto de quien valida', () => {
    const conflict = {
      overlapId: 'o1',
      first: 'A',
      firstSource: 'a',
      second: 'B',
      secondSource: 'b',
      area: null,
      question: '¿?',
      combined: null,
      part: 'author' as const,
    };
    const context = { role: '', recipientName: '', impact: null, clashes: [] };

    expect(expectsAnswer({ context: null })).toBe(true);
    expect(
      expectsAnswer({
        context: {
          ...context,
          kind: 'conflict',
          conflict: { ...conflict, votes: true },
        },
      }),
    ).toBe(true);
    expect(
      expectsAnswer({
        context: {
          ...context,
          kind: 'conflict',
          conflict: { ...conflict, votes: false },
        },
      }),
    ).toBe(false);
  });
});

describe('closingMemo', () => {
  it('dice que el cambio está vigente, quién confirmó y cómo terminó el choque', () => {
    const memo = closingMemo({
      about: 'Shaft S1 · 6 m → 9 m',
      version: 3,
      confirmed: ['Paula Rojas', 'Javier Muñoz'],
      notAffected: ['Camila Vera'],
      conflicts: [{ with: 'Colector B2', outcome: 'descartado' }],
      moves: false,
    });

    expect(memo.subject).toBe('Cambio coordinado: Shaft S1 · 6 m → 9 m');
    expect(memo.lines).toEqual([
      'Es la versión 3 del proyecto.',
      'Confirmaron: Paula Rojas, Javier Muñoz.',
      'Sin efecto para: Camila Vera.',
      'El choque con Colector B2 se descartó: no se tocan.',
      'No mueve el costo ni el plazo.',
    ]);
  });

  it('si mueve el costo o el plazo no lo niega, y la cifra la pone el aviso', () => {
    const memo = closingMemo({
      about: 'Losa nivel 3',
      version: 2,
      confirmed: [],
      notAffected: [],
      conflicts: [{ with: 'Shaft S1', outcome: 'resuelto' }],
      moves: true,
    });
    const rendered = renderNotice(
      {
        title: memo.subject,
        findings: [],
        url: 'https://vigente.example/c1',
        impact: { costDelta: 3_636_500, delayDays: 1 },
        memo,
      },
      'costos',
      'email',
    );

    expect(memo.lines).toEqual([
      'Es la versión 2 del proyecto.',
      'El choque con Shaft S1 quedó resuelto.',
    ]);
    expect(rendered.text).toContain(
      'Impacto del cambio: costo +$3.636.500 · plazo +1 día',
    );
    expect(rendered.text).toContain(
      'Mira el cambio coordinado: https://vigente.example/c1',
    );
  });
});
