import type { AuthProvider } from '../auth-provider.port';
import type { RequestContext } from '../request-context';

export interface LogoutOutput {
  status: 'ok';
  setCookie: string[];
}

export class LogoutUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<LogoutOutput> {
    const setCookie = await this.provider.logout(cookieHeader, context);
    return { status: 'ok', setCookie };
  }
}
