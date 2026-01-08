# Winston Logger Usage Examples

This document provides examples of how to use the Winston logger in your NestJS application.

## Basic Usage

### In Controllers

```typescript
import { Controller, Get } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly logger: LoggerService) {}

  @Get()
  findAll() {
    this.logger.log('Fetching all posts', 'PostsController');
    // Your logic here
  }
}
```

### In Services

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class PostsService {
  constructor(private readonly logger: LoggerService) {}

  async create(data: any) {
    this.logger.log('Creating new post', 'PostsService');
    
    try {
      // Your logic here
      this.logger.log(`Post created successfully: ${data.title}`, 'PostsService');
    } catch (error) {
      this.logger.error(
        `Failed to create post: ${error.message}`,
        error.stack,
        'PostsService'
      );
      throw error;
    }
  }
}
```

## Advanced Usage

### Structured Logging with Metadata

```typescript
this.logger.logWithMetadata(
  'info',
  'User performed action',
  {
    userId: user.id,
    action: 'update_profile',
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  },
  'UserService'
);
```

### HTTP Request Logging

The `LoggingInterceptor` automatically logs all HTTP requests, but you can also manually log requests:

```typescript
this.logger.logRequest(
  'POST',
  '/api/v1/posts',
  201,
  150, // response time in ms
  user.id
);
```

### Database Query Logging

```typescript
const startTime = Date.now();
const result = await this.prisma.post.findMany();
const duration = Date.now() - startTime;

this.logger.logDatabaseQuery(
  'SELECT * FROM posts',
  duration,
  'PostsService'
);
```

### Security Event Logging

```typescript
this.logger.logSecurityEvent('failed_login_attempt', {
  email: loginDto.email,
  ipAddress: request.ip,
  timestamp: new Date().toISOString(),
});
```

## Log Levels

Winston supports the following log levels (in order of priority):

1. **error**: Error messages that need immediate attention
2. **warn**: Warning messages for potentially harmful situations
3. **info**: Informational messages about application flow
4. **debug**: Detailed information for debugging (not logged in production by default)
5. **verbose**: Very detailed information

### Examples

```typescript
// Error - for exceptions and critical issues
this.logger.error('Database connection failed', error.stack, 'DatabaseService');

// Warn - for deprecations, unusual situations
this.logger.warn('API rate limit approaching threshold', 'RateLimitService');

// Info - for general application flow
this.logger.log('User logged in successfully', 'AuthService');

// Debug - for development debugging
this.logger.debug('Processing payment with data: ' + JSON.stringify(data), 'PaymentService');

// Verbose - for very detailed tracing
this.logger.verbose('Cache hit for key: user:123', 'CacheService');
```

## Log Files

Logs are automatically written to the following files in the `logs/` directory:

- **error-YYYY-MM-DD.log**: Error-level logs only
- **combined-YYYY-MM-DD.log**: All log levels
- **info-YYYY-MM-DD.log**: Info-level logs (production only)
- **exceptions.log**: Uncaught exceptions
- **rejections.log**: Unhandled promise rejections

### Log Rotation

Logs are automatically rotated daily with the following settings:
- Maximum file size: 20MB
- Retention period: 14 days for combined/error logs, 7 days for info logs

## Production vs Development

### Development
- Log level: `debug` (shows all logs)
- Console output: Colorized and formatted for readability
- File output: JSON format for all levels

### Production
- Log level: `info` (hides debug and verbose logs)
- Console output: Colorized and formatted
- File output: JSON format for log aggregation tools
- Additional info log file for production monitoring

## Integration with Log Aggregation Tools

The JSON format in log files makes it easy to integrate with tools like:

- **AWS CloudWatch**: Use CloudWatch Logs agent
- **Datadog**: Use Datadog agent with log collection
- **Elasticsearch/Logstash/Kibana (ELK)**: Use Logstash to parse JSON logs
- **Splunk**: Configure Splunk forwarder to read log files

### Example: Adding CloudWatch Transport

```typescript
// In logger.config.ts
import WinstonCloudWatch from 'winston-cloudwatch';

// Add to transports array
new WinstonCloudWatch({
  logGroupName: 'ethica-blog',
  logStreamName: `${nodeEnv}-${new Date().toISOString().split('T')[0]}`,
  awsRegion: process.env.AWS_REGION,
  jsonMessage: true,
})
```

## Best Practices

1. **Always include context**: Pass the class/module name as context
2. **Use appropriate log levels**: Don't log everything as `error`
3. **Avoid logging sensitive data**: Never log passwords, tokens, or PII
4. **Use structured logging**: Include metadata for better searchability
5. **Log errors with stack traces**: Always include `error.stack` for errors
6. **Don't over-log**: Avoid logging in tight loops or high-frequency operations
7. **Use meaningful messages**: Make log messages searchable and actionable

## Example: Complete Service with Logging

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findOne(id: string) {
    this.logger.debug(`Finding post with ID: ${id}`, 'PostsService');
    
    const startTime = Date.now();
    
    try {
      const post = await this.prisma.post.findUnique({ where: { id } });
      
      const duration = Date.now() - startTime;
      this.logger.logDatabaseQuery(`findUnique post ${id}`, duration, 'PostsService');
      
      if (!post) {
        this.logger.warn(`Post not found: ${id}`, 'PostsService');
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      
      this.logger.log(`Successfully retrieved post: ${id}`, 'PostsService');
      return post;
      
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(
        `Failed to retrieve post ${id}: ${error.message}`,
        error.stack,
        'PostsService'
      );
      throw error;
    }
  }
}
```
