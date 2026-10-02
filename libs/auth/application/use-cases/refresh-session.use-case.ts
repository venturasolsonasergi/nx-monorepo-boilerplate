import type { AuthProvider } from '../auth-provider.port';

export interface RefreshSessionOutput {
  userId: string;
  status: 'authenticated';
  setCookie: string[];
}

export class RefreshSessionUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    cookieHeader: string | undefined,
  ): Promise<RefreshSessionOutput> {
    const { session, setCookie } = await this.provider.refresh(cookieHeader);
    return { userId: session.userId, status: 'authenticated', setCookie };
  }
}
