import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  MAX_NOTE_LENGTH,
  type Notification,
  RESPONSE_KINDS,
  RespondToNotification,
} from '@team27/context-notification';
import { z } from 'zod';

const notificationId = z.uuid();

const responseBody = z.object({
  kind: z.enum(RESPONSE_KINDS),
  note: z.string().max(MAX_NOTE_LENGTH).nullish(),
});

@Controller('notifications')
export class NotificationController {
  private readonly respondToNotification: RespondToNotification;

  constructor(
    @Inject(RespondToNotification) respondToNotification: RespondToNotification,
  ) {
    this.respondToNotification = respondToNotification;
  }

  @Post(':id/response')
  async respond(
    @Param('id', { schema: notificationId }) id: string,
    @Body({ schema: responseBody }) body: z.output<typeof responseBody>,
  ): Promise<Notification> {
    const notification = await this.respondToNotification.execute(id, body);
    if (!notification) throw new NotFoundException(`No existe el aviso ${id}`);
    return notification;
  }
}
