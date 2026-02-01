import Pino from 'pino';

export function createLoggingFetch(logger: Pino.Logger): typeof fetch {
  return async (input, init) => {
    // Fix and log the outgoing SPARQL query.
    if (init?.body instanceof URLSearchParams) {
      const query = init.body.get('query');
      if (query) {
        const fixed = fixTraqulaWhitespace(query);
        logger.debug({ url: String(input), query: fixed }, 'SPARQL query');
        init.body.set('query', fixed);
        // Remove stale Content-Length; fetch will recalculate it.
        (init.headers as Headers)?.delete('content-length');
      }
    }

    return fetch(input, init);
  };
}

/**
 * Fix missing whitespace in SPARQL queries serialized by Traqula.
 * @see https://github.com/comunica/traqula/issues/102
 */
function fixTraqulaWhitespace(query: string): string {
  // Fix: ?varORDER BY -> ?var ORDER BY
  return query.replace(/(\?\w+)(ORDER\s+BY)/gi, '$1 $2');
}
