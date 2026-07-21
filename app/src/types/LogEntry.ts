export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  meta?: any;
  requestId?: string;
}