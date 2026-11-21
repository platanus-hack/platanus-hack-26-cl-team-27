const SPREADSHEET_ID = /^[A-Za-z0-9_-]{20,}$/;

const SPREADSHEET_PATH = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/;

export const spreadsheetIdOf = (input: string): string | null => {
  const text = input.trim();
  const fromUrl = SPREADSHEET_PATH.exec(text);
  if (fromUrl?.[1]) return fromUrl[1];
  return SPREADSHEET_ID.test(text) ? text : null;
};

export const spreadsheetUrl = (id: string): string =>
  `https://docs.google.com/spreadsheets/d/${id}/edit`;
