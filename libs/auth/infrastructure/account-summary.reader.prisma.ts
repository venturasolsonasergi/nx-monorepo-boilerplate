import { Inject, Injectable } from '@nestjs/common';
import type {
  AccountSummary,
  AccountSummaryReader,
} from '../application/account-summary.reader';
import { AuthPrismaService } from './prisma/prisma.service';

const CREDENTIAL_PROVIDER = 'credential';

@Injectable()
export class AccountSummaryPrismaReader implements AccountSummaryReader {
  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
  ) {}

  async read(userId: string): Promise<AccountSummary | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return null;
    }

    const credential = await this.prisma.account.findFirst({
      where: { userId, providerId: CREDENTIAL_PROVIDER },
      select: { password: true, updatedAt: true },
    });

    return {
      email: user.email,
      hasPassword: Boolean(credential?.password),
      passwordUpdatedAt: credential?.password ? credential.updatedAt : null,
    };
  }
}
