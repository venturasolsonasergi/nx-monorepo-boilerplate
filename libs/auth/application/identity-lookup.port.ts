export const IDENTITY_LOOKUP = Symbol('IDENTITY_LOOKUP');

export interface IdentityLookupPort {
  emailHasVerifiedIdentity(email: string): Promise<boolean>;
}
