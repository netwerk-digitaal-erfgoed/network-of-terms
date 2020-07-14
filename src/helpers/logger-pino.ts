import { Logger } from '@comunica/core';
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

  // tslint:disable-next-line:no-any
  debug(message: string, data?: any): void {
    this.logger.debug(message, data);
  }

  // tslint:disable-next-line:no-any
  error(message: string, data?: any): void {
    this.logger.error(message, data);
  }

  // tslint:disable-next-line:no-any
  fatal(message: string, data?: any): void {
    this.logger.fatal(message, data);
  }

  // tslint:disable-next-line:no-any
  info(message: string, data?: any): void {
    this.logger.info(message, data);
  }

  // tslint:disable-next-line:no-any
  trace(message: string, data?: any): void {
    this.logger.trace(message, data);
  }

  // tslint:disable-next-line:no-any
  warn(message: string, data?: any): void {
    this.logger.warn(message, data);
  }
}
