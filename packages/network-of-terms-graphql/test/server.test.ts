import {FastifyInstance} from 'fastify';
import {server} from '../src/server.js';
import {config} from '../src/config.js';
import {
  startDistributionSparqlEndpoint,
  testCatalog,
  teardown,
} from '../../network-of-terms-query/src/server-test.js';
import {IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

let httpServer: FastifyInstance;
const catalog = testCatalog(3000);
describe('Server', () => {
  afterAll(async () => {
    await teardown();
  });
  beforeAll(async () => {
    await startDistributionSparqlEndpoint(3000);
    httpServer = await server(catalog, config);
  });

  it('responds to GraphQL sources query', async () => {
    const body = await query(
      `
        query {
          sources {
            uri
            name
            alternateName
            mainEntityOfPage
            creators {
              uri
              name
              alternateName
            }
            genres {
              uri
              name
            }
            features {
              type
              url
            }
          }
        }
      `
    );
    expect(body.data.sources).toHaveLength(catalog.datasets.length);
    expect(body.data.sources[3].uri).toEqual('https://data.rkd.nl/rkdartists');
    expect(body.data.sources[3].mainEntityOfPage).toEqual([
      'https://example.com/rkdartists',
    ]);
    expect(body.data.sources[3].features).toContainEqual({
      type: 'RECONCILIATION',
      url: 'https://example.com/reconcile/rkd',
    });
    expect(body.data.sources[3].genres).toContainEqual({
      uri: 'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen',
      name: 'Personen',
    });
  });

  it('responds to GraphQL terms query when source does not exist', async () => {
    const body = await query(
      termsQuery({sources: ['https://example.com/does-not-exist']})
    );
    expect(body.errors[0].message).toEqual(
      'Source with URI "https://example.com/does-not-exist" not found'
    );
  });

  it('responds to GraphQL terms query when distribution endpoint does not resolve', async () => {
    const body = await query(
      termsQuery({
        sources: ['https://example.com/distributions/endpoint-error'],
      })
    );
    expect(body.data.terms).toHaveLength(1);
    expect(body.data.terms[0].result.__typename).toEqual('ServerError');
  });

  it('reports timeout errors', async () => {
    const body = await query(
      termsQuery({
        sources: [
          'https://example.com/distributions/timeout',
          'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
        ],
      })
    );
    expect(body.data.terms).toHaveLength(2);
    expect(body.data.terms[0].result.__typename).toEqual('TimeoutError');
    expect(body.data.terms[1].result.__typename).toEqual('Terms');
    expect(body.data.terms[0].responseTimeMs).toBeGreaterThan(1000); // timeoutMs set to 1000.
  });

  it('responds to successful GraphQL terms query', async () => {
    const body = await query(
      termsQuery({sources: ['https://data.rkd.nl/rkdartists'], query: '.*'})
    );
    expect(body.data.terms).toHaveLength(1); // Source.
    expect(body.data.terms[0].source.name).toEqual('RKDartists');
    expect(body.data.terms[0].source.uri).toEqual(
      'https://data.rkd.nl/rkdartists'
    );
    expect(body.data.terms[0].source.inLanguage).toEqual(['en', 'nl']);
    expect(body.data.terms[0].result.__typename).toEqual('Terms');
    // expect(body.data.terms[0].result.terms).toHaveLength(5); // Terms found.
    expect(body.data.terms[0].responseTimeMs).toBeGreaterThan(0);

    const artwork = body.data.terms[0].result.terms.find(
      (term: {uri: string}) =>
        term.uri === 'https://example.com/resources/artwork'
    );
    expect(artwork.seeAlso).toEqual(['https://example.com/html/artwork']);
    expect(artwork.definition).toEqual([
      'One of the most famous Dutch paintings',
    ]);
    expect(artwork.exactMatch).toEqual([
      {
        prefLabel: ['Exact match'],
        uri: 'https://example.com/resources/match',
      },
    ]);

    const prefLabels = body.data.terms[0].result.terms.map(
      ({prefLabel}: {prefLabel: string[]}) => prefLabel[0] ?? ''
    );
    expect(prefLabels).toEqual([
      'Rembrandt',
      'Nachtwacht',
      'Kunstige dingen',
      '',
      '',
    ]); // Results with score must come first.

    const relatedPrefLabels = artwork.related.map(
      ({prefLabel}: {prefLabel: string[]}) => prefLabel[0] ?? ''
    );
    expect(relatedPrefLabels).toEqual(['', 'Kunstige dingen', 'Rembrandt']); // Sorted alphabetically.
  });

  it('responds to successful multilingual GraphQL terms query', async () => {
    const body = await query(
      termsQuery({
        sources: ['https://data.rkd.nl/rkdartists'],
        query: '.*',
        languages: ['en', 'nl'],
      })
    );
    expect(body.data.terms).toHaveLength(1);
    expect(body.data.terms[0].result.__typename).toEqual('TranslatedTerms');
    expect(body.data.terms[0].result.translatedTerms).toHaveLength(5); // Terms found.
    expect(body.data.terms[0].result.translatedTerms[1].prefLabel).toEqual([
      {language: 'nl', value: 'Nachtwacht'},
      {language: 'en', value: 'The Night Watch'},
    ]);
  });

  it('responds to successful GraphQL terms query with backwards compatible distribution URI', async () => {
    const body = await query(
      termsQuery({
        sources: [
          'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
        ],
        query: '.*',
      })
    );
    expect(body.data.terms).toHaveLength(1); // Source.
    expect(body.data.terms[0].source.uri).toEqual(
      'https://data.rkd.nl/rkdartists'
    );
    expect(body.data.terms[0].result.terms).toHaveLength(5); // Terms found.
  });

  it('respects GraphQL terms query limit', async () => {
    const body = await query(
      termsQuery({
        sources: [
          'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
        ],
        query: '.*',
        limit: 1,
      })
    );
    expect(body.data.terms[0].result.terms).toHaveLength(1); // Terms found.
  });

  it('responds to GraphQL lookup query', async () => {
    const body = await query(
      lookupQuery({
        uris: [
          'https://example.com/resources/art',
          'https://example.com/resources/iri-does-not-exist-in-dataset',
          'https://example.com/does-not-exist',
          'https://data.cultureelerfgoed.nl/term/id/cht/server-error',
          'http://vocab.getty.edu/aat/timeout',
        ],
      })
    );

    const term = body.data.lookup[0];
    expect(term.uri).toEqual('https://example.com/resources/art');
    expect(term.source.name).toEqual('RKDartists');
    expect(term.source.uri).toEqual('https://data.rkd.nl/rkdartists');
    expect(term.result.__typename).toEqual('Term');
    expect(term.result.uri).toEqual('https://example.com/resources/art');
    expect(term.result.prefLabel).toEqual(['Kunstige dingen']);
    expect(term.responseTimeMs).toBeGreaterThan(0);

    const termNotFound = body.data.lookup[1];
    expect(termNotFound.uri).toEqual(
      'https://example.com/resources/iri-does-not-exist-in-dataset'
    );
    expect(termNotFound.source.name).toEqual('RKDartists');
    expect(termNotFound.result.__typename).toEqual('NotFoundError');

    const sourceNotFound = body.data.lookup[2];
    expect(sourceNotFound.source.__typename).toEqual('SourceNotFoundError');
    expect(sourceNotFound.source.message).toEqual(
      'No source found that can provide term with URI https://example.com/does-not-exist'
    );
    expect(sourceNotFound.result.__typename).toEqual('NotFoundError');
    expect(sourceNotFound.result.message).toEqual(
      'No term found with URI https://example.com/does-not-exist'
    );

    const serverError = body.data.lookup[3];
    expect(serverError.uri).toEqual(
      'https://data.cultureelerfgoed.nl/term/id/cht/server-error'
    );
    expect(serverError.result.__typename).toEqual('ServerError');

    const timeoutError = body.data.lookup[4];
    expect(timeoutError.uri).toEqual('http://vocab.getty.edu/aat/timeout');
    expect(timeoutError.result.__typename).toEqual('TimeoutError');
  });

  it('responds to successful multilingual GraphQL lookup query', async () => {
    const body = await query(
      lookupQuery({
        uris: ['https://example.com/resources/art'],
        languages: ['en'],
      })
    );
    const term = body.data.lookup[0];
    expect(term.result.__typename).toEqual('TranslatedTerm');
    expect(term.result.prefLabel).toEqual([
      {
        language: 'en',
        value: 'All things art',
      },
    ]);
  });

  it('responds to GraphQL playground requests', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/graphiql',
    });
    expect(response.statusCode).toEqual(200);
  });

  it.each([
    ['/', 302],
    ['/playground', 301],
  ])(
    '%s redirects to GraphQL playground with status code %i',
    async (url: string, statusCode: number) => {
      const response = await httpServer.inject({
        method: 'GET',
        url: url,
      });
      expect(response.statusCode).toEqual(statusCode);
      expect(response.headers.location).toEqual('/graphiql');
    }
  );
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function query(query: string): Promise<any> {
  const response = await httpServer.inject({
    method: 'POST',
    url: '/graphql',
    headers: {'Content-Type': 'application/json'},
    payload: {query},
  });
  expect(response.statusCode).toEqual(200);

  return JSON.parse(response.body);
}

