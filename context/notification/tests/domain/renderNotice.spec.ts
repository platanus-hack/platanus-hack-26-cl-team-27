import {
  fallbackWhy,
  type Notice,
  type NoticeFinding,
  noticeRoleOf,
  renderNotice,
  SLACK_MAX_LENGTH,
  topicOf,
  WHATSAPP_MAX_LENGTH,
} from '../../src/domain/Notice.ts';

const dependency: NoticeFinding = {
  topic: 'dependency',
  summary: 'Cambia el peso propio de la losa nivel 3',
  details: ['Peso propio: 3,75 → 5 kN/m² (+1,25)'],
  action: 'Revisa vigas bajo la losa nivel 3',
};

const cost: NoticeFinding = {
  topic: 'cost',
  summary: 'El presupuesto sube $3.636.500',
  details: ['03.02 Hormigón H30 en losas: 42 → 56 m³ × $145.000 = +$2.030.000'],
  action: 'Actualiza el presupuesto y prepara el aumento de obra.',
};

const schedule: NoticeFinding = {
  topic: 'schedule',
  summary: 'La entrega se corre 1 día',
  details: ['Hormigonado losa nivel 3: 3 días → 4 días, en la ruta crítica'],
  action: 'Reprograma las faenas que siguen.',
};

const notice: Notice = {
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  findings: [dependency, cost, schedule],
  url: 'https://vigente.example/proyectos/los-aromos/cambios/c1',
  recipientName: 'Daniela Soto',
  impact: { costDelta: 3_636_500, delayDays: 1 },
  clashes: [
    {
      with: 'Shaft de instalaciones S1',
      question: '¿La nueva pasada del shaft corta el refuerzo de la losa?',
      combined: { costDelta: 4_000_000, delayDays: 3 },
    },
  ],
};

const position = (text: string, piece: string): number => {
  const index = text.indexOf(piece);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
};

describe('noticeRoleOf', () => {
  it.each([
    ['Costos', 'costos'],
    ['Jefa de presupuestos', 'costos'],
    ['Planificación', 'planificacion'],
    ['Programador de obra', 'planificacion'],
    ['Ingeniería estructural', 'ingenieria'],
    ['Instalaciones sanitarias', 'ingenieria'],
  ])('lee el rol «%s» como %s', (role, expected) => {
    expect(noticeRoleOf(role)).toBe(expected);
  });

  it('si el rol no lo dice, mira qué hallazgos recibe la persona', () => {
    expect(noticeRoleOf('Administrador de contrato', [cost])).toBe('costos');
    expect(noticeRoleOf('Jefe de terreno', [schedule])).toBe('planificacion');
    expect(noticeRoleOf('Jefe de terreno', [schedule, dependency])).toBe(
      'ingenieria',
    );
    expect(noticeRoleOf('')).toBe('ingenieria');
  });
});

describe('topicOf', () => {
  it('reconoce el tema de un hallazgo guardado sin tema', () => {
    expect(topicOf({ ...cost, topic: undefined })).toBe('cost');
    expect(topicOf({ ...schedule, topic: undefined })).toBe('schedule');
    expect(topicOf({ ...dependency, topic: undefined })).toBe('dependency');
  });
});

describe('renderNotice por rol', () => {
  it('a costos le pone el costo primero, en el asunto y en el cuerpo', () => {
    const rendered = renderNotice(notice, 'costos', 'email');

    expect(rendered.subject).toBe(
      'Costo +$3.636.500 · Losa nivel 3 · Espesor: 15 cm → 20 cm',
    );
    expect(position(rendered.text, cost.summary)).toBeLessThan(
      position(rendered.text, schedule.summary),
    );
    expect(position(rendered.text, schedule.summary)).toBeLessThan(
      position(rendered.text, dependency.summary),
    );
    expect(rendered.text).toContain(
      'Impacto del cambio: costo +$3.636.500 · plazo +1 día',
    );
    expect(rendered.text).toContain(
      'Te avisamos porque llevas el presupuesto y este cambio lo mueve.',
    );
  });

  it('a planificación le pone el plazo primero', () => {
    const rendered = renderNotice(notice, 'planificacion', 'email');

    expect(rendered.subject).toBe(
      'Plazo +1 día · Losa nivel 3 · Espesor: 15 cm → 20 cm',
    );
    expect(position(rendered.text, schedule.summary)).toBeLessThan(
      position(rendered.text, cost.summary),
    );
    expect(rendered.text).toContain(
      'Impacto del cambio: plazo +1 día · costo +$3.636.500',
    );
    expect(rendered.text).toContain(
      'Los dos juntos: plazo +3 días · costo +$4.000.000.',
    );
  });

  it('a ingeniería le pone la dependencia y su acción primero', () => {
    const rendered = renderNotice(notice, 'ingenieria', 'email');

    expect(rendered.subject).toBe(notice.title);
    expect(position(rendered.text, dependency.summary)).toBeLessThan(
      position(rendered.text, schedule.summary),
    );
    expect(rendered.text).toContain(
      '  Qué hacer: Revisa vigas bajo la losa nivel 3',
    );
    expect(rendered.text).toContain(
      'Te avisamos porque tu trabajo depende de lo que cambió.',
    );
  });
});

