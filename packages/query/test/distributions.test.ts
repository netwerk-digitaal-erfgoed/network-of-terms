import { testCatalog } from '../src/test-utils.js';
import { DistributionsService, QueryMode } from '../src/index.js';
import { QueryEngine } from '@comunica/query-sparql';
import { ArrayIterator } from 'asynciterator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = testCatalog(1000);
const comunicaMock = {
  queryQuads: vi.fn(
    (_query: string, _config: object) =>
      new ArrayIterator([], { autoStart: false }),
  ),
};

describe('DistributionsService', () => {
  let service: DistributionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DistributionsService({
      logger: { info: vi.fn(), error: vi.fn() } as never,
      catalog,
      comunica: comunicaMock as unknown as QueryEngine,
    });
  });

  it('queries sources matching a genre', async () => {
    const results = await service.queryAll({
      genres: [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen',
      ],
      query: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      timeoutMs: 10000,
    });
    // RKDartists and GTAA both have Personen genre
    expect(results).toHaveLength(2);
  });

  it('intersects sources and genres', async () => {
    const results = await service.queryAll({
      sources: [
        'https://data.rkd.nl/rkdartists',
        'https://data.cultureelerfgoed.nl/term/id/cht',
      ],
      genres: [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen',
      ],
      query: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      timeoutMs: 10000,
    });
    // Only RKDartists has the Personen genre; CHT does not
    expect(results).toHaveLength(1);
  });

  it('returns empty when sources and genres do not intersect', async () => {
    const results = await service.queryAll({
      sources: ['https://data.cultureelerfgoed.nl/term/id/cht'],
      genres: [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen',
      ],
      query: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      timeoutMs: 10000,
    });
    expect(results).toHaveLength(0);
  });

  it('requires at least one of sources or genres', async () => {
    await expect(
      service.queryAll({
        query: 'test',
        queryMode: QueryMode.OPTIMIZED,
        limit: 10,
        timeoutMs: 10000,
      }),
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
});
