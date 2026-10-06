import { envSchema } from 'env-schema';

const schema = {
  type: 'object',
  properties: {
    TRUST_PROXY: {
      type: 'boolean',
      default: false,
    },
    // Where the preview links to for more about a term; {uri} is replaced with the term’s IRI.
    VIEW_URL_TEMPLATE: {
      type: 'string',
      default:
        'https://termennetwerk.netwerkdigitaalerfgoed.nl/lookup?uri={uri}',
    },
  },
};

export const config = envSchema({
  schema,
});
