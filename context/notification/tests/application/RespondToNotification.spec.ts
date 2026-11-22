import { ValidationError } from '../../src/application/errors.ts';
import type { NotificationRepository } from '../../src/application/ports/NotificationRepository.ts';
import { RespondToNotification } from '../../src/application/use-cases/RespondToNotification.ts';
import {
  MAX_NOTE_LENGTH,
  type ResponseKind,
} from '../../src/domain/Notification.ts';

const repository = () => ({
  saveMany: vi.fn<NotificationRepository['saveMany']>(),
  list: vi.fn<NotificationRepository['list']>(),
  respond: vi.fn<NotificationRepository['respond']>().mockResolvedValue(null),
  clearResponse: vi.fn<NotificationRepository['clearResponse']>(),
  findById: vi.fn<NotificationRepository['findById']>(),
  setClashes: vi.fn<NotificationRepository['setClashes']>(),
});

describe('RespondToNotification', () => {
  it('guarda la respuesta con la nota recortada', async () => {
    const notifications = repository();

    await new RespondToNotification(notifications).execute('n1', {
      kind: 'issue',
      note: '  Necesito dos días para recalcular  ',
    });

    expect(notifications.respond).toHaveBeenCalledWith('n1', {
      kind: 'issue',
      note: 'Necesito dos días para recalcular',
      at: expect.any(Date),
    });
  });

  it('una nota vacía queda en null', async () => {
    const notifications = repository();

    await new RespondToNotification(notifications).execute('n1', {
      kind: 'reviewed',
      note: '   ',
    });

    expect(notifications.respond).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ note: null }),
    );
  });

  it.each([
    [{ kind: 'otra' as ResponseKind }],
    [{ kind: 'issue' as const, note: 'x'.repeat(MAX_NOTE_LENGTH + 1) }],
  ])('rechaza %o sin tocar el repositorio', (input) => {
    const notifications = repository();

    expect(() =>
      new RespondToNotification(notifications).execute('n1', input),
    ).toThrow(ValidationError);
    expect(notifications.respond).not.toHaveBeenCalled();
  });
});
