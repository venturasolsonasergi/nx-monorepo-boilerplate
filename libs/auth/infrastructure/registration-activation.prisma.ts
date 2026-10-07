import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import {
  type RegistrationActivationInput,
  type RegistrationActivationPort,
  type RegistrationActivationResult,
} from '../application/registration-activation.port';
import {
  InvalidVerificationTokenError,
  RegistrationConflictError,
} from '../application/auth.errors';
import { CLOCK, type Clock } from '../application/clock.port';
import { Prisma } from './prisma/generated/client';
import { AuthPrismaService } from './prisma/prisma.service';

interface PendingRow {
  id: string;
  email: string;
  expires_at: Date;
  token_hash: string | null;
  consumed_at: Date | null;
}

const CREDENTIAL_PROVIDER = 'credential';

@Injectable()
export class RegistrationActivationPrismaAdapter implements RegistrationActivationPort {
  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async activate(
    input: RegistrationActivationInput,
  ): Promise<RegistrationActivationResult> {
    // Cheap preliminary check so invented/expired tokens never trigger an
    // expensive password hash. The definitive check happens under the lock.
    const preliminary = await this.prisma.pendingRegistration.findUnique({
      where: { tokenHash: input.tokenHash },
    });
    const preliminaryNow = this.clock.now();
    if (
      !preliminary ||
      preliminary.consumedAt !== null ||
      preliminary.expiresAt.getTime() <= preliminaryNow.getTime()
    ) {
      throw new InvalidVerificationTokenError();
    }

    const passwordHash = await hashPassword(input.password);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingRow[]>`
        SELECT "id", "email", "expires_at", "token_hash", "consumed_at"
        FROM "auth_pending_registrations"
        WHERE "token_hash" = ${input.tokenHash}
        FOR UPDATE
      `;

      const pending = rows[0];
      // Re-check with the authoritative time taken after the lock is held, so a
      // request that waited behind another transaction cannot activate a
      // registration whose deadline passed while it was waiting.
      const effectiveNow = this.clock.now();
      if (
        !pending ||
        pending.consumed_at !== null ||
        pending.expires_at.getTime() <= effectiveNow.getTime()
      ) {
        throw new InvalidVerificationTokenError();
      }

      const email = pending.email;
      const existing = await tx.user.findUnique({
        where: { email },
        include: { accounts: true },
      });

      let userId: string;
      if (existing) {
        if (existing.emailVerified) {
          throw new RegistrationConflictError();
        }

        const linked = existing.accounts.some(
          (account) => account.providerId !== CREDENTIAL_PROVIDER,
        );
        if (linked) {
          throw new RegistrationConflictError();
        }

        userId = existing.id;
        await tx.user.update({
          where: { id: userId },
          data: { emailVerified: true },
        });

        const credential = existing.accounts.find(
          (account) => account.providerId === CREDENTIAL_PROVIDER,
        );
        if (credential) {
          await tx.account.update({
            where: { id: credential.id },
            data: { password: passwordHash },
          });
        } else {
          await tx.account.create({
            data: {
              id: randomUUID(),
              accountId: userId,
              providerId: CREDENTIAL_PROVIDER,
              userId,
              password: passwordHash,
            },
          });
        }
      } else {
        userId = randomUUID();
        try {
          await tx.user.create({
            data: {
              id: userId,
              name: email.split('@')[0] ?? email,
              email,
              emailVerified: true,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new RegistrationConflictError();
          }
          throw error;
        }

        await tx.account.create({
          data: {
            id: randomUUID(),
            accountId: userId,
            providerId: CREDENTIAL_PROVIDER,
            userId,
            password: passwordHash,
          },
        });
      }

      await tx.pendingRegistration.update({
        where: { id: pending.id },
        data: { consumedAt: effectiveNow },
      });

      return { userId, email };
    });
  }
}