describe('renderNotice por canal', () => {
  it('el correo saluda, lleva el detalle, el choque, el impacto y el enlace, en texto y en HTML', () => {
    const rendered = renderNotice(notice, 'ingenieria', 'email');

    expect(rendered.text.startsWith('Hola Daniela:\n')).toBe(true);
    expect(rendered.text).toContain('  - Peso propio: 3,75 → 5 kN/m² (+1,25)');
    expect(rendered.text).toContain(
      'Puede chocar con Shaft de instalaciones S1. ¿La nueva pasada del shaft corta el refuerzo de la losa? Los dos juntos: costo +$4.000.000 · plazo +3 días.',
    );
    expect(
      rendered.text.endsWith(`Revisa el cambio y responde: ${notice.url}`),
    ).toBe(true);
    expect(rendered.html).toContain('<h2>Losa nivel 3');
    expect(rendered.html).toContain(`<a href="${notice.url}">`);
    expect(rendered.html).toContain(
      'Puede chocar con Shaft de instalaciones S1.',
    );
  });

  it('el correo escapa el HTML', () => {
    const rendered = renderNotice(
      { ...notice, title: 'Losa <nivel 3>', why: 'Porque "sí" & ya' },
      'ingenieria',
      'email',
    );

    expect(rendered.html).toContain('Losa &lt;nivel 3&gt;');
    expect(rendered.html).toContain('Porque &quot;sí&quot; &amp; ya');
    expect(rendered.html).not.toContain('<nivel 3>');
  });

  it('WhatsApp va corto y en texto plano: un hallazgo, las cifras, el choque y el enlace', () => {
    const rendered = renderNotice(notice, 'costos', 'whatsapp');

    expect(rendered.html).toBeNull();
    expect(rendered.text.split('\n')).toEqual([
      notice.title,
      'El presupuesto sube $3.636.500. Actualiza el presupuesto y prepara el aumento de obra.',
      'Y 2 puntos más en el detalle.',
      'Impacto del cambio: costo +$3.636.500 · plazo +1 día',
      'Puede chocar con Shaft de instalaciones S1. ¿La nueva pasada del shaft corta el refuerzo de la losa? Los dos juntos: costo +$4.000.000 · plazo +3 días.',
      notice.url,
    ]);
    expect(rendered.text).not.toContain('Hola');
    expect(rendered.text).not.toContain('03.02');
    expect(rendered.text).not.toMatch(/[*_<]/);
  });

  it('WhatsApp se recorta sin perder el enlace', () => {
    const rendered = renderNotice(
      { ...notice, title: 'Losa '.repeat(200) },
      'costos',
      'whatsapp',
    );

    expect(rendered.text.length).toBeLessThanOrEqual(WHATSAPP_MAX_LENGTH);
    expect(rendered.text.endsWith(`…\n${notice.url}`)).toBe(true);
  });

  it('Slack usa su formato: título en negrita, un punto por hallazgo y el enlace con texto', () => {
    const rendered = renderNotice(notice, 'planificacion', 'slack');

    expect(rendered.html).toBeNull();
    expect(rendered.text.split('\n')).toEqual([
      `*${notice.title}*`,
      '_Te avisamos porque llevas el plazo y este cambio mueve la entrega._',
      '• *La entrega se corre 1 día*: Reprograma las faenas que siguen.',
      '• *El presupuesto sube $3.636.500*: Actualiza el presupuesto y prepara el aumento de obra.',
      '• *Cambia el peso propio de la losa nivel 3*: Revisa vigas bajo la losa nivel 3',
      'Impacto del cambio: plazo +1 día · costo +$3.636.500',
      'Puede chocar con Shaft de instalaciones S1. ¿La nueva pasada del shaft corta el refuerzo de la losa? Los dos juntos: plazo +3 días · costo +$4.000.000.',
      `<${notice.url}|Revisa el cambio y responde>`,
    ]);
    expect(rendered.text).not.toContain('Hormigonado');
    expect(rendered.text.length).toBeLessThanOrEqual(SLACK_MAX_LENGTH);
  });
});

describe('renderNotice sin choque, sin impacto y sin modelo', () => {
  const bare: Notice = {
    title: notice.title,
    findings: [dependency],
    url: notice.url,
  };

  it('sin choque ni impacto no agrega esas líneas ni el saludo', () => {
    const rendered = renderNotice(bare, 'ingenieria', 'email');

    expect(rendered.text).not.toContain('Impacto del cambio');
    expect(rendered.text).not.toContain('Puede chocar');
    expect(rendered.text.startsWith(notice.title)).toBe(true);
  });

  it('un impacto en cero no se anuncia', () => {
    const rendered = renderNotice(
      { ...bare, impact: { costDelta: 0, delayDays: 0 } },
      'costos',
      'email',
    );

    expect(rendered.subject).toBe(notice.title);
    expect(rendered.text).not.toContain('Impacto del cambio');
  });

  it('un ahorro y un adelanto llevan signo menos', () => {
    const rendered = renderNotice(
      { ...bare, impact: { costDelta: -500_000, delayDays: -2 } },
      'costos',
      'whatsapp',
    );

    expect(rendered.text).toContain(
      'Impacto del cambio: costo −$500.000 · plazo −2 días',
    );
  });

  it('usa el porqué del modelo si viene, y el fijo si no', () => {
    const written = renderNotice(
      { ...bare, why: '  Tus vigas sostienen esta losa.  ' },
      'ingenieria',
      'email',
    );
    const fixed = renderNotice({ ...bare, why: '   ' }, 'ingenieria', 'email');

    expect(written.text).toContain('Tus vigas sostienen esta losa.');
    expect(written.text).not.toContain('Te avisamos porque');
    expect(fixed.text).toContain(
      'Te avisamos porque tu trabajo depende de lo que cambió.',
    );
  });

  it('el porqué fijo sale del primer hallazgo del rol, o del rol si no hay hallazgos', () => {
    expect(fallbackWhy([dependency, cost], 'costos')).toBe(
      'Te avisamos porque llevas el presupuesto y este cambio lo mueve.',
    );
    expect(fallbackWhy([], 'planificacion')).toBe(
      'Te avisamos porque llevas el plazo y este cambio mueve la entrega.',
    );
  });
});
