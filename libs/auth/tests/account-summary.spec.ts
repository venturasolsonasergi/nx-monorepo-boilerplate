/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from '@jest/globals';
import type { RequestContext } from '../application/request-context';
import type {
  AuthProvider,
  AuthenticatedSession,
} from '../application/auth-provider.port';
import type {
  AccountSummary,
  AccountSummaryReader,
} from '../application/account-summary.reader';
import { InvalidSessionError } from '../application/auth.errors';
import { GetAccountSummaryUseCase } from '../application/use-cases/get-account-summary.use-case';
import { AccountSummaryPrismaReader } from '../infrastructure/account-summary.reader.prisma';

const CONTEXT: RequestContext = { sourceIp: '203.0.113.1' };

class InMemoryAccountSummaryReader implements AccountSummaryReader {
  summaries = new Map<string, AccountSummary>();

  async read(userId: string): Promise<AccountSummary | null> {
    return this.summaries.get(userId) ?? null;
  }
}

class StubAuthProvider implements Partial<AuthProvider> {
  constructor(private readonly session: AuthenticatedSession | null) {}

  async getSession(): Promise<AuthenticatedSession | null> {
    return this.session;
  }
}

function useCaseWith(
  session: AuthenticatedSession | null,
  reader: AccountSummaryReader,
): GetAccountSummaryUseCase {
  return new GetAccountSummaryUseCase(
    new StubAuthProvider(session) as AuthProvider,
    reader,
  );
}

describe('GetAccountSummaryUseCase', () => {
  it('returns the summary of the session identity', async () => {
    const reader = new InMemoryAccountSummaryReader();
    reader.summaries.set('user-1', {
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: new Date('2026-01-02T03:04:05.000Z'),
    });

    const useCase = useCaseWith(
      {
        userId: 'user-1',
        email: 'ada@example.com',
        emailVerified: true,
      },
      reader,
    );

    await expect(useCase.execute('cookie', CONTEXT)).resolves.toEqual({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: new Date('2026-01-02T03:04:05.000Z'),
    });
  });

  it('rejects an absent session with InvalidSessionError', async () => {
    const useCase = useCaseWith(null, new InMemoryAccountSummaryReader());

    await expect(useCase.execute(undefined, CONTEXT)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it('rejects with InvalidSessionError when the identity has no summary', async () => {
    const useCase = useCaseWith(
      {
        userId: 'user-2',
        email: 'grace@example.com',
        emailVerified: true,
      },
      new InMemoryAccountSummaryReader(),
    );

    await expect(useCase.execute('cookie', CONTEXT)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });
});

interface UserRow {
  id: string;
  email: string;
}

interface AccountRow {
  userId: string;
  providerId: string;
  password: string | null;
  updatedAt: Date;
}

class InMemoryAuthPrisma {
  users: UserRow[] = [];
  accounts: AccountRow[] = [];

  get user() {
    return {
      findUnique: async ({ where }: { where: { id: string } }) =>
        this.users.find((user) => user.id === where.id) ?? null,
    };
  }

  get account() {
    return {
      findFirst: async ({
        where,
      }: {
        where: { userId: string; providerId?: string };
      }) =>
        this.accounts.find(
          (account) =>
            account.userId === where.userId &&
            (where.providerId === undefined ||
              account.providerId === where.providerId),
        ) ?? null,
    };
  }
}

function readerWith(prisma: InMemoryAuthPrisma): AccountSummaryPrismaReader {
  return new AccountSummaryPrismaReader(prisma as never);
}

describe('AccountSummaryPrismaReader', () => {
  it('reads the identity email and the credential account metadata', async () => {
    const prisma = new InMemoryAuthPrisma();
    prisma.users.push({ id: 'user-1', email: 'ada@example.com' });
    prisma.accounts.push({
      userId: 'user-1',
      providerId: 'credential',
      password: 'hash',
      updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    });

    await expect(readerWith(prisma).read('user-1')).resolves.toEqual({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: new Date('2026-01-02T03:04:05.000Z'),
    });
  });

  it('reports no password credential with a null timestamp', async () => {
    const prisma = new InMemoryAuthPrisma();
    prisma.users.push({ id: 'user-1', email: 'ada@example.com' });

    await expect(readerWith(prisma).read('user-1')).resolves.toEqual({
      email: 'ada@example.com',
      hasPassword: false,
      passwordUpdatedAt: null,
    });
  });

  it('ignores non-credential accounts', async () => {
    const prisma = new InMemoryAuthPrisma();
    prisma.users.push({ id: 'user-1', email: 'ada@example.com' });
    prisma.accounts.push({
      userId: 'user-1',
      providerId: 'google',
      password: null,
      updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    });

    await expect(readerWith(prisma).read('user-1')).resolves.toEqual({
      email: 'ada@example.com',
      hasPassword: false,
      passwordUpdatedAt: null,
    });
  });

  it('returns null when the identity does not exist', async () => {
    const prisma = new InMemoryAuthPrisma();

    await expect(readerWith(prisma).read('missing')).resolves.toBeNull();
  });
});
