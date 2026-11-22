import { IntegrationError } from '../errors.ts';
import type { ConnectionRepository, StoredConnection } from '../ports/index.ts';

export const requireGoogle = async (
  connections: ConnectionRepository,
): Promise<StoredConnection> => {
  const connection = await connections.find('google');
  if (connection === null) {
    throw new IntegrationError(
      'not_connected',
      'Conecta tu cuenta de Google para leer la planilla',
    );
  }
  return connection;
};
