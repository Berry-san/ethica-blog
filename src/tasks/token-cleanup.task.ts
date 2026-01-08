import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  // Run every day at 3 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    this.logger.log('Starting token cleanup...');

    try {
      // Clean expired blacklisted tokens
      await this.authService.cleanupBlacklistedTokens();

      // Clean expired/revoked refresh tokens
      const deletedRefreshTokens = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revoked: true },
          ],
        },
      });

      this.logger.log(
        `Cleanup completed. Removed ${deletedRefreshTokens.count} refresh tokens.`,
      );
    } catch (error) {
      this.logger.error('Token cleanup failed', error);
    }
  }

  // Optional: Run cleanup every hour for more frequent cleaning
//   @Cron(CronExpression.EVERY_HOUR)
//   async handleHourlyCleanup() {
//     try {
//       await this.authService.cleanupBlacklistedTokens();
//     } catch (error) {
//       this.logger.error('Hourly cleanup failed', error);
//     }
//   }
}

// ------------------------------
// app.module.ts - Add ScheduleModule
// ------------------------------
/*
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenCleanupTask } from './tasks/token-cleanup.task';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ... other modules
  ],
  providers: [TokenCleanupTask],
})
export class AppModule {}

// Install the required package:
// npm install @nestjs/schedule
*/