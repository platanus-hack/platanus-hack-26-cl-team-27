import type { SourceLink } from '../../domain/Connection.ts';
import { IntegrationError } from '../errors.ts';
import type { ConnectionRepository, StoredConnection } from '../ports/index.ts';

export const SOURCE_NOT_FOUND = 'Esa planilla ya no está vinculada';

export const ORPHAN_SOURCE =
  'La cuenta de Google que leía esta planilla ya no está conectada: vuelve a vincularla con la tuya';

export const requireGoogle = async (
  connections: ConnectionRepository,
  userId: string,
): Promise<StoredConnection> => {
  const connection = await connections.findForUser(userId, 'google');
  if (connection === null) {
    throw new IntegrationError(
      'not_connected',
      'Conecta tu cuenta de Google para leer la planilla',
    );
  }
  return connection;
};

export const connectionOf = async (
  connections: ConnectionRepository,
  source: SourceLink,
): Promise<StoredConnection> => {
  const connection =
    source.connectionId === null
      ? null
      : await connections.find(source.connectionId);
  if (connection === null) {
    throw new IntegrationError('not_connected', ORPHAN_SOURCE);
  }
  return connection;
};

export const sourceNotFound = (): IntegrationError =>
  new IntegrationError('source_not_found', SOURCE_NOT_FOUND);
