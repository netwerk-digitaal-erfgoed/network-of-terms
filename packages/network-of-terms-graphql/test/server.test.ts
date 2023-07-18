import {FastifyInstance} from 'fastify';
import {server} from '../src/server';
import {
  startDistributionSparqlEndpoint,
  testCatalog,
  teardown,
} from '../../network-of-terms-query/src/server-test';
import {meterProvider} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

let httpServer: FastifyInstance;
const catalog = testCatalog(3000);
describe('Server', () => {
  afterAll(async () => {
    await teardown();
    await meterProvider.shutdown({timeoutMillis: 1000});
  });
  beforeAll(async () => {
    await startDistributionSparqlEndpoint(3000);
    httpServer = await server(catalog);
  });

  it('responds to GraphQL sources query', async () => {
    const body = await query(
      `
        query {
          sources {
            uri
            name
            alternateName
            creators {
              uri
              name
              alternateName
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
    expect(body.data.sources[0].uri).toEqual(
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql'
    );
    expect(body.data.sources[0].features).toContainEqual({
      type: 'RECONCILIATION',
      url: 'https://example.com/reconcile/rkd',
    });
  });

  it('responds to GraphQL terms query when source does not exist', async () => {
    const body = await query(
      termsQuery(['https://example.com/does-not-exist'])
    );
    expect(body.errors[0].message).toEqual(
      'Source with URI "https://example.com/does-not-exist" not found'
    );
  });

  it('responds to GraphQL terms query when distribution endpoint does not resolve', async () => {
    const body = await query(
      termsQuery(['https://example.com/distributions/endpoint-error'])
    );
    expect(body.data.terms).toHaveLength(1);
    expect(body.data.terms[0].result.__typename).toEqual('ServerError');
  });

  it('reports timeout errors', async () => {
    const body = await query(
      termsQuery([
        'https://example.com/distributions/timeout',
        'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      ])
    );
    expect(body.data.terms).toHaveLength(2);
    expect(body.data.terms[0].result.__typename).toEqual('TimeoutError');
    expect(body.data.terms[1].result.__typename).toEqual('Terms');
    expect(body.data.terms[0].responseTimeMs).toBeGreaterThan(1000); // timeoutMs set to 1000.
  });

  it('responds to successful GraphQL terms query', async () => {
    const body = await query(
      termsQuery(
        ['https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql'],
        '.*'
      )
    );
    expect(body.data.terms).toHaveLength(1); // Source.
    expect(body.data.terms[0].source.name).toEqual('RKDartists');
    expect(body.data.terms[0].result.__typename).toEqual('Terms');
    expect(body.data.terms[0].result.terms).toHaveLength(5); // Terms found.
    expect(body.data.terms[0].responseTimeMs).toBeGreaterThan(0);

    const artwork = body.data.terms[0].result.terms.find(
      (term: {uri: string}) =>
        term.uri === 'https://example.com/resources/artwork'
    );
    expect(artwork.seeAlso).toEqual(['https://example.com/html/artwork']);

    const prefLabels = body.data.terms[0].result.terms.map(
      ({prefLabel}: {prefLabel: string[]}) => prefLabel[0] ?? ''
    );
    expect(prefLabels).toEqual([
      'Rembrandt',
      'Nachtwacht',
      'All things art',
      '',
      '',
    ]); // Results with score must come first.

    const relatedPrefLabels = artwork.related.map(
      ({prefLabel}: {prefLabel: string[]}) => prefLabel[0] ?? ''
    );
    expect(relatedPrefLabels).toEqual(['', 'All things art', 'Rembrandt']); // Sorted alphabetically.
  });

  it('responds to GraphQL lookup query', async () => {
    const body = await query(
      lookupQuery(
        'https://example.com/resources/art',
        'https://example.com/resources/iri-does-not-exist-in-dataset',
        'https://example.com/does-not-exist',
        'https://data.cultureelerfgoed.nl/term/id/cht/server-error',
        'http://vocab.getty.edu/aat/timeout'
      )
    );

    const term = body.data.lookup[0];
    expect(term.uri).toEqual('https://example.com/resources/art');
    expect(term.source.name).toEqual('RKDartists');
    expect(term.result.__typename).toEqual('Term');
    expect(term.result.uri).toEqual('https://example.com/resources/art');
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

function termsQuery(sources: string[], query = 'nachtwacht') {
  return `
    query {
      terms(
        sources: [${sources.map(source => `"${source}"`).join(',')}],
        query: "${query}"
        timeoutMs: 1000
      ) {
        source {
          uri
          name
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

function lookupQuery(...iris: string[]) {
  return `
    query {
      lookup(
        uris: [${iris.map(iri => `"${iri}"`).join(',')}],
        timeoutMs: 1000
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
          ... on Error {
            message
          }
        }
        responseTimeMs       
      }
    }`;
}
