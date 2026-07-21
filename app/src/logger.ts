import fs from 'fs';
import path from 'path';
import { format, createLogger, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry, LogLevel } from './types/LogEntry';
import { LoggerConfig } from './types/LoggerConfig';

// Base logger class
export class LogProvider {
  private logger: any;
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = config;
    this.logger = createLogger({
      level: 'debug',
      format: this.getFormat(),
      transports: this.getTransports(),
    });
  }

  private getFormat(): any {
    const { format = 'simple' } = this.config;
    
    if (format === 'json') {
      return format.json();
    }
    
    return format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.prettyPrint()
    );
  }

  private getTransports(): any[] {
    const transportsArray: any[] = [];

    // Console transport
    if (this.config.stdout !== false) {
      transportsArray.push(new transports.Console({
        format: this.getFormat(),
      }));
    }

    // File transport
    if (this.config.file) {
      transportsArray.push(new transports.File({
        filename: this.config.file.filename,
        maxsize: this.config.file.maxSize || '50m',
        maxFiles: this.config.file.maxFiles || 5,
        format: this.getFormat(),
      }));
    }

    return transportsArray;
  }

  // Add database transport dynamically
  addDatabaseTransport(connectionString: string, tableName: string): void {
    // This is a simplified example - you'd implement actual DB logging here
    console.log('Database transport added (implement actual DB logging)');
    
    // Example implementation for MongoDB:
    /*
    const dbTransport = new transports.MongoDB({
      db: connectionString,
      collection: tableName,
      format: this.getFormat(),
    });
    this.logger.add(dbTransport);
    */
  }

  // Log methods
  error(message: string, meta?: any): void {
    this.logger.error(this.createLogEntry('error', message, meta));
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(this.createLogEntry('warn', message, meta));
  }

  info(message: string, meta?: any): void {
    this.logger.info(this.createLogEntry('info', message, meta));
  }

  http(message: string, meta?: any): void {
    this.logger.http(this.createLogEntry('http', message, meta));
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(this.createLogEntry('verbose', message, meta));
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(this.createLogEntry('debug', message, meta));
  }

  silly(message: string, meta?: any): void {
    this.logger.silly(this.createLogEntry('silly', message, meta));
  }

  // Helper method to create log entries
  private createLogEntry(level: LogLevel, message: string, meta?: any): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      meta,
      requestId: uuidv4(),
    };
  }

  // Method to get current logger instance (for middleware or custom usage)
  getInstance(): any {
    return this.logger;
  }
}

// Express middleware for request logging
export const requestLogger = (logger: LogProvider): any => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Log request
    logger.http(`Request started`, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      ip: req.ip,
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.http(`Request completed`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
};

// Export default instance
export const logger = new LogProvider({
  stdout: true,
  file: {
    filename: 'logs/app.log',
    maxSize: '50m',
    maxFiles: 5,
  },
});