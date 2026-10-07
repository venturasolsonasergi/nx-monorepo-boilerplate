export const VERIFICATION_MAILER = Symbol('VERIFICATION_MAILER');

export interface VerificationMailer {
  sendVerification(email: string, token: string): Promise<void>;
}
