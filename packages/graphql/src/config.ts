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
      default: 'https://termennetwerk-api.netwerkdigitaalerfgoed.nl/status',
      description: 'Base URL of the status service',
    },
  },
};

export const config = envSchema({
  schema,
});
