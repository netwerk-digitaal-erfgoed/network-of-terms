import { testCatalog } from '../src/test-utils.js';
import { DistributionsService, QueryMode } from '../src/index.js';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = testCatalog(1000);
const fetcherMock = {
  fetchTriples: vi.fn<SparqlEndpointFetcher['fetchTriples']>(
    async () => Readable.from([]) as never,
  ),
};

describe('DistributionsService', () => {
  let service: DistributionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DistributionsService({
      logger: { info: vi.fn(), error: vi.fn() } as never,
      catalog,
      fetcher: fetcherMock as unknown as SparqlEndpointFetcher,
    });
  });

  it('requires sources', async () => {
    await expect(
      service.queryAll({
        query: 'test',
        queryMode: QueryMode.OPTIMIZED,
        limit: 10,
        timeoutMs: 10000,
      } as never),
    ).rejects.toThrow();
  });

  it('queries specified sources when no genres provided', async () => {
    const results = await service.queryAll({
      sources: ['https://data.rkd.nl/rkdartists'],
      query: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      timeoutMs: 10000,
    });
    expect(results).toHaveLength(1);
  });

  it('passes genres through for within-source filtering', async () => {
    const results = await service.queryAll({
      sources: ['https://data.rkd.nl/rkdartists'],
      genres: [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen',
      ],
      query: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      timeoutMs: 10000,
    });
    // Source is queried regardless of genre match — genres are for within-source filtering only
    expect(results).toHaveLength(1);
    // Verify the SPARQL query was called (genres passed through to query())
    expect(fetcherMock.fetchTriples).toHaveBeenCalledTimes(1);
  });
});
