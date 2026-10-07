import type { AuthProvider } from '../auth-provider.port';
import type { RequestContext } from '../request-context';

export interface RefreshSessionOutput {
  userId: string;
  status: 'authenticated';
  setCookie: string[];
}

export class RefreshSessionUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<RefreshSessionOutput> {
    const { session, setCookie } = await this.provider.refresh(
      cookieHeader,
      context,
    );
    return { userId: session.userId, status: 'authenticated', setCookie };
  }
}
