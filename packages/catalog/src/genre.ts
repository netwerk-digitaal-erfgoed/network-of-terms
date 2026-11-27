import {
  IRI,
  StringDictionary,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

const timeout = 10_000;
const maxAge = 86_400_000; // 24 hours in ms.

// The genre IRIs (https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/…) no longer dereference,
// so look up their labels in the RCE linked data platform instead.
export const genreEndpoint =
  'https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/onderwerpen-not/sparql';

export class Genre {
  constructor(
    public readonly iri: IRI,
    public readonly name: StringDictionary,
  ) {}
}

const cache = new Map<string, { data: Genre; expires: number }>();
const refreshing = new Set<string>();

interface SparqlResults {
  results: {
    bindings: { label: { value: string; 'xml:lang'?: string } }[];
  };
}

const doDereferenceGenre = async (genre: IRI): Promise<Genre> => {
  if (/[\s<>"{}|\\^`]/.test(genre.toString())) {
    throw new Error(`Invalid genre IRI <${genre}>`);
  }

  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?label WHERE { <${genre}> a skos:Concept ; skos:prefLabel ?label }`;
  // The timeout covers the response body too.
  const response = await fetch(
    `${genreEndpoint}?${new URLSearchParams({ query })}`,
    {
      headers: { Accept: 'application/sparql-results+json' },
      signal: AbortSignal.timeout(timeout),
    },
  );
  if (!response.ok) {
    // Free the connection instead of leaving it to the timeout.
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} for genre <${genre}>`);
  }

  const { results } = (await response.json()) as SparqlResults;
  const labels = results.bindings.filter(
    (binding) => binding.label['xml:lang'] !== undefined,
  );

  if (labels.length === 0) {
    // Treat as failure so callers don’t cache an empty name dictionary
    // (e.g. when the genre is unknown to the endpoint).
    throw new Error(`No labels returned for genre <${genre}>`);
  }

  return new Genre(
    genre,
    labels.reduce((acc: StringDictionary, { label }) => {
      acc[label['xml:lang']!] = label.value;
      return acc;
    }, {}),
  );
};

const refreshGenre = (genre: IRI, key: string): void => {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  doDereferenceGenre(genre)
    .then((result) =>
      cache.set(key, { data: result, expires: Date.now() + maxAge }),
    )
    .catch((error) => console.error(error))
    .finally(() => refreshing.delete(key));
};

export const dereferenceGenre = async (genre: IRI): Promise<Genre | null> => {
  const key = String(genre);
  const cached = cache.get(key);

  if (cached) {
    if (cached.expires <= Date.now()) {
      // Stale: return cached data immediately, refresh in the background.
      refreshGenre(genre, key);
    }
    return cached.data;
  }

  // No cached data: must fetch synchronously.
  try {
    const result = await doDereferenceGenre(genre);
    cache.set(key, { data: result, expires: Date.now() + maxAge });
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
};
