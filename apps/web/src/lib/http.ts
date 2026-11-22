export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface Auth {
  readonly seatToken?: string | null;
  readonly presenterKey?: string | null;
  readonly actAs?: string | null;
}

export interface RequestOptions extends Auth {
  readonly method?: 'GET' | 'POST' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly write?: boolean;
  readonly timeoutMs?: number;
}

export const SEAT_HEADER = 'x-seat-token';
export const PRESENTER_HEADER = 'x-presenter-key';
export const ACT_AS_HEADER = 'x-act-as';
export const ACTION_HEADER = 'x-action-id';

export const REQUEST_TIMEOUT_MS = 10_000;

export const WRITE_TIMEOUT_MS = 30_000;

export class RequestTimeoutError extends Error {
  constructor() {
    super('request_timeout');
    this.name = 'RequestTimeoutError';
  }
}

export interface RandomSource {
  readonly randomUUID?: () => string;
  readonly getRandomValues: <T extends ArrayBufferView>(array: T) => T;
}

const HEX = Array.from({ length: 256 }, (_, index) =>
  index.toString(16).padStart(2, '0'),
);

export const newActionId = (
  source: RandomSource = globalThis.crypto,
): string => {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => HEX[byte] ?? '00');
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};

export interface Deadline {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly dispose: () => void;
}

export const withDeadline = (
  caller: AbortSignal | undefined,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Deadline => {
  const controller = new AbortController();
  let expired = false;
  const onCallerAbort = () => controller.abort();
  if (caller?.aborted) controller.abort();
  else caller?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
};

export const buildHeaders = ({
  seatToken,
  presenterKey,
  actAs,
  body,
  write,
}: RequestOptions): Record<string, string> => {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (seatToken) headers[SEAT_HEADER] = seatToken;
  if (presenterKey) headers[PRESENTER_HEADER] = presenterKey;
  if (actAs) headers[ACT_AS_HEADER] = actAs;
  if (write) headers[ACTION_HEADER] = newActionId();
  return headers;
};

interface ErrorBody {
  readonly code?: unknown;
  readonly error?: unknown;
  readonly message?: unknown;
}

export const parseError = (status: number, text: string): ApiError => {
  let body: ErrorBody = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') body = parsed as ErrorBody;
  } catch {
    body = {};
  }
  const message = Array.isArray(body.message)
    ? body.message.join(', ')
    : typeof body.message === 'string'
      ? body.message
      : '';
  const code =
    typeof body.code === 'string'
      ? body.code
      : typeof body.error === 'string' && /^[a-z_]+$/.test(body.error)
        ? body.error
        : /^[a-z_]+$/.test(message)
          ? message
          : null;
  return new ApiError(status, code, message || `Error ${status}`);
};

export const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { method = 'GET', body, signal, timeoutMs } = options;
  const deadline = withDeadline(
    signal,
    timeoutMs ?? (method === 'GET' ? REQUEST_TIMEOUT_MS : WRITE_TIMEOUT_MS),
  );
  let text: string;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: buildHeaders({
        ...options,
        write: options.write ?? method !== 'GET',
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: deadline.signal,
    });
    text = await response.text();
  } catch (error) {
    if (deadline.timedOut()) throw new RequestTimeoutError();
    throw error;
  } finally {
    deadline.dispose();
  }
  if (!response.ok) throw parseError(response.status, text);
  return (text ? JSON.parse(text) : undefined) as T;
};

export const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export const describeError = (error: unknown): string => {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'seat_taken':
        return 'Alguien se te adelantó con ese asiento.';
      case 'seat_held':
        return 'Ese asiento lo tiene otra persona.';
      case 'login_required':
      case 'invalid_token':
        return 'Tu sesión venció. Vuelve a entrar.';
      case 'email_not_verified':
        return 'Confirma tu correo antes de entrar.';
      case 'not_invited':
        return 'Tu correo no tiene una invitación. Pídele a un administrador de tu organización que te invite y vuelve a entrar.';
      case 'auth_not_configured':
        return 'Las cuentas no están configuradas en la API.';
      case 'admin_required':
        return 'Solo un administrador de la organización puede invitar.';
      case 'not_a_member':
        return 'No eres parte de esa organización.';
      case 'already_member':
        return 'Esa persona ya es parte de la organización.';
      case 'organization_name_taken':
        return 'Ya eres parte de una organización con ese nombre. Elige otro.';
      case 'organization_has_projects':
        return 'La organización tiene proyectos, así que no se puede eliminar.';
      case 'last_organization':
        return 'Es tu única organización: si la eliminas, te quedas sin acceso.';
      case 'project_name_taken':
        return 'Ya hay un proyecto con ese nombre en la organización. Elige otro.';
      case 'aps_oauth_not_configured':
        return 'La conexión con Autodesk no está configurada en la API.';
      default:
    }
    if (error.status === 401) return 'Tu asiento o tu clave ya no son válidos.';
    if (error.status === 403) return 'Esa acción no le toca a tu asiento.';
    if (error.status === 404) return 'Eso ya no existe.';
    if (error.status === 429) return 'Vas muy rápido. Espera un momento.';
    return error.message;
  }
  if (isAbort(error)) return '';
  if (error instanceof RequestTimeoutError)
    return 'La sala tardó más de lo normal en responder. Si era un cambio, revisa si ya quedó antes de repetirlo.';
  return 'No pudimos hablar con la sala. Revisa tu conexión.';
};
