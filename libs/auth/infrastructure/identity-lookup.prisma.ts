import { Inject, Injectable } from '@nestjs/common';
import type { IdentityLookupPort } from '../application/identity-lookup.port';
import { AuthPrismaService } from './prisma/prisma.service';

@Injectable()
export class IdentityLookupPrismaAdapter implements IdentityLookupPort {
  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
  ) {}

  async emailHasVerifiedIdentity(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { emailVerified: true },
    });

    return Boolean(user?.emailVerified);
  }
}
