import { randomBytes, randomUUID } from 'node:crypto';

import { ProviderError } from '../../application/errors.ts';
import type {
  EditorLookup,
  FileWatcher,
  WatchRequest,
} from '../../application/ports/index.ts';
import type { Editor, PushChannel } from '../../domain/Push.ts';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

interface ChannelResponse {
  readonly id?: string;
  readonly resourceId?: string;
  readonly expiration?: string;
}

interface FileMeta {
  readonly lastModifyingUser?: {
    readonly displayName?: string;
    readonly emailAddress?: string;
  };
}

interface GoogleErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly errors?: readonly { readonly reason?: string }[];
  };
}

export interface DriveWatcherOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly channelId?: () => string;
  readonly secret?: () => string;
}

const reasonsOf = (body: GoogleErrorBody): string[] =>
  (body.error?.errors ?? [])
    .map((error) => error.reason)
    .filter((reason): reason is string => Boolean(reason));

const errorFor = (status: number, body: GoogleErrorBody): ProviderError => {
  const reasons = reasonsOf(body);
  const message = body.error?.message ?? '';
  if (
    reasons.includes('accessNotConfigured') ||
    /has not been used|is disabled/.test(message)
  ) {
    return new ProviderError(
      'La API de Google Drive no está activada en el proyecto de Google Cloud',
      status,
    );
  }
  if (
    reasons.some((reason) => reason.startsWith('push.')) ||
    (status === 400 && /webhook|push\.|must be https/i.test(message))
  ) {
    return new ProviderError(
      `Google no acepta la URL de avisos: ${message || status}`,
      status,
    );
  }
  switch (status) {
    case 401:
      return new ProviderError(
        'Google no aceptó el permiso: vuelve a conectar la cuenta',
        status,
      );
    case 403:
      return new ProviderError(
        'Tu cuenta de Google no tiene permiso para recibir avisos de esa planilla',
        status,
      );
    case 404:
      return new ProviderError(
        'Google Drive no encuentra esa planilla con tu cuenta',
        status,
      );
    default:
      return new ProviderError(`Google Drive respondió ${status}`, status);
  }
};

export class GoogleDriveWatcher implements FileWatcher, EditorLookup {
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly channelId: () => string;
  private readonly secret: () => string;

  constructor(options: DriveWatcherOptions = {}) {
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.channelId = options.channelId ?? randomUUID;
    this.secret =
      options.secret ?? (() => randomBytes(24).toString('base64url'));
  }

  async watch(
    accessToken: string,
    fileId: string,
    request: WatchRequest,
  ): Promise<PushChannel> {
    const id = this.channelId();
    const token = this.secret();
    const body = await this.call<ChannelResponse>(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}/watch?supportsAllDrives=true`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          id,
          type: 'web_hook',
          address: request.address,
          token,
          expiration: String(this.now() + request.ttlMs),
        }),
      },
    );
    if (!body.resourceId) {
      throw new ProviderError('Google Drive no confirmó la suscripción');
    }
    const expiration = Number(body.expiration);
    return {
      id: body.id ?? id,
      resourceId: body.resourceId,
      token,
      expiresAt: new Date(
        Number.isFinite(expiration) && expiration > 0
          ? expiration
          : this.now() + request.ttlMs,
      ),
    };
  }

  async stop(accessToken: string, channel: PushChannel): Promise<void> {
    try {
      await this.call<unknown>(`${DRIVE_API}/channels/stop`, accessToken, {
        method: 'POST',
        body: JSON.stringify({
          id: channel.id,
          resourceId: channel.resourceId,
        }),
      });
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return;
      throw error;
    }
  }

  async lastEditor(
    accessToken: string,
    fileId: string,
  ): Promise<Editor | null> {
    const fields = encodeURIComponent(
      'lastModifyingUser(displayName,emailAddress)',
    );
    const body = await this.call<FileMeta>(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${fields}&supportsAllDrives=true`,
      accessToken,
      { method: 'GET' },
    );
    const user = body.lastModifyingUser;
    if (!user) return null;
    const editor = {
      name: user.displayName?.trim() || null,
      email: user.emailAddress?.trim() || null,
    };
    return editor.name === null && editor.email === null ? null : editor;
  }

  private async call<T>(
    url: string,
    accessToken: string,
    init: { readonly method: string; readonly body?: string },
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetch(url, {
        method: init.method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          ...(init.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: init.body }),
      });
    } catch {
      throw new ProviderError('No pudimos hablar con Google Drive');
    }
    if (response.status === 204) return {} as T;
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw errorFor(response.status, body as GoogleErrorBody);
    return body as T;
  }
}
