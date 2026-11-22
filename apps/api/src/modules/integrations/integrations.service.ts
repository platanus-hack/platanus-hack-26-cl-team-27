import {
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
  type LinkSpreadsheet,
  type ListSources,
  type NoticeOutcome,
  type PushNotice,
  type ReceiveNotice,
  type SourceLink,
  type SubscribeResult,
  type SubscribeSource,
  type UnlinkSource,
  type UnsubscribeSource,
  type WatchResult,
  type WatchSource,
} from '@team27/context-integrations';

import { OAuthStates, type StateOwner } from './oauth-states.ts';
import { checkView, sourceView } from './views.ts';

export const GOOGLE_SETUP = 'GOOGLE_SETUP';
export const INTEGRATIONS_CONFIG = 'INTEGRATIONS_CONFIG';

export interface GoogleSetup {
  readonly connect: ConnectGoogle;
  readonly disconnect: DisconnectGoogle;
  readonly connection: GetGoogleConnection;
  readonly link: LinkSpreadsheet;
  readonly unlink: UnlinkSource;
  readonly list: ListSources;
  readonly watch: WatchSource;
  readonly push: PushSetup | null;
}

export interface PushSetup {
  readonly subscribe: SubscribeSource;
  readonly unsubscribe: UnsubscribeSource;
  readonly receive: ReceiveNotice;
}

export interface PushConfig {
  readonly address: string;
  readonly ttlMs: number;
  readonly renewMarginMs: number;
  readonly fallbackMs: number;
  readonly debounceMs: number;
}

export interface IntegrationsConfig {
  readonly pollMs: number;
  readonly redirectUri: string;
  readonly push: PushConfig | null;
}

export interface CallbackQuery {
  readonly code?: string | undefined;
  readonly state?: string | undefined;
  readonly error?: string | undefined;
}

export const CONNECTORS_PATH = '/conectores';

export const PROJECT_PARAM = 'proyecto';

const MINUTE_MS = 60_000;

export const renewalEveryMs = (config: PushConfig): number =>
  Math.max(MINUTE_MS, Math.floor(config.renewMarginMs / 2));

