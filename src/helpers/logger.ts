import * as Joi from '@hapi/joi';
import * as Pino from 'pino';

export interface GetLoggerOptions {
  name: string;
  level: string;
}

const schemaGetLogger = Joi.object({
  name: Joi.string().required(),
  level: Joi.string().required(),
});

export function getLogger(options: GetLoggerOptions): Pino.Logger {
  const args = Joi.attempt(options, schemaGetLogger);
  const destinationStdErr = Pino.destination(2);
  const loggerOptions: Pino.LoggerOptions = {
    base: {
      name: args.name, // Don't log PID and hostname
    },
    level: args.level,
    messageKey: 'message',
    formatters: {
      level(label) {
        return {
          log: {
            level: label,
          },
        };
      },
    },
    prettyPrint: {
      colorize: true,
      ignore: 'pid,hostname,time',
    },
  };
  return Pino(loggerOptions, destinationStdErr);
}
