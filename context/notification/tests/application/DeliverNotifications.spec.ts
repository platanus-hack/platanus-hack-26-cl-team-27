import type {
  ChannelSender,
  ChannelSenders,
} from '../../src/application/ports/ChannelSender.ts';
import type { DeliveryQueue } from '../../src/application/ports/DeliveryQueue.ts';
import { DeliverNotifications } from '../../src/application/use-cases/DeliverNotifications.ts';
import {
  MAX_ATTEMPTS,
  type PendingDelivery,
} from '../../src/domain/Delivery.ts';
import type { Channel } from '../../src/domain/Stakeholder.ts';

const NOW = new Date('2026-11-22T12:00:00Z');

const delivery = (
  id: string,
  recipient: string | null,
  attempts = 1,
  channel: Channel = 'email',
): PendingDelivery => ({
  id,
  channel,
  recipient,
  attempts,
  kind: 'notice',
  notification: {
    id: `n-${id}`,
    changeId: 'c1',
    stakeholderId: 'costos',
    channel,
    title: 'Losa nivel 3',
    findings: [{ summary: 'Sube el costo', details: [], action: 'Actualiza' }],
    link: '/cambios/c1?para=costos',
    context: {
      role: 'Costos',
      recipientName: 'Daniela Soto',
      impact: null,
      clashes: [],
    },
    sentAt: NOW,
    response: null,
  },
});

const queue = (pending: PendingDelivery[]) => ({
  claim: vi.fn<DeliveryQueue['claim']>().mockResolvedValue(pending),
  markSent: vi.fn<DeliveryQueue['markSent']>(),
  markSkipped: vi.fn<DeliveryQueue['markSkipped']>(),
  retry: vi.fn<DeliveryQueue['retry']>(),
  fail: vi.fn<DeliveryQueue['fail']>(),
  listFor: vi.fn<DeliveryQueue['listFor']>(),
  remind: vi.fn<DeliveryQueue['remind']>(),
});

const sender = (send: ChannelSender['send']) => ({ send: vi.fn(send) });

const options = { baseUrl: 'https://vigente.example' };

const deliver = (
  deliveries: ReturnType<typeof queue>,
  senders: ChannelSenders,
  extra: object = {},
) =>
  new DeliverNotifications(deliveries, senders, {
    ...options,
    ...extra,
  }).execute(NOW);

describe('DeliverNotifications', () => {
  it('manda cada aviso a su correo, con su id como clave de idempotencia', async () => {
    const deliveries = queue([delivery('d1', 'paula@obra.example')]);
    const email = sender(() => Promise.resolve('gmail-1'));

    const round = await deliver(deliveries, { email });

    expect(round).toEqual({ sent: 1, retried: 0, failed: 0, skipped: 0 });
    expect(email.send).toHaveBeenCalledWith(
      { id: 'd1', to: 'paula@obra.example', recipientName: 'Daniela Soto' },
      expect.objectContaining({ subject: 'Losa nivel 3' }),
    );
    expect(deliveries.markSent).toHaveBeenCalledWith(
      'd1',
      { providerId: 'gmail-1', channel: 'email', note: null },
      expect.any(Date),
    );
  });

  it('un aviso de otro canal sale por el sender de ese canal, escrito para ese canal', async () => {
    const deliveries = queue([delivery('d1', '#costos', 1, 'slack')]);
    const email = sender(() => Promise.resolve('gmail-1'));
    const slack = sender(() => Promise.resolve('slack:d1'));

    const round = await deliver(deliveries, { email, slack });

    expect(round.sent).toBe(1);
    expect(email.send).not.toHaveBeenCalled();
    expect(slack.send).toHaveBeenCalledWith(
      { id: 'd1', to: '#costos', recipientName: 'Daniela Soto' },
      expect.objectContaining({
        html: null,
        text: expect.stringContaining('*Losa nivel 3*'),
      }),
    );
    expect(deliveries.markSent).toHaveBeenCalledWith(
      'd1',
      { providerId: 'slack:d1', channel: 'slack', note: null },
      expect.any(Date),
    );
  });

  it('sin sender para el canal y sin correo, queda omitido con el motivo', async () => {
    const deliveries = queue([
      delivery('d1', '+56 9 0000 0101', 1, 'whatsapp'),
    ]);
    const email = sender(() => Promise.resolve('x'));

    const round = await deliver(deliveries, { email });

    expect(round.skipped).toBe(1);
    expect(email.send).not.toHaveBeenCalled();
    expect(deliveries.markSkipped).toHaveBeenCalledWith(
      'd1',
      'No hay envío por WhatsApp configurado y el afectado no tiene correo',
    );
  });

  it('sin sender para el canal pero con desvío de correo, sale por correo y lo anota', async () => {
    const deliveries = queue([
      delivery('d1', '+56 9 0000 0101', 1, 'whatsapp'),
    ]);
    const email = sender(() => Promise.resolve('gmail-1'));

    await deliver(
      deliveries,
      { email },
      { redirects: { email: 'demo@vigente.example' } },
    );

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'demo@vigente.example' }),
      expect.objectContaining({ html: expect.stringContaining('<h1') }),
    );
    expect(deliveries.markSent).toHaveBeenCalledWith(
      'd1',
      {
        providerId: 'gmail-1',
        channel: 'email',
        note: 'Sin envío por WhatsApp: salió por correo',
      },
      expect.any(Date),
    );
  });

  it('con un correo de desvío, manda todo ahí, también a quien no tiene correo', async () => {
    const deliveries = queue([delivery('d1', null)]);
    const email = sender(() => Promise.resolve('gmail-1'));

    await deliver(
      deliveries,
      { email },
      { redirects: { email: 'demo@vigente.example' } },
    );

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'demo@vigente.example' }),
      expect.anything(),
    );
  });

  it('salta a quien no tiene correo sin llamar al proveedor', async () => {
    const deliveries = queue([delivery('d1', null)]);
    const email = sender(() => Promise.resolve('x'));

    const round = await deliver(deliveries, { email });

    expect(round.skipped).toBe(1);
    expect(email.send).not.toHaveBeenCalled();
    expect(deliveries.markSkipped).toHaveBeenCalledWith(
      'd1',
      'El afectado no tiene correo',
    );
  });

  it('si el envío falla, reintenta más tarde y guarda el error', async () => {
    const deliveries = queue([delivery('d1', 'paula@obra.example', 2)]);
    const email = sender(() =>
      Promise.reject(new Error('Gmail respondió 500')),
    );

    const round = await deliver(deliveries, { email });

    expect(round.retried).toBe(1);
    expect(deliveries.retry).toHaveBeenCalledWith(
      'd1',
      'Gmail respondió 500',
      new Date(NOW.getTime() + 240_000),
    );
  });

  it('en el último intento lo marca como fallido', async () => {
    const deliveries = queue([
      delivery('d1', 'paula@obra.example', MAX_ATTEMPTS),
    ]);
    const email = sender(() => Promise.reject(new Error('caído')));

    const round = await deliver(deliveries, { email });

    expect(round.failed).toBe(1);
    expect(deliveries.fail).toHaveBeenCalledWith('d1', 'caído');
    expect(deliveries.retry).not.toHaveBeenCalled();
  });
});
