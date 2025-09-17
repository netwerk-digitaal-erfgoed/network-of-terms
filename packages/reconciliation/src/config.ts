import { envSchema } from 'env-schema';

const schema = {
  type: 'object',
  properties: {
    TRUST_PROXY: {
      type: 'boolean',
      default: false,
    },
  },
};

export const config = envSchema({
  schema,
});
