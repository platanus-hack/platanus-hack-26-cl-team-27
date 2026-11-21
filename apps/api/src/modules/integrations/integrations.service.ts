import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  type ConnectGoogle,
  type DisconnectGoogle,
  type GetGoogleConnection,
  IntegrationError,
  type LinkInput,
  type LinkSpreadsheet,
  type ListSources,
  type SourceLink,
  type SyncResult,
  type SyncSource,
  type UnlinkSource,
} from '@team27/context-integrations';

import { fail } from '../coordination/http-errors.ts';
import { spaceName } from '../coordination/lookup.ts';
import { OAuthStates } from './oauth-states.ts';
import { linkableDocuments } from './vocabulary.ts';
import { sourceView, syncView } from './views.ts';

export const GOOGLE_SETUP = 'GOOGLE_SETUP';
export const INTEGRATIONS_CONFIG = 'INTEGRATIONS_CONFIG';

export interface GoogleSetup {
  readonly connect: ConnectGoogle;
  readonly disconnect: DisconnectGoogle;
  readonly connection: GetGoogleConnection;
  readonly link: LinkSpreadsheet;
  readonly unlink: UnlinkSource;
  readonly list: ListSources;
  readonly sync: SyncSource;
}

export interface IntegrationsConfig {
  readonly pollMs: number;
  readonly redirectUri: string;
}

export interface CallbackQuery {
  readonly code?: string | undefined;
  readonly state?: string | undefined;
  readonly error?: string | undefined;
}

export const CONNECTORS_PATH = '/conectores';

const NOT_CONFIGURED =
  'Falta configurar Google en la API: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e INTEGRATIONS_ENCRYPTION_KEY';

@Injectable()
export class IntegrationsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly setup: GoogleSetup | null;
  private readonly config: IntegrationsConfig;
  private readonly states: OAuthStates;
  private readonly running = new Map<string, Promise<unknown>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    @Inject(GOOGLE_SETUP) setup: GoogleSetup | null,
    @Inject(INTEGRATIONS_CONFIG) config: IntegrationsConfig,
    @Inject(OAuthStates) states: OAuthStates,
  ) {
    this.setup = setup;
    this.config = config;
    this.states = states;
  }

  onApplicationBootstrap(): void {
    if (this.setup === null || this.config.pollMs <= 0) return;
    this.timer = setInterval(() => void this.poll(), this.config.pollMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async overview() {
    const sources = this.setup ? await this.setup.list.execute() : [];
    const connection = this.setup
      ? await this.setup.connection.execute()
      : null;
    const linked = new Set(sources.map((source) => source.documentId));
    return {
      google: {
        configured: this.setup !== null,
        connection: connection && {
          accountEmail: connection.accountEmail,
          connectedAt: connection.connectedAt,
        },
        pollSeconds: Math.round(this.config.pollMs / 1000),
      },
      sources: sources.map(sourceView),
      documents: linkableDocuments().map((document) => ({
        id: document.id,
        name: document.name,
        spaceName: spaceName(document.spaceId),
        linked: linked.has(document.id),
      })),
    };
  }

  authorizationUrl(): { url: string } {
    return {
      url: this.require().connect.authorizationUrl(this.states.issue()),
    };
  }

  async completeAuthorization(query: CallbackQuery): Promise<string> {
    const back = (params: Record<string, string>): string => {
      const url = new URL(CONNECTORS_PATH, this.config.redirectUri);
      url.search = new URLSearchParams(params).toString();
      return url.toString();
    };
    const failed = (reason: string) =>
      back({ google: 'error', motivo: reason });
    if (!this.states.consume(query.state)) {
      return failed('La conexión venció o no partió aquí: vuelve a intentarlo');
    }
    if (query.error || !query.code) {
      return failed('Cancelaste la conexión con Google');
    }
    if (this.setup === null) return failed(NOT_CONFIGURED);
    try {
      await this.setup.connect.execute(query.code);
      return back({ google: 'conectado' });
    } catch (error) {
      this.logger.warn(
        `Google no completó la conexión: ${error instanceof Error ? error.message : String(error)}`,
      );
      return failed(
        error instanceof Error
          ? error.message
          : 'Google no completó la conexión',
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.require().disconnect.execute();
  }

  async link(input: LinkInput) {
    const setup = this.require();
    if (
      !linkableDocuments().some((document) => document.id === input.documentId)
    ) {
      throw fail(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'unlinkable_document',
        'Por ahora solo se puede vincular el presupuesto',
      );
    }
    const source = await setup.link.execute(input);
    const result = await this.serial(source.id, () =>
      setup.sync.execute(source.id),
    );
    this.report(source, result);
    return { source: sourceView(result.source), sync: syncView(result) };
  }

  async sync(id: string) {
    const setup = this.require();
    const result = await this.serial(id, () => setup.sync.execute(id));
    this.report(result.source, result);
    return { source: sourceView(result.source), sync: syncView(result) };
  }

  async unlink(id: string): Promise<void> {
    await this.require().unlink.execute(id);
  }

  async poll(): Promise<void> {
    const setup = this.setup;
    if (setup === null || this.polling) return;
    this.polling = true;
    try {
      for (const source of await setup.list.execute()) {
        const result = await this.serial(source.id, () =>
          setup.sync.execute(source.id),
        );
        this.report(source, result);
      }
    } catch (error) {
      this.logger.error(
        'No pudimos revisar las planillas vinculadas',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.polling = false;
    }
  }

  private require(): GoogleSetup {
    if (this.setup === null) {
      throw new IntegrationError('not_configured', NOT_CONFIGURED);
    }
    return this.setup;
  }

  private report(before: SourceLink, result: SyncResult): void {
    if (result.failure !== undefined) {
      this.logger.error(
        `${before.title}: ${result.message}`,
        result.failure instanceof Error
          ? result.failure.stack
          : String(result.failure),
      );
    } else if (
      result.status === 'failed' &&
      before.lastError?.message !== result.message
    ) {
      this.logger.warn(`${before.title}: ${result.message}`);
    } else if (result.status === 'ingested') {
      this.logger.log(`${before.title}: ${result.message}`);
    }
  }

  private serial<T>(id: string, work: () => Promise<T>): Promise<T> {
    const previous = this.running.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    this.running.set(id, next);
    void next
      .catch(() => undefined)
      .finally(() => {
        if (this.running.get(id) === next) this.running.delete(id);
      });
    return next;
  }
}
