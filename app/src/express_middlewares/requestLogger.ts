import { LogProvider } from './../logger';

export const requestLogger = (logger: LogProvider): any => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
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
    maxSize: 1024 * 1024 * 50,
    maxFiles: 5,
  },
  format: 'simple',
});