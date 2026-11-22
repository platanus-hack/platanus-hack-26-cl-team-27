import {
  MAX_NOTE_LENGTH,
  normalizeNote,
  type Notification,
  RESPONSE_KINDS,
  type ResponseKind,
} from '../../domain/Notification.ts';
import { ValidationError } from '../errors.ts';
import type { NotificationRepository } from '../ports/NotificationRepository.ts';

export interface ResponseInput {
  readonly kind: ResponseKind;
  readonly note?: string | null;
}

export class RespondToNotification {
  private readonly notifications: NotificationRepository;

  constructor(notifications: NotificationRepository) {
    this.notifications = notifications;
  }

  execute(id: string, input: ResponseInput): Promise<Notification | null> {
    if (!RESPONSE_KINDS.includes(input.kind)) {
      throw new ValidationError(
        'La respuesta debe ser reviewed, issue o not_affected',
      );
    }
    const note = normalizeNote(input.note);
    if (note && note.length > MAX_NOTE_LENGTH) {
      throw new ValidationError(
        `La nota no puede pasar de ${MAX_NOTE_LENGTH} caracteres`,
      );
    }
    return this.notifications.respond(id, {
      kind: input.kind,
      note,
      at: new Date(),
    });
  }
}
