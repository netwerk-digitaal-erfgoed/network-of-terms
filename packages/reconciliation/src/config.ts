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
  CATALOG_PATH: string;
  VIEW_URL_TEMPLATE: string;
};

export const config = envSchema<Env>({
  schema,
});
