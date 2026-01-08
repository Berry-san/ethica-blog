import { Inject, Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Additional helper methods for structured logging
  logWithMetadata(level: string, message: string, metadata: Record<string, any>, context?: string) {
    this.logger.log(level, message, { ...metadata, context });
  }

  logRequest(method: string, url: string, statusCode: number, responseTime: number, userId?: string) {
    this.logger.info('HTTP Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId,
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: string) {
    this.logger.debug('Database Query', {
      context: context || 'Database',
      query,
      duration: `${duration}ms`,
    });
  }

  logSecurityEvent(event: string, details: Record<string, any>) {
    this.logger.warn('Security Event', {
      context: 'Security',
      event,
      ...details,
    });
  }
}
