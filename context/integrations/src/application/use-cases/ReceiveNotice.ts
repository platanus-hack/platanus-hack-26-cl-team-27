import {
  noticeAction,
  type PushNotice,
  sameSecret,
} from '../../domain/Push.ts';
import type { SourceLinkRepository } from '../ports/index.ts';

export type NoticeOutcome =
  | { readonly kind: 'check'; readonly sourceId: string }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'gone'; readonly sourceId: string }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'rejected' };

export const FILE_GONE =
  'La planilla se borró o está en la papelera de Google Drive';

export class ReceiveNotice {
  private readonly sources: SourceLinkRepository;
  private readonly now: () => Date;

  constructor(
    sources: SourceLinkRepository,
    now: () => Date = () => new Date(),
  ) {
    this.sources = sources;
    this.now = now;
  }

  async execute(notice: PushNotice): Promise<NoticeOutcome> {
    const source = await this.sources.findByChannel(notice.channelId);
    if (source?.channel == null) return { kind: 'unknown' };
    const { channel } = source;
    if (
      !sameSecret(channel.token, notice.token) ||
      (notice.resourceId !== null && notice.resourceId !== channel.resourceId)
    ) {
      return { kind: 'rejected' };
    }
    switch (noticeAction(notice)) {
      case 'check':
        return { kind: 'check', sourceId: source.id };
      case 'gone':
        await this.sources.recordError(source.id, {
          at: this.now(),
          message: FILE_GONE,
        });
        return { kind: 'gone', sourceId: source.id };
      default:
        return { kind: 'ignored' };
    }
  }
}
