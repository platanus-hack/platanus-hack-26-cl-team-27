import { ParseError, type RawFile, type Revision } from '../types.ts';
import { WHATSAPP_DOCUMENT } from '../vocabulary.ts';
import { finish, requirePerson } from './common.ts';

interface Message {
  readonly time: string;
  readonly sender: string;
  readonly body: string;
}

const MESSAGE_LINE =
  /^\[(\d{2}-\d{2}-\d{4}) (\d{2}:\d{2}):\d{2}\] ([^:]+): (.*)$/;

const messagesOf = (text: string): Message[] => {
  const messages: { time: string; sender: string; body: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const found = MESSAGE_LINE.exec(line);
    if (found) {
      messages.push({
        time: found[2] ?? '',
        sender: found[3] ?? '',
        body: found[4] ?? '',
      });
      continue;
    }
    const last = messages[messages.length - 1];
    if (last && line.trim() !== '') last.body = `${last.body} ${line.trim()}`;
  }
  return messages;
};

export const parseWhatsapp = (file: RawFile): Revision => {
  const messages = messagesOf(file.text);
  const last = messages[messages.length - 1];
  if (last === undefined) {
    throw new ParseError(file.relativePath, 'la exportación no tiene mensajes');
  }
  return finish(file, {
    documentId: WHATSAPP_DOCUMENT,
    label: `mensaje ${messages.length}`,
    authorId: requirePerson(file, last.sender),
    chunks: messages.map((message) => ({
      locator: `mensaje de las ${message.time}`,
      kind: 'mensaje' as const,
      text: message.body,
    })),
  });
};
