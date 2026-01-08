import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, context, trace, ...metadata }) => {
  let msg = `${timestamp} [${context || 'Application'}] ${level}: ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  // Add stack trace for errors
  if (trace) {
    msg += `\n${trace}`;
  }
  
  return msg;
});

export const winstonConfig = (nodeEnv: string): WinstonModuleOptions => {
  const isProduction = nodeEnv === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: combine(
          colorize({ all: true }),
          consoleFormat,
        ),
      }),

      // Error log file - daily rotation
      new winston.transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d', // Keep logs for 14 days
        format: combine(json()),
      }),

      // Combined log file - daily rotation
      new winston.transports.DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: combine(json()),
      }),

      // Info log file (production only)
      ...(isProduction
        ? [
            new winston.transports.DailyRotateFile({
              filename: 'logs/info-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              level: 'info',
              maxSize: '20m',
              maxFiles: '7d',
              format: combine(json()),
            }),
          ]
        : []),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
  };
};
