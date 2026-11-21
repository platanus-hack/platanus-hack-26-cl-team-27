import type {
  AccountAuthorizer,
  ConnectionRepository,
  RevisionSink,
  SourceLinkRepository,
  SpreadsheetReader,
  SpreadsheetSnapshot,
  StoredConnection,
} from '../../src/application/ports/index.ts';
import type { SourceLink } from '../../src/domain/Connection.ts';
import { BUDGET_V2 } from '../fixtures.ts';

export const CONNECTION: StoredConnection = {
  id: 'c1',
  provider: 'google',
  accountEmail: 'daniela@example.com',
  scopes: ['email'],
  connectedAt: new Date('2026-11-21T10:00:00Z'),
  refreshToken: 'refresh-1',
};

export const SOURCE: SourceLink = {
  id: 's1',
  connectionId: 'c1',
  provider: 'google',
  externalId: 'sheet-1',
  documentId: 'presupuesto',
  title: 'Presupuesto Los Aromos',
  pointer: 'https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=0',
  checkedAt: null,
  lastRead: null,
  lastError: null,
  createdAt: new Date('2026-11-21T10:00:00Z'),
};

export const SNAPSHOT: SpreadsheetSnapshot = {
  title: 'Presupuesto Los Aromos',
  tab: BUDGET_V2,
  pointer: SOURCE.pointer,
  contentHash: 'a'.repeat(64),
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

export const reader = (snapshot: SpreadsheetSnapshot = SNAPSHOT) => ({
  read: vi.fn<SpreadsheetReader['read']>().mockResolvedValue(snapshot),
});

export const sources = (found: SourceLink | null = SOURCE) => ({
  list: vi
    .fn<SourceLinkRepository['list']>()
    .mockResolvedValue(found ? [found] : []),
  find: vi.fn<SourceLinkRepository['find']>().mockResolvedValue(found),
  findByDocument: vi
    .fn<SourceLinkRepository['findByDocument']>()
    .mockResolvedValue(null),
  create: vi
    .fn<SourceLinkRepository['create']>()
    .mockImplementation(async (draft) => ({ ...SOURCE, ...draft })),
  recordCheck: vi
    .fn<SourceLinkRepository['recordCheck']>()
    .mockImplementation(async (_id, at, title) => ({
      ...SOURCE,
      checkedAt: at,
      title,
    })),
  recordRead: vi
    .fn<SourceLinkRepository['recordRead']>()
    .mockImplementation(async (_id, read, title) => ({
      ...SOURCE,
      checkedAt: read.at,
      lastRead: read,
      title,
    })),
  recordError: vi
    .fn<SourceLinkRepository['recordError']>()
    .mockImplementation(async (_id, error) => ({
      ...SOURCE,
      lastError: error,
    })),
  remove: vi.fn<SourceLinkRepository['remove']>().mockResolvedValue(true),
});

export const sink = (epoch: number | null = 1) => ({
  epoch: vi.fn<RevisionSink['epoch']>().mockResolvedValue(epoch),
  deliver: vi.fn<RevisionSink['deliver']>().mockResolvedValue({
    revisionId: 'r1',
    proposals: 1,
    summary: 'Llegó la revisión: abrimos 1 propuesta y avisamos a 2 personas.',
  }),
});
