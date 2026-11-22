import type { DeliveryQueue } from '../../src/application/ports/DeliveryQueue.ts';
import type { EmailSender } from '../../src/application/ports/EmailSender.ts';
import { DeliverNotifications } from '../../src/application/use-cases/DeliverNotifications.ts';
import {
  MAX_ATTEMPTS,
  type PendingDelivery,
} from '../../src/domain/Delivery.ts';

const NOW = new Date('2026-11-22T12:00:00Z');

const delivery = (
  id: string,
  recipient: string | null,
  attempts = 1,
): PendingDelivery => ({
  id,
  recipient,
  attempts,
  notification: {
    id: `n-${id}`,
    changeId: 'c1',
    stakeholderId: 'costos',
    channel: 'email',
    title: 'Losa nivel 3',
    findings: [],
    link: '/cambios/c1?para=costos',
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
});

const sender = (send: EmailSender['send']) => ({ send: vi.fn(send) });

const options = { baseUrl: 'https://vigente.example' };

describe('DeliverNotifications', () => {
  it('manda cada aviso a su correo, con su id como clave de idempotencia', async () => {
    const deliveries = queue([delivery('d1', 'paula@obra.example')]);
    const email = sender(() => Promise.resolve('resend-1'));

    const round = await new DeliverNotifications(
      deliveries,
      email,
      options,
    ).execute(NOW);

    expect(round).toEqual({ sent: 1, retried: 0, failed: 0, skipped: 0 });
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'paula@obra.example',
        subject: 'Losa nivel 3',
        idempotencyKey: 'd1',
      }),
    );
    expect(deliveries.markSent).toHaveBeenCalledWith(
      'd1',
      'resend-1',
      expect.any(Date),
    );
  });

  it('con un correo de desvío, manda todo ahí, también a quien no tiene correo', async () => {
    const deliveries = queue([delivery('d1', null)]);
    const email = sender(() => Promise.resolve('resend-1'));

    await new DeliverNotifications(deliveries, email, {
      ...options,
      redirectTo: 'demo@vigente.example',
    }).execute(NOW);

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'demo@vigente.example' }),
    );
  });

  it('salta a quien no tiene correo sin llamar al proveedor', async () => {
    const deliveries = queue([delivery('d1', null)]);
    const email = sender(() => Promise.resolve('x'));

    const round = await new DeliverNotifications(
      deliveries,
      email,
      options,
    ).execute(NOW);

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

    const round = await new DeliverNotifications(
      deliveries,
      email,
      options,
    ).execute(NOW);

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

    const round = await new DeliverNotifications(
      deliveries,
      email,
      options,
    ).execute(NOW);

    expect(round.failed).toBe(1);
    expect(deliveries.fail).toHaveBeenCalledWith('d1', 'caído');
    expect(deliveries.retry).not.toHaveBeenCalled();
  });
});
