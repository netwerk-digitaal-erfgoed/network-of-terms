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
