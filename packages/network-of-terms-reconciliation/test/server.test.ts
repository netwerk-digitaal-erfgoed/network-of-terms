import {FastifyInstance} from 'fastify';
import {server} from '../src/server';
import {ReconciliationQueryBatch} from '../src/query';
import {
  startDistributionSparqlEndpoint,
  testCatalog,
  teardown,
} from '../../network-of-terms-query/src/server-test';
import {DataExtensionQuery} from '../src/data-extension';
import {config} from '../src/config';

let httpServer: FastifyInstance;
const catalog = testCatalog(3001);
describe('Server', () => {
  afterAll(async () => {
    await teardown();
  });
  beforeAll(async () => {
    await startDistributionSparqlEndpoint(3001);
    httpServer = await server(catalog, config);
  });

  it('returns ok at root', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile',
    });
    expect(response.statusCode).toEqual(200);
  });

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
        score: 100,
        description: 'Nachtwacht alt',
      },
    ]);

    // Results must be sorted by score in decreasing order.
    expect(results.q2.result).toHaveLength(2);
    expect(results.q2.result[0].name).toEqual('All things art');
    expect(results.q2.result[0].score).toEqual(62.5); // Match of ‘things’ in prefLabel ‘All things art’.
    expect(results.q2.result[1].description).toEqual(
      'painted things that can be beautiful • another altLabel'
    ); // Result has no prefLabel.
    expect(results.q2.result[1].score).toEqual(28.57); // Match of ‘things’ in altLabel ‘painted things that can be beautiful’.

    expect(results.q3.result).toEqual([]); // No results.
  });

  it('limits reconciliation API results', async () => {
    const response = await reconciliationQuery(
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      {
        q1: {
          query: 'art',
        },
        q2: {
          query: 'art',
          limit: 1,
        },
      }
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.q1.result).toHaveLength(2);
    expect(results.q2.result).toHaveLength(1);
  });

  it('validates reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      {
        q1: {
          query: 'art',
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore string on purpose where a number should be.
          limit: 'not a valid a limit',
        },
      }
    );
    expect(response.statusCode).toEqual(400);
    expect(JSON.parse(response.body).message).toEqual(
      "body/q1/limit must be integer, body must have required property 'ids', body must match a schema in anyOf"
    );
  });

  it('handles source timeouts for reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://example.com/distributions/endpoint-error'
    );
    expect(response.statusCode).toEqual(200);
  });

  it('returns data extension properties', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/extend/propose',
    });
    expect(response.statusCode).toEqual(200);
  });

  it('returns data extension response for terms', async () => {
    const response = await dataExtensionQuery('/extend');
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    // This is what OpenRefine currently expects.
    const response2 = await dataExtensionQuery(
      '/reconcile/https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql/extend'
    );
    expect(response2.statusCode).toEqual(200);
    const results2 = JSON.parse(response.body);

    expect(results).toEqual(results2);

    expect(results.rows).toEqual({
      'https://example.com/resources/artwork': {
        prefLabels: [{str: 'Nachtwacht'}],
        altLabels: [{str: 'Nachtwacht alt'}],
        scopeNotes: [{str: 'One of the most famous Dutch paintings'}],
      },
      'https://example.com/resources/painter': {
        prefLabels: [{str: 'Rembrandt'}],
        altLabels: [],
        scopeNotes: [],
      },
    });
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
      '<dt>Alternative labels</dt><dd>Nachtwacht alt</dd>'
    );
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Related terms</dt>\\s*<dd>All things art &#8226; Rembrandt</dd>'
      )
    );
  });

  it('shows HTML term preview if term has no altLabels', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/painter',
      headers: {
        'accept-language': 'de', // Should default to en.
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toMatch('View at Network of Terms');
  });

  it('translates HTML preview', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/artwork',
      headers: {
        'accept-language': 'nl',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Gerelateerde termen</dt>\\s*<dd>All things art &#8226; Rembrandt</dd>'
      )
    );
  });

  it('shows empty HTML term preview if term is not found', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/does-not-exist',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toEqual('Not found');
  });
});

async function reconciliationQuery(
  reconciliationUrl: string,
  query: ReconciliationQueryBatch = {
    q1: {
      query: 'nachtwacht',
    },
    q2: {
      query: 'Things',
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

async function dataExtensionQuery(
  url = '/extend',
  query: DataExtensionQuery = {
    ids: [
      'https://example.com/resources/artwork',
      'https://example.com/resources/painter',
    ],
    properties: [{id: 'altLabel'}],
  }
) {
  return httpServer.inject({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    url,
    payload: query,
  });
}
