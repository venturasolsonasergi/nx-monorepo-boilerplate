import type { AuthProvider, AuthenticatedSession } from '../auth-provider.port';
import type { RequestContext } from '../request-context';

export class ValidateSessionUseCase {
  constructor(private readonly provider: AuthProvider) {}

  execute(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<AuthenticatedSession | null> {
    return this.provider.getSession(cookieHeader, context);
  }
}
