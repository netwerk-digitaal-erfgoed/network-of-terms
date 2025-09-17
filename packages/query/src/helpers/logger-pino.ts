import { Logger } from '@comunica/types';
import Pino from 'pino';

export interface ConstructorOptions {
  logger: Pino.Logger;
}

export class LoggerPino extends Logger {
  protected logger: Pino.Logger;

  constructor(options: ConstructorOptions) {
    super();
    this.logger = options.logger;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, data?: any): void {
    this.logger.debug(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, data?: any): void {
    this.logger.error(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fatal(message: string, data?: any): void {
    this.logger.fatal(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, data?: any): void {
    this.logger.info(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace(message: string, data?: any): void {
    this.logger.trace(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, data?: any): void {
    this.logger.warn(message, data);
  }
}
