import type { AuthProvider } from '../auth-provider.port';
import { InvalidSessionError } from '../auth.errors';
import type { RequestContext } from '../request-context';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordOutput {
  status: 'ok';
  setCookie: string[];
}

export class ChangePasswordUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    input: ChangePasswordInput,
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<ChangePasswordOutput> {
    const session = await this.provider.getSession(cookieHeader, context);
    if (!session) {
      throw new InvalidSessionError();
    }

    const setCookie = await this.provider.changePassword(
      {
        cookieHeader,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
      context,
    );

    return { status: 'ok', setCookie };
  }
}
