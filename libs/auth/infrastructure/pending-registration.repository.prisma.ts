import { Inject, Injectable } from '@nestjs/common';
import {
  PendingRegistration,
  REGISTRATION_TTL_SECONDS,
  addSeconds,
  type PendingRegistrationProps,
} from '../domain/pending-registration';
import type {
  PendingRegistrationRepository,
  ResolveRegistrationResult,
} from '../application/pending-registration.repository';
import { AuthPrismaService } from './prisma/prisma.service';

interface PendingRegistrationRow {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  tokenHash: string | null;
  consumedAt: Date | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPendingRegistration(
  row: PendingRegistrationRow,
): PendingRegistration {
  const props: PendingRegistrationProps = {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    tokenHash: row.tokenHash,
    consumedAt: row.consumedAt,
  };

  return new PendingRegistration(props);
}

@Injectable()
export class PendingRegistrationPrismaRepository implements PendingRegistrationRepository {
  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
  ) {}

  async findByEmail(email: string): Promise<PendingRegistration | null> {
    const record = await this.prisma.pendingRegistration.findUnique({
      where: { email: normalizeEmail(email) },
    });

    return record ? toPendingRegistration(record) : null;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<PendingRegistration | null> {
    const record = await this.prisma.pendingRegistration.findUnique({
      where: { tokenHash },
    });

    return record ? toPendingRegistration(record) : null;
  }

  async resolveForRequest(input: {
    email: string;
    now: Date;
    newId: string;
  }): Promise<ResolveRegistrationResult> {
    const email = normalizeEmail(input.email);
    const expiresAt = addSeconds(input.now, REGISTRATION_TTL_SECONDS);

    return this.prisma.$transaction(async (tx) => {
      // Insert-if-absent without racing a concurrent creator for this email.
      await tx.$executeRaw`
        INSERT INTO "auth_pending_registrations"
          ("id", "email", "created_at", "expires_at", "token_hash", "consumed_at")
        VALUES (${input.newId}, ${email}, ${input.now}, ${expiresAt}, NULL, NULL)
        ON CONFLICT ("email") DO NOTHING
      `;

      const rows = await tx.$queryRaw<PendingRegistrationRow[]>`
        SELECT
          "id" AS "id",
          "email" AS "email",
          "created_at" AS "createdAt",
          "expires_at" AS "expiresAt",
          "token_hash" AS "tokenHash",
          "consumed_at" AS "consumedAt"
        FROM "auth_pending_registrations"
        WHERE "email" = ${email}
        FOR UPDATE
      `;

      const current = rows[0];
      if (!current) {
        throw new Error('Pending registration vanished during resolution');
      }

      if (current.id === input.newId) {
        return {
          registration: toPendingRegistration(current),
          restarted: true,
        };
      }

      const active =
        current.consumedAt === null &&
        current.expiresAt.getTime() > input.now.getTime();
      if (active) {
        return {
          registration: toPendingRegistration(current),
          restarted: false,
        };
      }

      await tx.$executeRaw`
        DELETE FROM "auth_pending_registrations" WHERE "id" = ${current.id}
      `;
      await tx.$executeRaw`
        INSERT INTO "auth_pending_registrations"
          ("id", "email", "created_at", "expires_at", "token_hash", "consumed_at")
        VALUES (${input.newId}, ${email}, ${input.now}, ${expiresAt}, NULL, NULL)
      `;

      return {
        registration: PendingRegistration.initiate({
          id: input.newId,
          email,
          initiatedAt: input.now,
        }),
        restarted: true,
      };
    });
  }

  async saveTokenHash(registration: PendingRegistration): Promise<void> {
    await this.prisma.pendingRegistration.update({
      where: { id: registration.props.id },
      data: { tokenHash: registration.props.tokenHash },
    });
  }

  async consume(input: {
    id: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean> {
    const result = await this.prisma.pendingRegistration.updateMany({
      where: {
        id: input.id,
        tokenHash: input.tokenHash,
        consumedAt: null,
        expiresAt: { gt: input.now },
      },
      data: { consumedAt: input.now },
    });

    return result.count === 1;
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.prisma.pendingRegistration.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    return result.count;
  }
}
