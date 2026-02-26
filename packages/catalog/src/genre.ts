import {
  IRI,
  StringDictionary,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { QueryEngine } from '@comunica/query-sparql';
import type { Literal } from '@rdfjs/types';

const queryEngine = new QueryEngine();
const timeout = 10_000;
const maxAge = 86_400_000; // 24 hours in ms.

export class Genre {
  constructor(
    public readonly iri: IRI,
    public readonly name: StringDictionary,
  ) {}
}

const cache = new Map<string, { data: Genre; expires: number }>();
const refreshing = new Set<string>();

const doDereferenceGenre = async (genre: IRI): Promise<Genre> => {
  const data = await queryEngine.queryBindings(
    `SELECT ?prefLabel WHERE {
      ?s a <http://www.w3.org/2004/02/skos/core#Concept> ;
        <http://www.w3.org/2004/02/skos/core#prefLabel> ?prefLabel .
    }`,
    {
      // We can't dereference at the actual URL because content negotiation is broken, so suffix .rdf.
      sources: [`${genre.toString()}.rdf`],
      httpTimeout: timeout,
      httpBodyTimeout: true,
    },
  );
  const bindings = await data.toArray();

  return new Genre(
    genre,
    bindings.reduce((acc: StringDictionary, binding) => {
      acc[(binding.get('prefLabel') as Literal)!.language] =
        binding.get('prefLabel')!.value;
      return acc;
    }, {}),
  );
};

const refreshGenre = (genre: IRI, key: string): void => {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  doDereferenceGenre(genre)
    .then(result =>
      cache.set(key, {data: result, expires: Date.now() + maxAge}),
    )
    .catch(error => console.error(error))
    .finally(() => refreshing.delete(key));
};

export const dereferenceGenre = async (
  genre: IRI,
): Promise<Genre | null> => {
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
    cache.set(key, {data: result, expires: Date.now() + maxAge});
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
};