const PUSH_OFF =
  'Sin GOOGLE_WEBHOOK_URL: la API le pregunta a Google cada cierto tiempo';

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
  private readonly debounced = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pushNotes = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private renewer: ReturnType<typeof setInterval> | null = null;
  private booting: ReturnType<typeof setTimeout> | null = null;
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
    if (this.setup === null) return;
    const polls = this.config.pollMs > 0;
    if (polls) {
      this.timer = setInterval(() => void this.poll(), this.config.pollMs);
      this.timer.unref();
    }
    const push = this.pushing();
    if (push === null) return;
    this.renewer = setInterval(
      () => void this.renew(),
      renewalEveryMs(push.config),
    );
    this.renewer.unref();
    this.booting = setTimeout(() => {
      this.booting = null;
      void (polls ? this.poll() : this.renew());
    }, 1000);
    this.booting.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.renewer) clearInterval(this.renewer);
    this.renewer = null;
    if (this.booting) clearTimeout(this.booting);
    this.booting = null;
    for (const pending of this.debounced.values()) clearTimeout(pending);
    this.debounced.clear();
  }

  async overview(userId: string, projectId: string) {
    const sources = this.setup ? await this.setup.list.execute(projectId) : [];
    const connection = this.setup
      ? await this.setup.connection.execute(userId)
      : null;
    return {
      google: {
        configured: this.setup !== null,
        connection: connection && {
          accountEmail: connection.accountEmail,
          connectedAt: connection.connectedAt,
        },
        pollSeconds: Math.round(this.config.pollMs / 1000),
        push: this.pushView(),
      },
      sources: sources.map(sourceView),
    };
  }

  authorizationUrl(owner: StateOwner): { url: string } {
    return {
      url: this.require().connect.authorizationUrl(this.states.issue(owner)),
    };
  }

  async completeAuthorization(query: CallbackQuery): Promise<string> {
    const owner = this.states.consume(query.state);
    const back = (params: Record<string, string>): string => {
      const url = new URL(CONNECTORS_PATH, this.config.redirectUri);
      url.search = new URLSearchParams({
        ...(owner?.projectId ? { [PROJECT_PARAM]: owner.projectId } : {}),
        ...params,
      }).toString();
      return url.toString();
    };
    const failed = (reason: string) =>
      back({ google: 'error', motivo: reason });
    if (owner === null) {
      return failed('La conexión venció o no partió aquí: vuelve a intentarlo');
    }
    if (query.error || !query.code) {
      return failed('Cancelaste la conexión con Google');
    }
    if (this.setup === null) return failed(NOT_CONFIGURED);
    try {
      await this.setup.connect.execute(owner.userId, query.code);
      return back({ google: 'conectado' });
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Google no completó la conexión';
      this.logger.warn(`Google no completó la conexión: ${reason}`);
      return failed(reason);
    }
  }

  async disconnect(userId: string): Promise<void> {
    await this.require().disconnect.execute(userId);
  }

  async link(userId: string, projectId: string, url: string) {
    const source = await this.require().link.execute({
      userId,
      projectId,
      url,
    });
    this.logger.log(
      `Escuchamos «${source.title}» en ${projectId} (${source.pointer})`,
    );
    const subscribed = await this.subscribe(source);
    return { source: sourceView(subscribed) };
  }

  async check(projectId: string, id: string) {
    const setup = this.require();
    const result = await this.serial(id, () =>
      setup.watch.execute(id, projectId),
    );
    this.report(result.source, result);
    return { source: sourceView(result.source), check: checkView(result) };
  }

  async unlink(projectId: string, id: string): Promise<void> {
    const setup = this.require();
    const sources = await setup.list.execute(projectId);
    this.cancel(id);
    await this.serial(id, async () => {
      if (setup.push && sources.some((source) => source.id === id)) {
        await setup.push.unsubscribe.execute(id).catch(() => false);
      }
      await setup.unlink.execute(projectId, id);
    });
  }

  async receive(notice: PushNotice): Promise<NoticeOutcome['kind']> {
    const push = this.pushing();
    if (push === null) return 'unknown';
    const outcome = await push.setup.receive.execute(notice);
    if (outcome.kind === 'check') this.schedule(outcome.sourceId);
    if (outcome.kind === 'gone') {
      this.logger.warn(
        `La planilla ${outcome.sourceId} se borró en Google Drive`,
      );
    }
    if (outcome.kind === 'rejected') {
      this.logger.warn(
        `Aviso de Drive con un secreto que no calza (${notice.channelId})`,
      );
    }
    return outcome.kind;
  }

  async poll(): Promise<void> {
    const setup = this.setup;
    if (setup === null || this.polling) return;
    this.polling = true;
    try {
      for (const listed of await setup.list.execute()) {
        const source = await this.subscribe(listed);
        if (!this.due(source)) continue;
        const result = await this.serial(source.id, () =>
          setup.watch.execute(source.id),
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

  async renew(): Promise<void> {
    const setup = this.setup;
    if (setup === null || this.pushing() === null || this.polling) return;
    this.polling = true;
    try {
      for (const listed of await setup.list.execute()) {
        await this.subscribe(listed);
      }
    } catch (error) {
      this.logger.error(
        'No pudimos renovar los avisos de Drive de las planillas vinculadas',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.polling = false;
    }
  }

  private pushing(): { setup: PushSetup; config: PushConfig } | null {
    const setup = this.setup?.push ?? null;
    const config = this.config.push;
    return setup === null || config === null ? null : { setup, config };
  }

  private pushView() {
    const push = this.pushing();
    return push === null
      ? {
          enabled: false,
          reason: this.setup === null ? null : PUSH_OFF,
          fallbackSeconds: null,
        }
      : {
          enabled: true,
          reason: null,
          fallbackSeconds: Math.round(push.config.fallbackMs / 1000),
        };
  }

  private async subscribe(source: SourceLink): Promise<SourceLink> {
    const push = this.pushing();
    if (push === null) return source;
    let result: SubscribeResult;
    try {
      result = await this.serial(source.id, () =>
        push.setup.subscribe.execute(source.id, push.config),
      );
    } catch (error) {
      if (
        error instanceof IntegrationError &&
        error.code === 'source_not_found'
      ) {
        return source;
      }
      this.logger.error(
        `«${source.title}»: no pudimos suscribirla a los avisos de Drive`,
        error instanceof Error ? error.stack : String(error),
      );
      return source;
    }
    this.notePush(source, result);
    return result.source;
  }

  private notePush(source: SourceLink, result: SubscribeResult): void {
    if (result.status === 'current') return;
    if (result.status === 'subscribed') {
      this.pushNotes.delete(source.id);
      this.logger.log(`«${source.title}»: ${result.message}`);
      return;
    }
    if (this.pushNotes.get(source.id) === result.message) return;
    this.pushNotes.set(source.id, result.message);
    if (result.failure !== undefined) {
      this.logger.error(
        `«${source.title}»: ${result.message}`,
        result.failure instanceof Error
          ? result.failure.stack
          : String(result.failure),
      );
    } else {
      this.logger.warn(`«${source.title}»: ${result.message}`);
    }
  }

  private due(source: SourceLink): boolean {
    const push = this.pushing();
    if (push === null || source.channel === null) return true;
    const now = Date.now();
    if (source.channel.expiresAt.getTime() <= now) return true;
    return (
      source.checkedAt === null ||
      now - source.checkedAt.getTime() >= push.config.fallbackMs
    );
  }

  private schedule(id: string): void {
    const push = this.pushing();
    const setup = this.setup;
    if (push === null || setup === null) return;
    this.cancel(id);
    const timer = setTimeout(() => {
      this.debounced.delete(id);
      void this.serial(id, () => setup.watch.execute(id))
        .then((result) => this.report(result.source, result))
        .catch((error: unknown) =>
          this.logger.error(
            `No pudimos revisar la planilla ${id} tras el aviso de Drive`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }, push.config.debounceMs);
    timer.unref();
    this.debounced.set(id, timer);
  }

  private cancel(id: string): void {
    const pending = this.debounced.get(id);
    if (pending !== undefined) clearTimeout(pending);
    this.debounced.delete(id);
  }

  private require(): GoogleSetup {
    if (this.setup === null) {
      throw new IntegrationError('not_configured', NOT_CONFIGURED);
    }
    return this.setup;
  }

  private report(before: SourceLink, result: WatchResult): void {
    if (result.failure !== undefined) {
      this.logger.error(
        `«${before.title}»: ${result.message}`,
        result.failure instanceof Error
          ? result.failure.stack
          : String(result.failure),
      );
    } else if (
      result.status === 'failed' &&
      before.lastError?.message !== result.message
    ) {
      this.logger.warn(`«${before.title}»: ${result.message}`);
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
