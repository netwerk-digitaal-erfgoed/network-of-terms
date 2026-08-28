import { testCatalog } from '../src/test-utils.js';
import {
  buildSearchQuery,
  substituteBindings,
  Dataset,
  Organization,
  parameterizeGenres,
  QueryMode,
  QueryTermsService,
  SparqlDistribution,
} from '../src/index.js';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory } from 'rdf-data-factory';
import { ArrayIterator } from 'asynciterator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createTestDataset(
  searchQuery: string,
  genres: string[] = [],
): { dataset: Dataset; distribution: SparqlDistribution } {
  const distribution = new SparqlDistribution(
    'https://example.org/distribution',
    'https://example.org/sparql',
    searchQuery,
    'SELECT * WHERE { ?s ?p ?o }',
  );
  const dataset = new Dataset(
    'https://example.org/dataset',
    { en: 'Test' },
    { en: 'Test' },
    genres,
    [],
    'https://example.org/page',
    ['en'],
    [new Organization('https://example.org/org', { en: 'Org' }, {})],
    [distribution],
  );
  return { dataset, distribution };
}

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
  it('substitutes the dataset IRI into the query sent to Comunica', async () => {
    await query('https://data.beeldengeluid.nl/id/datadownload/0026');
    const sentQuery = comunicaMock.queryQuads.mock.calls[0][0];
    expect(sentQuery).toContain(
      '<http://data.beeldengeluid.nl/gtaa/Persoonsnamen>',
    );
    expect(sentQuery).not.toContain('?datasetUri');
  });

  it('escapes a search term that would otherwise break the query', async () => {
    const { dataset, distribution } = createTestDataset(
      'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?query }',
    );
    await service.search(
      'van "gogh" \\ x',
      QueryMode.RAW,
      dataset,
      distribution,
      10_000,
      10_000,
    );
    const sentQuery = comunicaMock.queryQuads.mock.calls[0][0];
    expect(sentQuery).toContain('"van \\"gogh\\" \\\\ x"');
    expect(sentQuery).not.toContain('?query');
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
  };
};

describe('parameterizeGenres', () => {
  const datasetGenres = [
    'https://example.com/genre/Personen',
    'https://example.com/genre/Locaties',
  ];
  const queryWithGenres =
    'SELECT * WHERE { VALUES ?requestedGenre { ?genres } }';
  const queryWithoutGenres = 'SELECT * WHERE { ?s ?p ?o }';

  it('replaces ?genres with a single requested genre', () => {
    const result = parameterizeGenres(
      queryWithGenres,
      ['https://example.com/genre/Personen'],
      datasetGenres,
    );
    expect(result).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> } }',
    );
  });

  it('replaces ?genres with multiple requested genres', () => {
    const result = parameterizeGenres(
      queryWithGenres,
      [
        'https://example.com/genre/Personen',
        'https://example.com/genre/Locaties',
      ],
      datasetGenres,
    );
    expect(result).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> <https://example.com/genre/Locaties> } }',
    );
  });

  it('defaults to all dataset genres when no genres requested', () => {
    const result = parameterizeGenres(
      queryWithGenres,
      undefined,
      datasetGenres,
    );
    expect(result).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> <https://example.com/genre/Locaties> } }',
    );
  });

  it('defaults to all dataset genres when empty genres array provided', () => {
    const result = parameterizeGenres(queryWithGenres, [], datasetGenres);
    expect(result).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> <https://example.com/genre/Locaties> } }',
    );
  });

  it('filters out genres not belonging to the dataset', () => {
    const result = parameterizeGenres(
      queryWithGenres,
      ['https://example.com/genre/Unknown'],
      datasetGenres,
    );
    expect(result).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> <https://example.com/genre/Locaties> } }',
    );
  });

  it('returns query unchanged when ?genres placeholder is absent', () => {
    const result = parameterizeGenres(
      queryWithoutGenres,
      ['https://example.com/genre/Personen'],
      datasetGenres,
    );
    expect(result).toBe(queryWithoutGenres);
  });
});

describe('buildSearchQuery', () => {
  it('returns query and bindings for variables present in the template', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { ?s ?p ?o . FILTER(str(?s) = ?query) . ?s schema:dataset ?datasetUri } ?limit #LIMIT#',
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
    });

    expect(result.query).toContain('LIMIT 10');
    expect(result.bindings['datasetUri'].value).toBe(
      'https://example.org/dataset',
    );
    expect(result.bindings['limit'].value).toBe('10');
    expect(result.bindings['query'].value).toBe('test');
  });

  it('omits bindings for variables not in the template', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { ?s ?p ?o } #LIMIT#',
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
    });

    expect(result.query).toBe('SELECT * WHERE { ?s ?p ?o } LIMIT 10');
    expect(result.bindings['datasetUri']).toBeUndefined();
    expect(result.bindings['limit']).toBeUndefined();
    expect(result.bindings['query']).toBeUndefined();
  });

  it('parameterizes genres when dataset has genres', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { VALUES ?requestedGenre { ?genres } ?s ?p ?o } #LIMIT#',
      [
        'https://example.com/genre/Personen',
        'https://example.com/genre/Locaties',
      ],
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
    });

    expect(result.query).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> <https://example.com/genre/Locaties> } ?s ?p ?o } LIMIT 10',
    );
  });

  it('filters requestedGenres against dataset genres', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { VALUES ?requestedGenre { ?genres } ?s ?p ?o } #LIMIT#',
      [
        'https://example.com/genre/Personen',
        'https://example.com/genre/Locaties',
      ],
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
      requestedGenres: ['https://example.com/genre/Personen'],
    });

    expect(result.query).toBe(
      'SELECT * WHERE { VALUES ?requestedGenre { <https://example.com/genre/Personen> } ?s ?p ?o } LIMIT 10',
    );
  });

  it('leaves query unchanged when no genres are involved', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { ?s ?p ?o } #LIMIT#',
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'test',
      queryMode: QueryMode.OPTIMIZED,
      limit: 10,
    });

    expect(result.query).toBe('SELECT * WHERE { ?s ?p ?o } LIMIT 10');
  });

  it('creates Virtuoso-specific query variant', () => {
    const { dataset, distribution } = createTestDataset(
      'SELECT * WHERE { ?s ?virtuosoQuery ?o }',
    );
    const result = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: 'van gogh',
      queryMode: QueryMode.OPTIMIZED,
      limit: 100,
    });

    // Virtuoso format: 'word1' AND 'word2' for multi-word queries
    expect(result.bindings['virtuosoQuery'].value).toBe("'van' AND 'gogh'");
  });
});

const dataFactory = new DataFactory();

describe('substituteBindings', () => {
  it('substitutes a term into every occurrence of its variable', () => {
    const query = substituteBindings('FILTER(?query = ?query)', {
      query: dataFactory.literal('fiets'),
    });

    expect(query).toBe('FILTER("fiets" = "fiets")');
  });

  // `String.replaceAll` reads `$` patterns in a replacement string: `$'` stands for the text
  // following the match, so a search term containing it used to end the string literal and let the
  // caller write the rest of the query.
  it.each([["a$'b"], ['a$`b'], ['a$&b'], ['a$1b']])(
    'substitutes a term containing a replacement pattern verbatim: %s',
    (searchTerm) => {
      const query = substituteBindings(
        'FILTER(CONTAINS(LCASE(?label), LCASE(?query))) } LIMIT 10',
        { query: dataFactory.literal(searchTerm) },
      );

      expect(query).toBe(
        `FILTER(CONTAINS(LCASE(?label), LCASE("${searchTerm}"))) } LIMIT 10`,
      );
    },
  );
});
