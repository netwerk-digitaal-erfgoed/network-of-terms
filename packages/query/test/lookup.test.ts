import { testCatalog } from '../src/test-utils.js';
import { LookupService, QueryTermsService } from '../src/index.js';
import { describe, expect, it, vi } from 'vitest';

const catalog = testCatalog(1000);

function lookupServiceWithSpy() {
  const queryService = {
    lookup: vi.fn(async () => ({ terms: [], errors: [], responseTimeMs: 0 })),
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
