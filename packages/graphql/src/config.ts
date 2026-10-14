import { envSchema, JSONSchemaType } from 'env-schema';

const schema = {
  type: 'object',
  properties: {
    TRUST_PROXY: {
      type: 'boolean',
      default: false,
    },
    STATUS_SERVICE_URL: {
      type: 'string',
      default: 'https://status.termennetwerk.netwerkdigitaalerfgoed.nl',
      description: 'Base URL of the status service',
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
    },
    MAX_LOOKUP_URIS: {
      type: 'number',
      default: 1000,
      description:
        'Maximum number of URIs in a single lookup. Not a limit anyone should meet in normal use: ' +
        'the query service splits a lookup into batches per source and sizes them to what each ' +
        'source will take. It is there so that one request cannot occupy a source indefinitely - ' +
        'a thousand URIs is already minutes of work at the slowest source.',
    },
  },
};

interface Env {
  TRUST_PROXY: boolean;
  STATUS_SERVICE_URL: string;
  LOG_LEVEL: string;
  MAX_LOOKUP_URIS: number;
}

export const config: JSONSchemaType<Env> = envSchema({
  schema,
});
