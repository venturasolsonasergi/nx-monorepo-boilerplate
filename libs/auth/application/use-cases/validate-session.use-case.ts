import type { AuthProvider, AuthenticatedSession } from '../auth-provider.port';

export class ValidateSessionUseCase {
  constructor(private readonly provider: AuthProvider) {}

  execute(
    cookieHeader: string | undefined,
  ): Promise<AuthenticatedSession | null> {
    return this.provider.getSession(cookieHeader);
  }
}
