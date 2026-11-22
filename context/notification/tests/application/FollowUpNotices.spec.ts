import type { DeliveryQueue } from '../../src/application/ports/DeliveryQueue.ts';
import type { NotificationRepository } from '../../src/application/ports/NotificationRepository.ts';
import { FollowUpNotices } from '../../src/application/use-cases/FollowUpNotices.ts';
import type { DeliveryRecord } from '../../src/domain/Delivery.ts';
import type { Notification } from '../../src/domain/Notification.ts';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 22, 12, minutes));

const notice = (id: string, escalated = false): Notification => ({
  id,
  changeId: 'c1',
  stakeholderId: 'paula',
  channel: 'email',
  title: 'Shaft S1',
  findings: [],
  link: '/proyectos/p/cambios/c1',
  context: escalated
    ? {
        role: '',
        recipientName: '',
        impact: null,
        clashes: [],
        escalatedAt: at(9).toISOString(),
      }
    : null,
  sentAt: at(0),
  response: null,
});

const record = (
  notificationId: string,
  kind: DeliveryRecord['kind'],
  minute: number,
): DeliveryRecord => ({
  notificationId,
  kind,
  channel: 'email',
  status: 'sent',
  reason: null,
  attempts: 1,
  sentAt: at(minute),
  createdAt: at(minute),
});

const setup = (deliveries: DeliveryRecord[]) => {
  const queue = {
    listFor: vi.fn<DeliveryQueue['listFor']>().mockResolvedValue(deliveries),
    remind: vi.fn<DeliveryQueue['remind']>().mockResolvedValue(true),
  } as unknown as DeliveryQueue & {
    remind: ReturnType<typeof vi.fn>;
  };
  const notifications = {
    markEscalated: vi.fn<NotificationRepository['markEscalated']>(),
  } as unknown as NotificationRepository & {
    markEscalated: ReturnType<typeof vi.fn>;
  };
  const followUp = new FollowUpNotices(notifications, queue, {
    reminderAfterMs: 2 * 60_000,
    escalateAfterReminders: 1,
  });
  return { queue, notifications, followUp };
};

describe('FollowUpNotices', () => {
  it('antes del plazo no hace nada', async () => {
    const { queue, followUp } = setup([record('n1', 'notice', 0)]);

    expect(await followUp.execute([notice('n1')], at(1))).toEqual([]);
    expect(queue.remind).not.toHaveBeenCalled();
  });

  it('pasado el plazo sin respuesta, encola un recordatorio', async () => {
    const { queue, notifications, followUp } = setup([
      record('n1', 'notice', 0),
    ]);

    const followed = await followUp.execute([notice('n1')], at(2));

    expect(followed).toEqual([
      { notification: notice('n1'), step: 'remind', reminders: 1 },
    ]);
    expect(queue.remind).toHaveBeenCalledWith('n1', at(2));
    expect(notifications.markEscalated).not.toHaveBeenCalled();
  });

  it('con los recordatorios cumplidos y otro plazo sin respuesta, escala una sola vez', async () => {
    const deliveries = [record('n1', 'notice', 0), record('n1', 'reminder', 2)];
    const first = setup(deliveries);

    expect(await first.followUp.execute([notice('n1')], at(3))).toEqual([]);
    const followed = await first.followUp.execute([notice('n1')], at(4));

    expect(followed).toEqual([
      { notification: notice('n1'), step: 'escalate', reminders: 1 },
    ]);
    expect(first.queue.remind).not.toHaveBeenCalled();
    expect(first.notifications.markEscalated).toHaveBeenCalledWith(
      ['n1'],
      at(4),
    );

    const again = setup(deliveries);
    expect(await again.followUp.execute([notice('n1', true)], at(30))).toEqual(
      [],
    );
  });

  it('sin avisos pendientes no consulta la cola', async () => {
    const { queue, followUp } = setup([]);

    expect(await followUp.execute([], at(9))).toEqual([]);
    expect(queue.listFor).not.toHaveBeenCalled();
  });
});
