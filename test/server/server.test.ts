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
describe('Server', () => {
  afterAll(async () => {
    await teardown();
  });
  beforeAll(async () => {
    await startDistributionSparqlEndpoint();

    const catalog = new Catalog([
      new Dataset(
        new IRI('https://example.com/datasets/1'),
        'Dataset the First',
        [
          new Organization(
            new IRI('https://example.com/organizations/1'),
            'Organization the First',
            'O1'
          ),
        ],
        [
          new SparqlDistribution(
            new IRI('https://example.com/distributions/1'),
            new IRI('http://localhost:3000/sparql'),
            gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`
          ),
        ],
        undefined
      ),
      new Dataset(
        new IRI('https://example.com/datasets/endpoint-error'),
        'Dataset the Second',
        [
          new Organization(
            new IRI('https://example.com/organizations/2'),
            'Organization the Second',
            'O2'
          ),
        ],
        [
          new SparqlDistribution(
            new IRI('https://example.com/distributions/endpoint-error'),
            new IRI('http://does-not-resolve'),
            gql`CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`
          ),
        ],
        undefined
      ),
    ]);
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
    expect(body.data['sources']).toHaveLength(2);
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

  it('responds to successful GraphQL terms query', async () => {
    const body = await query(termsQuery('https://example.com/distributions/1'));
    expect(body.data.terms).toHaveLength(1); // One source.
    expect(body.data.terms[0].source.name).toEqual('Dataset the First');
    expect(body.data.terms[0].result.__typename).toEqual('Terms');
    expect(body.data.terms[0].result.terms).toHaveLength(2); // Two terms.
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
    command: `npx comunica-sparql-file-http ${__dirname}/../fixtures/terms.ttl`,
    port: 3000,
  });
}

function termsQuery(...sources: string[]) {
  return gql`
    query {
      terms(
        sources: [${sources.map(source => `"${source}"`).join(',')}],
        query: "something"
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
            }
          }
          ... on Error {
            message
          }
        }
      }
    }`;
}
