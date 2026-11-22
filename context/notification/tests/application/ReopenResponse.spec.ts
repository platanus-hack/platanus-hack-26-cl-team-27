import type { NotificationRepository } from '../../src/application/ports/NotificationRepository.ts';
import { GetNotification } from '../../src/application/use-cases/GetNotification.ts';
import { ReopenResponse } from '../../src/application/use-cases/ReopenResponse.ts';
import type { Notification } from '../../src/domain/Notification.ts';

const pending: Notification = {
  id: 'n1',
  changeId: 'c1',
  stakeholderId: 'paula-rojas',
  channel: 'email',
  title: 'Losa nivel 3',
  findings: [],
  link: '/proyectos/edificio-norte/cambios/c1',
  sentAt: new Date(0),
  context: null,
  response: null,
};

const repository = () => ({
  saveMany: vi.fn<NotificationRepository['saveMany']>(),
  list: vi.fn<NotificationRepository['list']>(),
  respond: vi.fn<NotificationRepository['respond']>(),
  clearResponse: vi
    .fn<NotificationRepository['clearResponse']>()
    .mockResolvedValue(pending),
  findById: vi
    .fn<NotificationRepository['findById']>()
    .mockResolvedValue(pending),
  markEscalated: vi.fn<NotificationRepository['markEscalated']>(),
  setClashes: vi.fn<NotificationRepository['setClashes']>(),
  setReasons: vi.fn<NotificationRepository['setReasons']>(),
});

describe('ReopenResponse', () => {
  it('limpia la respuesta para que quien disputó vuelva a estar pendiente', async () => {
    const notifications = repository();

    await expect(
      new ReopenResponse(notifications).execute('n1'),
    ).resolves.toEqual(pending);
    expect(notifications.clearResponse).toHaveBeenCalledWith('n1');
  });

  it('devuelve null si el aviso no existe', async () => {
    const notifications = repository();
    notifications.clearResponse.mockResolvedValue(null);

    await expect(
      new ReopenResponse(notifications).execute('x'),
    ).resolves.toBeNull();
  });
});

describe('GetNotification', () => {
  it('busca un aviso por id', async () => {
    const notifications = repository();

    await expect(
      new GetNotification(notifications).execute('n1'),
    ).resolves.toEqual(pending);
  });
});
