import type {
  AccountAuthorizer,
  ChangeListener,
  ConnectionRepository,
  SourceLinkRepository,
  SpreadsheetContent,
  SpreadsheetReader,
  StoredConnection,
} from '../../src/application/ports/index.ts';
import type { SourceLink } from '../../src/domain/Connection.ts';
import { InMemorySnapshotCache } from '../../src/infra/adapters/InMemorySnapshotCache.ts';
import { BUDGET } from '../fixtures.ts';

export const SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab';

export const CONNECTION: StoredConnection = {
  id: 'c1',
  provider: 'google',
  accountEmail: 'daniela@example.com',
  scopes: ['email'],
  connectedAt: new Date('2026-11-21T10:00:00Z'),
  refreshToken: 'refresh-1',
};

export const CONTENT: SpreadsheetContent = {
  title: 'Presupuesto Los Aromos',
  tabs: BUDGET.tabs,
  pointer: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
  contentHash: 'a'.repeat(64),
};

export const SOURCE: SourceLink = {
  id: 's1',
  connectionId: 'c1',
  provider: 'google',
  externalId: SHEET_ID,
  title: CONTENT.title,
  pointer: CONTENT.pointer,
  contentHash: CONTENT.contentHash,
  checkedAt: new Date('2026-11-21T10:00:00Z'),
  changedAt: null,
  lastError: null,
  createdAt: new Date('2026-11-21T10:00:00Z'),
};

export const connections = (found: StoredConnection | null = CONNECTION) => ({
  find: vi.fn<ConnectionRepository['find']>().mockResolvedValue(found),
  save: vi.fn<ConnectionRepository['save']>(),
  remove: vi.fn<ConnectionRepository['remove']>(),
});

export const authorizer = () => ({
  authorizationUrl: vi.fn<AccountAuthorizer['authorizationUrl']>(),
  exchange: vi.fn<AccountAuthorizer['exchange']>(),
  accessToken: vi
    .fn<AccountAuthorizer['accessToken']>()
    .mockResolvedValue('access-1'),
});

export const reader = (content: SpreadsheetContent = CONTENT) => ({
  read: vi.fn<SpreadsheetReader['read']>().mockResolvedValue(content),
});

export const sources = (found: SourceLink | null = SOURCE) => ({
  list: vi
    .fn<SourceLinkRepository['list']>()
    .mockResolvedValue(found ? [found] : []),
  find: vi.fn<SourceLinkRepository['find']>().mockResolvedValue(found),
  findByExternalId: vi
    .fn<SourceLinkRepository['findByExternalId']>()
    .mockResolvedValue(null),
  create: vi
    .fn<SourceLinkRepository['create']>()
    .mockImplementation(async (draft) => ({ ...SOURCE, ...draft })),
  recordCheck: vi
    .fn<SourceLinkRepository['recordCheck']>()
    .mockImplementation(async (_id, check) => ({
      ...SOURCE,
      title: check.title,
      contentHash: check.contentHash,
      checkedAt: check.at,
      changedAt: check.changed ? check.at : SOURCE.changedAt,
    })),
  recordError: vi
    .fn<SourceLinkRepository['recordError']>()
    .mockImplementation(async (_id, error) => ({
      ...SOURCE,
      lastError: error,
    })),
  remove: vi.fn<SourceLinkRepository['remove']>().mockResolvedValue(true),
});

export const snapshots = () => new InMemorySnapshotCache();

export const listener = () => ({
  changed: vi.fn<ChangeListener['changed']>().mockResolvedValue(undefined),
});
