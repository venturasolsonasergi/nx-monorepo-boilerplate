import type { RequestContext } from '../request-context';
import type { AuthProvider } from '../auth-provider.port';
import type {
  AccountSummary,
  AccountSummaryReader,
} from '../account-summary.reader';
import { InvalidSessionError } from '../auth.errors';

export class GetAccountSummaryUseCase {
  constructor(
    private readonly provider: AuthProvider,
    private readonly reader: AccountSummaryReader,
  ) {}

  async execute(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<AccountSummary> {
    const session = await this.provider.getSession(cookieHeader, context);
    if (!session) {
      throw new InvalidSessionError();
    }

    const summary = await this.reader.read(session.userId);
    if (!summary) {
      throw new InvalidSessionError();
    }

    return summary;
  }
}
