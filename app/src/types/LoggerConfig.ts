export interface LoggerConfig {
  stdout?: boolean;
  file?: {
    filename: string;
    maxSize?: string;
    maxFiles?: number;
  };
  database?: {
    connectionString: string;
    tableName: string;
  };
  format?: 'json' | 'simple';
}