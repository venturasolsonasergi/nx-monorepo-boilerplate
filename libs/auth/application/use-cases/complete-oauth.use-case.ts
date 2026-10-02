import type {
  AuthProvider,
  CompleteOAuthInput,
  OAuthCallbackResult,
} from '../auth-provider.port';
import { UnsupportedProviderError } from '../auth.errors';

export class CompleteOAuthUseCase {
  constructor(
    private readonly provider: AuthProvider,
    private readonly allowedProviders: string[],
  ) {}

  execute(input: CompleteOAuthInput): Promise<OAuthCallbackResult> {
    if (!this.allowedProviders.includes(input.provider)) {
      throw new UnsupportedProviderError(input.provider);
    }

    return this.provider.completeOAuth(input);
  }
}
