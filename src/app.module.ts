import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { TokenCleanupTask } from './tasks/token-cleanup.task';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule, // Must be first to validate env vars
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CategoriesModule,
    SubscribersModule,
    CloudinaryModule,
    AuditModule,
    ThrottlerModule.forRoot([{
        ttl: 60000, // 60 seconds
        limit: 100, // Increased from 10 to 100 requests per minute
    }]),
  ],
  controllers: [],
  providers: [ TokenCleanupTask],
})
export class AppModule {}
