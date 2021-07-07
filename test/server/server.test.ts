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

let httpServer: FastifyInstance<Server>;
describe('Server', () => {
  beforeAll(async () => {
    const catalog = new Catalog([
      new Dataset(
        new IRI('https://example.com/dataset/1'),
        'Example One',
        [
          new Organization(
            new IRI('https://example.com/organization/1'),
            'Organization One',
            'O1'
          ),
        ],
        [
          new SparqlDistribution(
            new IRI('https://example.com/distribution/1'),
            new IRI('https://example.com/distribution/1/sparql'),
            'select * where {?s ?p ?o }'
          ),
        ],
        undefined
      ),
    ]);
    httpServer = await server(catalog);
  });

  it('responds to GraphQL sources query', async () => {
    const query = gql`
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
    `;

    const response = await httpServer.inject({
      method: 'POST',
      url: '/graphql',
      headers: {'Content-Type': 'application/json'},
      payload: {query},
    });
    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body.data['sources']).toHaveLength(1);
  });
});
