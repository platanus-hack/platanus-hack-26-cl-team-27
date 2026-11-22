import {
  emailAddress,
  renderEmail,
  retryDelayMs,
} from '../../src/domain/Delivery.ts';
import type { Notification } from '../../src/domain/Notification.ts';

const notification: Notification = {
  id: 'n1',
  changeId: 'c1',
  stakeholderId: 'costos',
  channel: 'email',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  findings: [
    {
      summary: 'Sube el costo <hormigón>',
      details: ['+$3.636.500'],
      action: 'Actualiza el presupuesto',
    },
  ],
  link: '/cambios/c1?para=costos',
  context: null,
  sentAt: new Date(0),
  response: null,
};

describe('emailAddress', () => {
  it('acepta un correo y descarta teléfonos y canales', () => {
    expect(emailAddress(' paula@obra.example ')).toBe('paula@obra.example');
    expect(emailAddress('+56 9 0000 0101')).toBeNull();
    expect(emailAddress('#costos')).toBeNull();
  });
});

describe('renderEmail', () => {
  it('usa el título como asunto y lleva los hallazgos y el enlace absoluto', () => {
    const email = renderEmail(notification, 'https://vigente.example');

    expect(email.subject).toBe(notification.title);
    expect(email.text).toContain('• Sube el costo <hormigón>');
    expect(email.text).toContain('  - +$3.636.500');
    expect(email.text).toContain('Qué hacer: Actualiza el presupuesto');
    expect(email.text).toContain(
      'https://vigente.example/cambios/c1?para=costos',
    );
  });

  it('escapa el HTML', () => {
    const email = renderEmail(notification, 'https://vigente.example');

    expect(email.html).toContain('Sube el costo &lt;hormigón&gt;');
    expect(email.html).not.toContain('<hormigón>');
  });
});

describe('renderEmail con el contexto del aviso', () => {
  const withContext: Notification = {
    ...notification,
    findings: [
      {
        topic: 'cost',
        summary: 'El presupuesto sube $3.636.500',
        details: [],
        action: 'Actualiza el presupuesto',
      },
    ],
    context: {
      role: 'Costos',
      recipientName: 'Daniela Soto',
      impact: { costDelta: 3_636_500, delayDays: 1 },
      clashes: [
        {
          with: 'Colector sanitario B2',
          question: '¿Se topan en nivel 3 · C-D/3?',
          combined: null,
        },
      ],
    },
  };

  it('escribe para el rol: costo en el asunto, saludo, impacto y choque', () => {
    const email = renderEmail(withContext, 'https://vigente.example');

    expect(email.subject).toBe(
      'Costo +$3.636.500 · Losa nivel 3 · Espesor: 15 cm → 20 cm',
    );
    expect(email.text).toContain('Hola Daniela:');
    expect(email.text).toContain(
      'Impacto del cambio: costo +$3.636.500 · plazo +1 día',
    );
    expect(email.text).toContain(
      'Puede chocar con Colector sanitario B2. ¿Se topan en nivel 3 · C-D/3?',
    );
    expect(email.html).toContain('Puede chocar con Colector sanitario B2.');
  });
});

describe('retryDelayMs', () => {
  it('espera más en cada intento, hasta una hora', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([
      60_000, 240_000, 960_000, 3_600_000, 3_600_000,
    ]);
  });
});
