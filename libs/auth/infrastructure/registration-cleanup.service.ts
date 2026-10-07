import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  REGISTRATION_REPOSITORY,
  type PendingRegistrationRepository,
} from '../application/pending-registration.repository';
import {
  VERIFICATION_THROTTLE_REPOSITORY,
  type VerificationThrottleRepository,
} from '../application/verification-throttle.repository';
import type { AuthConfig } from './auth.config';
import { AUTH_CONFIG } from './auth.config';
import { AuthPrismaService } from './prisma/prisma.service';

@Injectable()
export class RegistrationCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RegistrationCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: PendingRegistrationRepository,
    @Inject(VERIFICATION_THROTTLE_REPOSITORY)
    private readonly throttle: VerificationThrottleRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(intervalMs?: number): void {
    if (this.timer) {
      return;
    }

    const ms =
      intervalMs ??
      Math.floor(this.config.verificationLimits.retentionSeconds * 500);
    this.timer = setInterval(() => {
      void this.runSafely();
    }, ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Runs one cleanup pass without leaking rejections from the timer and
   * without overlapping a still-running pass. A failure is logged and does not
   * affect later runs.
   */
  async runSafely(now?: Date): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.execute(now);
    } catch (error) {
      this.logger.error(
        'Registration cleanup failed',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async execute(now?: Date): Promise<void> {
    const n = now ?? new Date();
    const cutoff = new Date(
      n.getTime() - this.config.verificationLimits.retentionSeconds * 1000,
    );

    await this.registrations.deleteExpired(n);
    await this.throttle.deleteOlderThan(cutoff);
  }
}
