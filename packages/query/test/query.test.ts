import { testCatalog } from '../src/test-utils.js';
import {
  buildSearchQuery,
  QueryMode,
  QueryTermsService,
} from '../src/index.js';
import { QueryEngine } from '@comunica/query-sparql';
import { ArrayIterator } from 'asynciterator';
import type { Term } from '@rdfjs/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = testCatalog(1000);
const comunicaMock = {
  queryQuads: vi.fn(
    (_query: string, _config: object) =>
      new ArrayIterator([], { autoStart: false }),
  ),
};
const service = new QueryTermsService({
  comunica: comunicaMock as unknown as QueryEngine,
});

describe('Query', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });
  it('passes dataset IRI query parameter to Comunica', async () => {
    // Use GTAA which doesn't have VALUES, so uses initialBindings (not string substitution)
    const config = await query(
      'https://data.beeldengeluid.nl/id/datadownload/0026',
    );
    expect(config.initialBindings.get('datasetUri')?.value).toEqual(
      'http://data.beeldengeluid.nl/gtaa/Persoonsnamen',
    );
  });

  it('supports HTTP authentication', async () => {
    const config = await query(
      'https://data.beeldengeluid.nl/id/datadownload/0026',
    );

    // Must not contain credentials in URL...
    expect(config.sources[0].value).toEqual(
      'https://gtaa.apis.beeldengeluid.nl/sparql',
    );
    // ... but in separate httpAuth context element.
    expect(config.httpAuth).toEqual('username:password');
  });
});

const query = async (iri: string) => {
  const dataset = catalog.getDatasetByDistributionIri(iri)!;
  await service.search(
    'van gogh',
    QueryMode.OPTIMIZED,
    dataset,
    dataset.getDistributionByIri(iri)!,
    10_000,
    10_000,
  );

  return comunicaMock.queryQuads.mock.calls[0][1] as {
    httpAuth: string;
    sources: [
      {
        type: 'sparql';
        value: string;
      },
    ];
    initialBindings: Map<string, Term>;
  };
};

describe('buildSearchQuery', () => {
  it('returns query and bindings', () => {
    const result = buildSearchQuery({
      template: 'SELECT * WHERE { ?s ?p ?o } #LIMIT#',
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      datasetIri: 'https://example.org/dataset',
      limit: 10,
    });

    expect(result.query).toBe('SELECT * WHERE { ?s ?p ?o } LIMIT 10');
    expect(result.bindings['datasetUri'].value).toBe(
      'https://example.org/dataset',
    );
    expect(result.bindings['limit'].value).toBe('10');
    expect(result.bindings['query'].value).toBe('test');
  });

  it('creates Virtuoso-specific query variant', () => {
    const result = buildSearchQuery({
      template: 'SELECT * WHERE { ?s ?p ?o }',
      searchTerm: 'van gogh',
      queryMode: QueryMode.OPTIMIZED,
      datasetIri: 'https://example.org/dataset',
      limit: 100,
    });

    // Virtuoso format: 'word1' AND 'word2' for multi-word queries
    expect(result.bindings['virtuosoQuery'].value).toBe("'van' AND 'gogh'");
  });
});
