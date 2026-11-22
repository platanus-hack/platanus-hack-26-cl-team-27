import type {
  AccountAuthorizer,
  ConnectionRepository,
  FileWatcher,
  SourceLinkRepository,
} from '../ports/index.ts';
import { connectionOf } from './requireGoogle.ts';

export class UnsubscribeSource {
  private readonly connections: ConnectionRepository;
  private readonly authorizer: AccountAuthorizer;
  private readonly watcher: FileWatcher;
  private readonly sources: SourceLinkRepository;

  constructor(
    connections: ConnectionRepository,
    authorizer: AccountAuthorizer,
    watcher: FileWatcher,
    sources: SourceLinkRepository,
  ) {
    this.connections = connections;
    this.authorizer = authorizer;
    this.watcher = watcher;
    this.sources = sources;
  }

  async execute(id: string): Promise<boolean> {
    const source = await this.sources.find(id);
    if (source?.channel == null) return false;
    const { channel } = source;
    await this.sources.saveChannel(source.id, null);
    try {
      const connection = await connectionOf(this.connections, source);
      const token = await this.authorizer.accessToken(connection.refreshToken);
      await this.watcher.stop(token, channel);
      return true;
    } catch {
      return false;
    }
  }
}
