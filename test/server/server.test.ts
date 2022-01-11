import {FastifyInstance} from 'fastify';
import {Server} from 'http';
import {
  Catalog,
  Dataset,
  IRI,
  Organization,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from '../../src/server/server';
import {gql} from 'mercurius-codegen';
import {setup, teardown} from 'jest-dev-server';

let httpServer: FastifyInstance<Server>;
const catalog = new Catalog([
  new Dataset(
    new IRI('http://vocab.getty.edu/aat'),
    'Art & Architecture Thesaurus',
    [new IRI('https://example.com/resources/')],
    [
      new Organization(
        new IRI('http://www.getty.edu/research/'),
        'Getty Research Institute',
        'Getty'
      ),
    ],
    [
      new SparqlDistribution(
        new IRI('http://vocab.getty.edu/aat/sparql'),
        new IRI('http://localhost:3000/sparql'),
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o. VALUES ?s { ?uris } }`
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
    new IRI('https://data.rkd.nl/rkdartists'),
    'RKDartists',
    [new IRI('https://data.rkd.nl/artists/')],
    [
      new Organization(
        new IRI('https://rkd.nl'),
        'RKD – Nederlands Instituut voor Kunstgeschiedenis',
        'RKD'
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
    httpServer = await server(catalog);
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
    const body = await query(termsQuery('https://example.com/does-not-exist'));
    expect(body.errors[0].message).toEqual(
      'Source with URI "https://example.com/does-not-exist" not found'
    );
  });

  it('responds to GraphQL terms query when distribution endpoint does not resolve', async () => {
    const body = await query(
      termsQuery('https://example.com/distributions/endpoint-error')
    );
    expect(body.data.terms).toHaveLength(1);
    expect(body.data.terms[0].result.__typename).toEqual('ServerError');
  });

  it('reports timeout errors', async () => {
    const body = await query(
      termsQuery(
        'https://example.com/distributions/timeout',
        'http://vocab.getty.edu/aat/sparql'
      )
    );
    expect(body.data.terms).toHaveLength(2);
    expect(body.data.terms[0].result.__typename).toEqual('TimeoutError');
    expect(body.data.terms[1].result.__typename).toEqual('Terms');
  });

  it('responds to successful GraphQL terms query', async () => {
    const body = await query(termsQuery('http://vocab.getty.edu/aat/sparql'));
    expect(body.data.terms).toHaveLength(1); // Source.
    expect(body.data.terms[0].source.name).toEqual(
      'Art & Architecture Thesaurus'
    );
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
        'https://data.rkd.nl/artists/timeout'
      )
    );

    const term = body.data.lookup[0];
    expect(term.uri).toEqual('https://example.com/resources/art');
    expect(term.source.name).toEqual('Art & Architecture Thesaurus');
    expect(term.result.__typename).toEqual('Term');
    expect(term.result.uri).toEqual('https://example.com/resources/art');

    const termNotFound = body.data.lookup[1];
    expect(termNotFound.uri).toEqual(
      'https://example.com/resources/iri-does-not-exist-in-dataset'
    );
    expect(termNotFound.source.name).toEqual('Art & Architecture Thesaurus');
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
    expect(timeoutError.uri).toEqual('https://data.rkd.nl/artists/timeout');
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

async function startDistributionSparqlEndpoint(): Promise<void> {
  await setup({
    command: `npx comunica-sparql-file-http ${process.cwd()}/test/fixtures/terms.ttl`,
    port: 3000,
  });
}

function termsQuery(...sources: string[]) {
  return gql`
    query {
      terms(
        sources: [${sources.map(source => `"${source}"`).join(',')}],
        query: "something"
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
