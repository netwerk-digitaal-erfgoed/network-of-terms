import { envSchema } from 'env-schema';
import path from 'path';
import { fileURLToPath } from 'url';

const schema = {
  type: 'object',
  properties: {
    TRUST_PROXY: {
      type: 'boolean',
      default: false,
    },
    CATALOG_PATH: {
      type: 'string',
      default: path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'catalog',
      ),
    },
    STATUS_SERVICE_URL: {
      type: 'string',
      default: 'http://localhost:3000',
      description: 'Base URL of the status service',
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
    },
  },
};

export const config = envSchema({
  schema,
});
