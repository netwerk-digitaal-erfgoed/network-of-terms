import {envSchema, JSONSchemaType} from 'env-schema';

const schema = {
  type: 'object',
  properties: {
    MAX_QUERY_TIMEOUT: {
      type: 'number',
      default: 60000,
    },
    DEFAULT_QUERY_TIMEOUT: {
      type: 'number',
      default: 5000,
    },
  },
};

interface Env {
  MAX_QUERY_TIMEOUT: number;
  DEFAULT_QUERY_TIMEOUT: number;
}

export const config: JSONSchemaType<Env> = envSchema({
  schema,
});
