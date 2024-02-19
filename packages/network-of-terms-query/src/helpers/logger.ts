import Joi from 'joi';
import Pino from 'pino';

export interface GetLoggerOptions {
  name: string;
  level: string;
}

const schemaGetLogger = Joi.object({
  name: Joi.string().required(),
  level: Joi.string().required(),
});

const baseOptions: Pino.LoggerOptions = {
  base: {
    name: undefined, // Don't log PID and hostname
  },
  level: 'warn',
  messageKey: 'message',
  formatters: {
    level(label) {
      return {
        level: label,
      };
    },
  },
};

export function getCliLogger(options: GetLoggerOptions): Pino.Logger {
  const args = Joi.attempt(options, schemaGetLogger);
  const loggerOptions = Object.assign(baseOptions, {
    base: {
      name: args.name,
    },
    level: args.level,
    prettyPrint: {
      colorize: true,
    },
  });
  const destinationStdErr = Pino.destination(2);
  return Pino(loggerOptions, destinationStdErr);
}

export function getHttpLogger(options: GetLoggerOptions): Pino.LoggerOptions {
  const args = Joi.attempt(options, schemaGetLogger);
  return Object.assign(baseOptions, {
    base: {
      name: args.name,
    },
    level: args.level,
  });
}
