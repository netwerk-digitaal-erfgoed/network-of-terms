import { envSchema } from 'env-schema';

const schema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: {
      type: 'string',
      description: 'PostgreSQL connection string',
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: 'Port for HTTP server',
    },
    POLLING_INTERVAL_SECONDS: {
      type: 'number',
      default: 300,
      description: 'Polling interval in seconds (default: 300 = 5 minutes)',
    },
    RUN_ON_START: {
      type: 'boolean',
      default: true,
      description: 'Whether to run polling immediately on start',
    },
    LDES_BASE_URL: {
      type: 'string',
      default: 'https://status.termennetwerk.netwerkdigitaalerfgoed.nl',
      description: 'Base URL for LDES stream',
    },
  },
};

interface Env {
  DATABASE_URL: string;
  PORT: number;
  POLLING_INTERVAL_SECONDS: number;
  RUN_ON_START: boolean;
  LDES_BASE_URL: string;
}

export const config: Env = envSchema({
  dotenv: true,
  schema,
});
