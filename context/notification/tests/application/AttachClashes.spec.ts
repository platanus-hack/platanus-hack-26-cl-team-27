import type { NotificationRepository } from '../../src/application/ports/NotificationRepository.ts';
import { AttachClashes } from '../../src/application/use-cases/AttachClashes.ts';
import { withClashes } from '../../src/domain/Notification.ts';

const repository = () => ({
  saveMany: vi.fn<NotificationRepository['saveMany']>(),
  list: vi.fn<NotificationRepository['list']>(),
  respond: vi.fn<NotificationRepository['respond']>(),
  clearResponse: vi.fn<NotificationRepository['clearResponse']>(),
  findById: vi.fn<NotificationRepository['findById']>(),
  markEscalated: vi.fn<NotificationRepository['markEscalated']>(),
  setClashes: vi
    .fn<NotificationRepository['setClashes']>()
    .mockResolvedValue(2),
  setReasons: vi.fn<NotificationRepository['setReasons']>(),
});

const clash = {
  with: 'Colector sanitario B2',
  question: '¿Se topan en nivel 3 · C-D/3?',
  combined: null,
};

describe('AttachClashes', () => {
  it('guarda los choques en los avisos del cambio', async () => {
    const notifications = repository();

    const updated = await new AttachClashes(notifications).execute({
      changeId: 'c1',
      clashes: [clash],
    });

    expect(updated).toBe(2);
    expect(notifications.setClashes).toHaveBeenCalledWith('c1', [clash]);
  });

  it('sin choques no toca el repositorio', async () => {
    const notifications = repository();

    await new AttachClashes(notifications).execute({
      changeId: 'c1',
      clashes: [],
    });

    expect(notifications.setClashes).not.toHaveBeenCalled();
  });
});

describe('withClashes', () => {
  it('conserva el rol, el nombre y el impacto del aviso', () => {
    const context = {
      role: 'Costos',
      recipientName: 'Daniela',
      impact: { costDelta: 1, delayDays: 0 },
      clashes: [],
    };

    expect(withClashes(context, [clash])).toEqual({
      ...context,
      clashes: [clash],
    });
  });

  it('un aviso sin contexto queda solo con los choques', () => {
    expect(withClashes(null, [clash])).toEqual({
      role: '',
      recipientName: '',
      impact: null,
      clashes: [clash],
    });
  });
});
