import type { SourceLink } from '../../domain/Connection.ts';
import { canWatch, needsRenewal } from '../../domain/Push.ts';
import { IntegrationError, ProviderError } from '../errors.ts';
import type {
  AccountAuthorizer,
  ConnectionRepository,
  FileWatcher,
  SourceLinkRepository,
} from '../ports/index.ts';
import { connectionOf, sourceNotFound } from './requireGoogle.ts';

export type SubscribeStatus =
  'subscribed' | 'current' | 'unsupported' | 'failed';

export interface SubscribeOptions {
  readonly address: string;
  readonly ttlMs: number;
  readonly renewMarginMs: number;
}

export interface SubscribeResult {
  readonly status: SubscribeStatus;
  readonly source: SourceLink;
  readonly message: string;
  readonly failure?: unknown;
}

export const MISSING_DRIVE_SCOPE =
  'La cuenta de Google no dio permiso para recibir avisos de Drive: vuelve a conectarla para que los cambios lleguen al instante';

const isKnown = (error: unknown): error is Error =>
  error instanceof IntegrationError || error instanceof ProviderError;

export class SubscribeSource {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly watcher: FileWatcher;
  private readonly sources: SourceLinkRepository;
  private readonly now: () => Date;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    watcher: FileWatcher,
    sources: SourceLinkRepository,
    now: () => Date = () => new Date(),
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.watcher = watcher;
    this.sources = sources;
    this.now = now;
  }

  async execute(
    id: string,
    options: SubscribeOptions,
  ): Promise<SubscribeResult> {
    const source = await this.sources.find(id);
    if (source === null) throw sourceNotFound();
    if (!needsRenewal(source.channel, this.now(), options.renewMarginMs)) {
      return {
        status: 'current',
        source,
        message: 'Google ya avisa los cambios de esta planilla',
      };
    }
    try {
      return await this.subscribe(source, options);
    } catch (error) {
      return {
        status: 'failed',
        source,
        message: isKnown(error)
          ? error.message
          : 'No pudimos pedirle a Google que avise los cambios',
        failure: isKnown(error) ? undefined : error,
      };
    }
  }

  private async subscribe(
    source: SourceLink,
    options: SubscribeOptions,
  ): Promise<SubscribeResult> {
    const connection = await connectionOf(this.connections, source);
    if (!canWatch(connection.scopes)) {
      return { status: 'unsupported', source, message: MISSING_DRIVE_SCOPE };
    }
    const token = await this.authorizer.accessToken(connection.refreshToken);
    const channel = await this.watcher.watch(token, source.externalId, {
      address: options.address,
      ttlMs: options.ttlMs,
    });
    const updated = await this.sources.saveChannel(source.id, channel);
    if (source.channel !== null) {
      await this.watcher.stop(token, source.channel).catch(() => undefined);
    }
    return {
      status: 'subscribed',
      source: updated,
      message: `Google avisa los cambios hasta ${channel.expiresAt.toISOString()}`,
    };
  }
}
