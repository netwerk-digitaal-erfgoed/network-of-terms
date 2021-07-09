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
            'Organization One',
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
    expect(body.data['sources']).toHaveLength(1);
  });

  it('responds to GraphQL terms query with source not found', async () => {
    const body = await query(
      gql`
        query {
          terms(
            sources: ["https://example.com/does-not-exist"]
            query: "something something"
          ) {
            source {
              uri
            }
            result {
              __typename
              ... on Terms {
                terms {
                  uri
                }
              }
              ... on Error {
                message
              }
            }
          }
        }
      `
    );
    expect(body.errors[0].message).toEqual(
      'Source with URI "https://example.com/does-not-exist" not found'
    );
  });

  it('responds to GraphQL terms query', async () => {
    const body = await query(
      gql`
        query {
          terms(
            sources: ["https://example.com/distributions/1"]
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
        }
      `
    );
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
