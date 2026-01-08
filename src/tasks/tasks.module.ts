import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCleanupTask } from './token-cleanup.task';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule],
  providers: [TokenCleanupTask, PrismaService],
  exports: [TokenCleanupTask],
})
export class TasksModule {}