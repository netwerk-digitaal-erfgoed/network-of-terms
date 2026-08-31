import { testCatalog } from '../src/test-utils.js';
import {
  Distribution,
  forgetLookupBatchSizes,
  LookupService,
  QueryTermsService,
  ServerError,
  TermsResponse,
} from '../src/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = testCatalog(1000);

function lookupServiceWithSpy() {
  const queryService = {
    lookup: vi.fn(
      async (
        _iris: string[],
        _distribution: Distribution,
        _timeoutMs: number,
      ): Promise<unknown> => ({ terms: [], errors: [], responseTimeMs: 0 }),
    ),
  };
  return {
    service: new LookupService(
      catalog,
      queryService as unknown as QueryTermsService,
    ),
    queryService,
  };
}

describe('LookupService', () => {
  beforeEach(() => forgetLookupBatchSizes());

  it('queries for an IRI the catalog knows', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    await service.lookup(['https://example.com/resources/art'], 1000);
    expect(queryService.lookup).toHaveBeenCalled();
  });

  // SPARQL has no escape for these characters inside an IRIREF, and lookup interpolates the IRI
  // into the query text, so a '>' would close the IRIREF and let the remainder be read as SPARQL.
  it.each([
    ['https://example.com/resources/a> } INSERT DATA { <urn:a> <urn:b> <urn:c> } #'],
    ['https://example.com/resources/a"b'],
    ['https://example.com/resources/a b'],
    ['https://example.com/resources/a{b}'],
    ['https://example.com/resources/a\\b'],
  ])('never queries for an IRI containing SPARQL syntax: %s', async (iri) => {
    const { service, queryService } = lookupServiceWithSpy();
    await service.lookup([iri], 1000);
    expect(queryService.lookup).not.toHaveBeenCalled();
  });

  // A lookup query answers with everything it knows about every IRI it is given, so a large batch
  // overruns the query’s result limit (or the endpoint), and the IRIs that did not fit come back as
  // NotFoundError – which a client is entitled to cache as ‘this term does not exist’.
  it('splits a large batch into several queries', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    const iris = Array.from(
      { length: 60 },
      (_, index) => `https://example.com/resources/term${index}`,
    );

    const results = await service.lookup(iris, 1000);

    expect(queryService.lookup).toHaveBeenCalledTimes(3);
    const batches = queryService.lookup.mock.calls.map(
      (call) => (call as unknown as [string[]])[0],
    );
    expect(batches.map((batch) => batch.length)).toEqual([25, 25, 10]);
    expect(batches.flat()).toEqual(iris);
    expect(results.map((result) => result.uri)).toEqual(iris);
  });

  // timeoutMs is what the caller allows the whole lookup: a request that is split into batches must
  // not take a multiple of it.
  it('spends the caller’s timeout across the batches, not per batch', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    queryService.lookup.mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ terms: [], errors: [], responseTimeMs: 0 }), 30),
        ),
    );
    const iris = Array.from(
      { length: 60 },
      (_, index) => `https://example.com/resources/term${index}`,
    );

    await service.lookup(iris, 50);

    const timeouts = queryService.lookup.mock.calls.map(
      (call) => (call as unknown as [string[], unknown, number])[2],
    );
    expect(timeouts[0]).toBeLessThanOrEqual(50);
    // Each batch gets what is left of the 50ms, so the later ones get less than the earlier ones.
    expect(timeouts[1]).toBeLessThan(timeouts[0]);
  });

  // Where a source gives up differs by two orders of magnitude, moves with how busy it is, and is
  // a cliff rather than a slope, so the size is learned from what the source does.
  it('halves the batch when a source cannot take it, and retries what is left', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    const distribution = catalog.datasets[0].distributions[0];
    queryService.lookup.mockImplementation(async (batch: string[]) =>
      batch.length > 6
        ? new TermsResponse(new ServerError(distribution, 'terminated'), 0)
        : { terms: [], errors: [], responseTimeMs: 0 },
    );
    const iris = Array.from(
      { length: 12 },
      (_, index) => `https://example.com/resources/term${index}`,
    );

    await service.lookup(iris, 5000);

    const sizes = queryService.lookup.mock.calls.map(
      (call) => (call as unknown as [string[]])[0].length,
    );
    // 12 fails, 6 succeeds, and the rest follow at the size the source accepted.
    expect(sizes).toEqual([12, 6, 6]);
  });

  it('grows the batch again once a source accepts one', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    const distribution = catalog.datasets[0].distributions[0];
    let failNext = true;
    queryService.lookup.mockImplementation(async () => {
      if (failNext) {
        failNext = false;
        return new TermsResponse(new ServerError(distribution, 'terminated'), 0);
      }

      return { terms: [], errors: [], responseTimeMs: 0 };
    });
    const iris = Array.from(
      { length: 40 },
      (_, index) => `https://example.com/resources/term${index}`,
    );

    await service.lookup(iris, 5000);

    const sizes = queryService.lookup.mock.calls.map(
      (call) => (call as unknown as [string[]])[0].length,
    );
    // 25 fails, 12 succeeds, the next batch is allowed to be twice that, and 4 IRIs are left over.
    expect(sizes).toEqual([25, 12, 24, 4]);
  });

  it('still queries for the valid IRIs in a batch containing a malformed one', async () => {
    const { service, queryService } = lookupServiceWithSpy();
    await service.lookup(
      [
        'https://example.com/resources/art',
        'https://example.com/resources/a> } DROP ALL #',
      ],
      1000,
    );
    expect(queryService.lookup).toHaveBeenCalledOnce();
    const [iris] = queryService.lookup.mock.calls[0] as unknown as [string[]];
    expect(iris).toEqual(['https://example.com/resources/art']);
  });
});
