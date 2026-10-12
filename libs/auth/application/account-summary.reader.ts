export interface AccountSummary {
  email: string;
  name: string | null;
  hasPassword: boolean;
  passwordUpdatedAt: Date | null;
}

export const ACCOUNT_SUMMARY_READER = Symbol('ACCOUNT_SUMMARY_READER');

export interface AccountSummaryReader {
  read(userId: string): Promise<AccountSummary | null>;
}
