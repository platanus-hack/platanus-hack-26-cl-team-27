const SPREADSHEET_ID = /^[A-Za-z0-9_-]{20,}$/;

const SPREADSHEET_PATH = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/;

export const spreadsheetIdOf = (input: string): string | null => {
  const text = input.trim();
  const fromUrl = SPREADSHEET_PATH.exec(text);
  if (fromUrl?.[1]) return fromUrl[1];
  return SPREADSHEET_ID.test(text) ? text : null;
};

export const spreadsheetUrl = (id: string, sheetId?: number): string =>
  `https://docs.google.com/spreadsheets/d/${id}/edit${sheetId === undefined ? '' : `#gid=${sheetId}`}`;

export const SOURCE_TIME_ZONE = 'America/Santiago';

export const sheetsRevisionLabel = (
  at: Date,
  timeZone: string = SOURCE_TIME_ZONE,
): string => {
  const parts = new Intl.DateTimeFormat('es-CL', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '00';
  return `Sheets ${part('day')}-${part('month')} ${part('hour')}:${part('minute')}:${part('second')}`;
};
