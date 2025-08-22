import {
  IRI,
  StringDictionary,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {QueryEngine} from '@comunica/query-sparql';
import memoize from 'memoize';
import {Literal} from '@rdfjs/types';

const queryEngine = new QueryEngine();
const timeout = 10_000;

export class Genre {
  constructor(
    public readonly iri: IRI,
    public readonly name: StringDictionary,
  ) {}
}

const doDereferenceGenre = async (genre: IRI): Promise<Genre | null> => {
  try {
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
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const dereferenceGenre = memoize(doDereferenceGenre, {
  cacheKey: String,
  maxAge: 86400,
});