function termsQuery({
  sources,
  query = 'nachtwacht',
  limit = 100,
  languages,
}: {
  sources: IRI[];
  query?: string;
  limit?: number;
  languages?: string[];
}) {
  return `
    query {
      terms(
        sources: [${sources.map(source => `"${source}"`).join(',')}],
        query: "${query}"
        limit: ${limit}
        timeoutMs: 1000
        ${languages !== undefined ? `languages: [${languages.join(',')}]` : ''}
      ) {
        source {
          uri
          name
          inLanguage
          creators {
            uri
            name
            alternateName
          }
        }
        result {
          __typename
          ... on Terms {
            terms {
              uri
              prefLabel
              altLabel
              hiddenLabel
              definition
              scopeNote
              seeAlso
              broader {
                uri
                prefLabel
              }
              related {
                uri
                prefLabel
              }
              exactMatch {
                uri
                prefLabel 
              }
            }
          }
          ... on TranslatedTerms {
            translatedTerms:terms {
              uri
              prefLabel { language value }
              altLabel { language value }
              hiddenLabel { language value }
              definition { language value }
              scopeNote { language value }
              seeAlso
              broader { 
                uri
                prefLabel { language value }
              }
              related {
                uri
                prefLabel { language value } 
              }
              exactMatch {
                uri
                prefLabel { language value }
              }
            }
          }
          ... on Error {
            message
          }
        }
        responseTimeMs
      }
    }`;
}

function lookupQuery({
  uris,
  languages,
}: {
  uris: string[];
  languages?: string[];
}) {
  return `
    query {
      lookup(
        uris: [${uris.map(uri => `"${uri}"`).join(',')}],
        timeoutMs: 1000
        ${languages !== undefined ? `languages: [${languages.join(',')}]` : ''}
      ) {
        uri
        source {
          __typename
          ... on Source {
            uri
            name
            creators {
              uri
              name
              alternateName
            }
          }
          ... on Error {
            __typename
            message
          }
        }        
        result {
          __typename
          ${
            languages === undefined
              ? `
          ... on Term {
            uri
            prefLabel
            altLabel
            hiddenLabel
            scopeNote
            seeAlso
            broader {
              uri
              prefLabel
            }
          }
          `
              : `
          ... on TranslatedTerm {
            uri
            prefLabel { language value }
            altLabel { language value }
            hiddenLabel { language value }
            scopeNote { language value }
            seeAlso
            broader {
              uri
              prefLabel { language value }
            }
          }
          `
          }
          ... on Error {
            message
          }
        }
        responseTimeMs       
      }
    }`;
}
