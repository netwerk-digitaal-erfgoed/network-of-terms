import {
  IRI,
  StringDictionary,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import type { Literal, Quad } from '@rdfjs/types';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const timeout = 10_000;
const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const skosConcept = 'http://www.w3.org/2004/02/skos/core#Concept';
const skosPrefLabel = 'http://www.w3.org/2004/02/skos/core#prefLabel';
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
  // We can't dereference at the actual URL because content negotiation is broken, so suffix .rdf.
  const url = `${genre.toString()}.rdf`;
  // The timeout covers the response body too.
  const response = await fetch(url, {
    headers: { Accept: 'application/rdf+xml' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok || response.body === null) {
    // Free the connection instead of leaving it to the timeout.
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} for genre <${genre}>`);
  }

  // A pipeline, so a body that breaks off (such as on the timeout) fails the parse instead of
  // leaving it waiting.
  const quads: Quad[] = [];
  await pipeline(
    Readable.fromWeb(response.body),
    new RdfXmlParser({ baseIRI: url }),
    async (parsed: AsyncIterable<Quad>) => {
      for await (const quad of parsed) {
        quads.push(quad);
      }
    },
  );
  const concepts = new Set(
    quads
      .filter(
        (quad) =>
          quad.predicate.value === rdfType && quad.object.value === skosConcept,
      )
      .map((quad) => quad.subject.value),
  );
  const prefLabels = quads
    .filter(
      (quad) =>
        quad.predicate.value === skosPrefLabel &&
        quad.object.termType === 'Literal' &&
        concepts.has(quad.subject.value),
    )
    .map((quad) => quad.object as Literal);

  if (prefLabels.length === 0) {
    // Treat as failure so callers don’t cache an empty name dictionary
    // (e.g. when the upstream returns a non-RDF error page).
    throw new Error(`No labels returned for genre <${genre}>`);
  }

  return new Genre(
    genre,
    prefLabels.reduce((acc: StringDictionary, prefLabel) => {
      acc[prefLabel.language] = prefLabel.value;
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
