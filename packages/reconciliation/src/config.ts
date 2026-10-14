import { envSchema } from 'env-schema';

const schema = {
  type: 'object',
  properties: {
    TRUST_PROXY: {
      type: 'boolean',
      default: false,
    },
    // Where the preview links to for more about a term: {uri} is replaced with the term’s
    // percent-encoded IRI, {+uri} with the IRI as it is.
    VIEW_URL_TEMPLATE: {
      type: 'string',
      pattern: '\\{\\+?uri\\}',
      default:
        'https://termennetwerk.netwerkdigitaalerfgoed.nl/lookup?uri={uri}',
    },
  },
};

type Env = {
  TRUST_PROXY: boolean;
  VIEW_URL_TEMPLATE: string;
};

export const config = envSchema<Env>({
  schema,
});
