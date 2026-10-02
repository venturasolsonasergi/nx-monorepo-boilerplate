import type { AuthProvider } from '../auth-provider.port';

export interface LogoutOutput {
  status: 'ok';
  setCookie: string[];
}

export class LogoutUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(cookieHeader: string | undefined): Promise<LogoutOutput> {
    const setCookie = await this.provider.logout(cookieHeader);
    return { status: 'ok', setCookie };
  }
}
