import type { AuthProvider, OAuthStartResult } from '../auth-provider.port';
import { UnsupportedProviderError } from '../auth.errors';

export interface BeginOAuthInput {
  provider: string;
  callbackURL: string;
}

export class BeginOAuthUseCase {
  constructor(
    private readonly provider: AuthProvider,
    private readonly allowedProviders: string[],
  ) {}

  execute(input: BeginOAuthInput): Promise<OAuthStartResult> {
    if (!this.allowedProviders.includes(input.provider)) {
      throw new UnsupportedProviderError(input.provider);
    }

    return this.provider.startOAuth({
      provider: input.provider,
      callbackURL: input.callbackURL,
    });
  }
}
