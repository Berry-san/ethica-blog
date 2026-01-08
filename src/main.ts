import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
// Note: AuditInterceptor is registered via APP_INTERCEPTOR in AuditModule

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Get ConfigService for environment variables
  const configService = app.get(ConfigService);

  // Global Response Interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global Logging Interceptor (logs all HTTP requests)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global Exception Filter (catches all errors)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api/v1');

  // Security: Helmet for security headers
  app.use(helmet());

  // CORS Configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://ethicamfb.com',
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Ethica Blog API')
    .setDescription('Production-ready blog API with authentication, authorization, and file uploads')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('posts', 'Blog post management')
    .addTag('categories', 'Category management')
    .addTag('subscribers', 'Newsletter subscription')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') || 5500;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/v1/docs`);
  logger.log(`🔒 CORS enabled for: ${corsOrigins.join(', ')}`);
  logger.log(`Environment: ${configService.get('NODE_ENV')}`);
}

bootstrap();
