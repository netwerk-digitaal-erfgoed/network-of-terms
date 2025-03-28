import {IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {QueryEngine} from '@comunica/query-sparql';
import memoize from 'memoize';

const queryEngine = new QueryEngine();
const timeout = 10_000;

export class Genre {
  constructor(
    public readonly iri: IRI,
    public readonly name: string
  ) {}
}

const doDereferenceGenre = async (genre: IRI): Promise<Genre | null> => {
  // We have to fetch first using a single Accept header value of application/rdf+xml, because the Poolparty server
  // does not properly handle complex Accept headers such as those sent by Comunica.
  const result = await fetch(genre.toString(), {
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: 'application/rdf+xml',
    },
  });
  if (!result.ok) {
    return null;
  }
  const xml = await result.text();
  try {
    const data = await queryEngine.queryBindings(
      `SELECT ?prefLabel WHERE { 
      ?s a <http://www.w3.org/2004/02/skos/core#Concept> ;
        <http://www.w3.org/2004/02/skos/core#prefLabel> ?prefLabel .
    } LIMIT 1`,
      {
        sources: [
          {
            type: 'serialized',
            value: xml,
            mediaType: 'application/rdf+xml',
          },
        ],
      }
    );
    const bindings = await data.toArray({limit: 1});
    return new Genre(genre, bindings[0].get('prefLabel')?.value ?? '');
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const dereferenceGenre = memoize(doDereferenceGenre, {
  cacheKey: String,
  maxAge: 86400,
});
