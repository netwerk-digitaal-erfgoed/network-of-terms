import {FastifyInstance} from 'fastify';
import {Server} from 'http';
import {
  Catalog,
  Dataset,
  IRI,
  Organization,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {customRequest, server} from '../../src/server/server';
import {gql} from 'mercurius-codegen';
import {setup, teardown} from 'jest-dev-server';
import {ReconciliationQueryBatch} from '../../build/reconciliation/query';

let httpServer: FastifyInstance<Server, customRequest>;
const catalog = new Catalog([
  new Dataset(
    new IRI('https://data.rkd.nl/rkdartists'),
    'RKDartists',
    [new IRI('https://example.com/resources/')],
    [
      new Organization(
        new IRI('https://rkd.nl'),
        'RKD – Nederlands Instituut voor Kunstgeschiedenis',
        'RKD'
      ),
    ],
    [
      new SparqlDistribution(
        new IRI('https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql'),
        new IRI('http://localhost:3000/sparql'),
        gql`
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          CONSTRUCT { 
            ?s ?p ?o 
          }
          WHERE { 
            ?s ?p ?o ;
              ?labelPredicate ?label .
            VALUES ?labelPredicate { skos:prefLabel skos:altLabel }
            FILTER (regex(?label, ?query, "i"))
          }`,
        gql`
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          CONSTRUCT {
            ?s ?p ?o ;
              skos:broader ?broader_uri ;
              skos:narrower ?narrower_uri ;
              skos:related ?related_uri .
            ?broader_uri skos:prefLabel ?broader_prefLabel .
            ?narrower_uri skos:prefLabel ?narrower_prefLabel .
            ?related_uri skos:prefLabel ?related_prefLabel .
          } 
          WHERE { 
            ?s ?p ?o.
            VALUES ?s { ?uris }
            OPTIONAL { 
              ?s skos:broader ?broader_uri.
              ?broader_uri skos:prefLabel ?broader_prefLabel. 
            } 
            OPTIONAL { 
              ?s skos:narrower ?narrower_uri.
              ?narrower_uri skos:prefLabel ?narrower_prefLabel. 
            } 
            OPTIONAL { 
              ?s skos:related ?related_uri.
              ?related_uri skos:prefLabel ?related_prefLabel. 
            } 
          }`
      ),
    ]
  ),
  new Dataset(
    new IRI('https://data.cultureelerfgoed.nl/term/id/cht'),
    'Cultuurhistorische Thesaurus',
    [new IRI('https://data.cultureelerfgoed.nl/term/id/cht/')],
    [
      new Organization(
        new IRI('https://www.cultureelerfgoed.nl'),
        'Rijksdienst voor het Cultureel Erfgoed',
        'RCE'
      ),
    ],
    [
      new SparqlDistribution(
        new IRI('https://example.com/distributions/endpoint-error'),
        new IRI('http://does-not-resolve'),
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`
      ),
    ]
  ),
  new Dataset(
    new IRI('http://vocab.getty.edu/aat'),
    'Art & Architecture Thesaurus',
    [new IRI('http://vocab.getty.edu/aat/')],
    [
      new Organization(
        new IRI('http://www.getty.edu/research/'),
        'Getty Research Institute',
        'Getty'
      ),
    ],
    [
      new SparqlDistribution(
        new IRI('https://example.com/distributions/timeout'),
        new IRI('https://httpbin.org/delay/3'),
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`
      ),
    ]
  ),
]);
describe('Server', () => {
  afterAll(async () => {
    await teardown();
  });
  beforeAll(async () => {
    await startDistributionSparqlEndpoint();
    httpServer = await server(catalog, [
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      'https://example.com/distributions/endpoint-error',
    ]);
  });

  it('responds to GraphQL sources query', async () => {
    const body = await query(
      gql`
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
          }
        }
      `
    );
    expect(body.data.sources).toHaveLength(catalog.datasets.length);
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

    const artwork = body.data.terms[0].result.terms.find(
      (term: {uri: string}) =>
        term.uri === 'https://example.com/resources/artwork'
    );
    expect(artwork.seeAlso).toEqual(['https://example.com/html/artwork']);

    const relatedPrefLabels = artwork.related.map(
      ({prefLabel}: {prefLabel: string[]}) => prefLabel[0] ?? ''
    );
    expect(relatedPrefLabels).toEqual(['', 'Art', 'Rembrandt']); // Sorted alphabetically.
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

  it('returns reconciliation service manifest', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
    });
    expect(response.statusCode).toEqual(200);
  });

  it('returns 404 if reconciliation service does not exist', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/http://nope.com',
    });
    expect(response.statusCode).toEqual(404);

    // This distribution exists, but does not have reconciliation enabled.
    const notFoundResponse = await reconciliationQuery(
      'https://example.com/distributions/timeout'
    );
    expect(notFoundResponse.statusCode).toEqual(404);
  });

  it('responds to successful reconciliation API requests', async () => {
    const response = await reconciliationQuery(
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql'
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.q1.result).toEqual([
      {
        id: 'https://example.com/resources/artwork',
        name: 'Nachtwacht',
        score: 1,
        description: 'Nachtwacht alt',
      },
    ]);
    expect(results.q3.result).toEqual([]); // No results.
  });

  it('handles source timeouts for reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://example.com/distributions/endpoint-error'
    );
    expect(response.statusCode).toEqual(200);
  });

  it('shows HTML term preview', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/artwork',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toMatch('<h1>Nachtwacht</h1>');
    expect(response.body).toMatch('One of the most famous Dutch paintings');
    expect(response.body).toMatch(
      '<dt>Alternatieve labels</dt><dd>Nachtwacht alt</dd>'
    );
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Gerelateerde termen</dt>\\s*<dd>Art &#8226; Rembrandt</dd>'
      )
    );
  });

  it('shows HTML term preview if term has no altLabels', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/painter',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
  });

  it('shows empty HTML term preview if term is not found', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/does-not-exist',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toEqual('Niet gevonden');
  });
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

async function startDistributionSparqlEndpoint(): Promise<void> {
  await setup({
    command: `npx comunica-sparql-file-http ${process.cwd()}/test/fixtures/terms.ttl`,
    port: 3000,
  });
}

async function reconciliationQuery(
  reconciliationUrl: string,
  query: ReconciliationQueryBatch = {
    q1: {
      query: 'nachtwacht',
    },
    q2: {
      query: 'Art',
    },
    q3: {
      query: 'This yields no results',
    },
  }
) {
  return httpServer.inject({
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `/reconcile/${reconciliationUrl}`,
    payload: new URLSearchParams([
      ['queries', JSON.stringify(query)],
    ]).toString(),
  });
}

function termsQuery(sources: string[], query = 'nachtwacht') {
  return gql`
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
      }
    }`;
}

function lookupQuery(...iris: string[]) {
  return gql`
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
      }
    }`;
}
