import Pino from 'pino';

export function createLoggingFetch(logger: Pino.Logger): typeof fetch {
  return async (input, init) => {
    // Fix and log the outgoing SPARQL query.
    if (init?.body instanceof URLSearchParams) {
      const query = init.body.get('query');
      if (query) {
        const fixed = fixTraqulaSerialization(query);
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
 * Fix issues in SPARQL queries serialized by Traqula.
 */
function fixTraqulaSerialization(query: string): string {
  return (
    query
      // Fix missing whitespace: ?varORDER BY -> ?var ORDER BY
      // @see https://github.com/comunica/traqula/issues/102
      .replace(/(\?\w+)(ORDER\s+BY)/gi, '$1 $2')
      // Strip redundant xsd:string datatype that QLever doesn't accept.
      // @see https://github.com/ad-freiburg/qlever/issues/2688
      .replace(/"\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#string>/g, '"')
  );
}
