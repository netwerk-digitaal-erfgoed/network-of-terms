import Pino from 'pino';

export function createLoggingFetch(logger: Pino.Logger): typeof fetch {
  return async (input, init) => {
    if (init?.body instanceof URLSearchParams) {
      const query = init.body.get('query');
      if (query) {
        logger.debug({ url: String(input), query }, 'SPARQL query');
      }
    }

    return fetch(input, init);
  };
}
