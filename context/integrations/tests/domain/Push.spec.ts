import {
  canWatch,
  DRIVE_METADATA_SCOPE,
  editorLabel,
  needsRenewal,
  noticeAction,
  parseChanged,
  type PushNotice,
  sameSecret,
} from '../../src/domain/Push.ts';

const NOW = new Date('2026-11-21T12:00:00Z');
const HOUR = 3_600_000;

const notice = (state: string, changed: string[] = []): PushNotice => ({
  channelId: 'ch-1',
  resourceId: 'res-1',
  token: 'secret-1',
  state,
  changed,
});

describe('avisos de Drive', () => {
  it('reconoce los permisos de Drive que dejan recibir avisos', () => {
    expect(canWatch(['openid', DRIVE_METADATA_SCOPE])).toBe(true);
    expect(canWatch(['https://www.googleapis.com/auth/drive'])).toBe(true);
    expect(
      canWatch(['https://www.googleapis.com/auth/spreadsheets.readonly']),
    ).toBe(false);
  });

  it('renueva sin suscripción o cuando vence dentro del margen', () => {
    const channel = (hours: number) => ({
      id: 'ch-1',
      resourceId: 'res-1',
      token: 't',
      expiresAt: new Date(NOW.getTime() + hours * HOUR),
    });
    expect(needsRenewal(null, NOW, HOUR)).toBe(true);
    expect(needsRenewal(channel(0.5), NOW, HOUR)).toBe(true);
    expect(needsRenewal(channel(5), NOW, HOUR)).toBe(false);
  });

  it('revisa cuando cambia el contenido o el nombre, no con el aviso inicial', () => {
    expect(noticeAction(notice('sync'))).toBe('ignore');
    expect(noticeAction(notice('update', ['content']))).toBe('check');
    expect(noticeAction(notice('update', ['properties']))).toBe('check');
    expect(noticeAction(notice('update', []))).toBe('check');
    expect(noticeAction(notice('update', ['permissions']))).toBe('ignore');
    expect(noticeAction(notice('untrash'))).toBe('check');
    expect(noticeAction(notice('trash'))).toBe('gone');
    expect(noticeAction(notice('remove'))).toBe('gone');
  });

  it('lee la cabecera de qué cambió', () => {
    expect(parseChanged('content, properties')).toEqual([
      'content',
      'properties',
    ]);
    expect(parseChanged(undefined)).toEqual([]);
  });

  it('compara el secreto del canal', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'ab')).toBe(false);
    expect(sameSecret('abc', null)).toBe(false);
  });

  it('nombra a quien editó por su nombre o su correo', () => {
    expect(editorLabel({ name: 'Daniela', email: 'd@x.cl' })).toBe('Daniela');
    expect(editorLabel({ name: null, email: 'd@x.cl' })).toBe('d@x.cl');
    expect(editorLabel(null)).toBeNull();
  });
});
