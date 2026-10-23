import { testCatalog } from '../src/test-utils.js';
import {
  buildSearchQuery,
  substituteBindings,
  Dataset,
  Organization,
  parameterizeGenres,
  QueryMode,
  QueryTermsService,
  ServerError,
  SparqlDistribution,
  Terms,
  TimeoutError,
} from '../src/index.js';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { DataFactory } from 'rdf-data-factory';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const fetcherMock = {
  fetchTriples: vi.fn<SparqlEndpointFetcher['fetchTriples']>(
    async () => Readable.from([]) as never,
  ),
};
const service = new QueryTermsService({
  fetcher: fetcherMock as unknown as SparqlEndpointFetcher,
});

describe('Query', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });
  it('substitutes the dataset IRI into the query sent to the endpoint', async () => {
    await query('https://data.beeldengeluid.nl/id/datadownload/0026');
    const sentQuery = fetcherMock.fetchTriples.mock.calls[0][1];
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
    const sentQuery = fetcherMock.fetchTriples.mock.calls[0][1];
    expect(sentQuery).toContain('"van \\"gogh\\" \\\\ x"');
    expect(sentQuery).not.toContain('?query');
  });

  it('supports HTTP authentication', async () => {
    const [endpoint, , options] = await query(
      'https://data.beeldengeluid.nl/id/datadownload/0026',
    );

    // Must not contain credentials in URL...
    expect(endpoint).toEqual('https://gtaa.apis.beeldengeluid.nl/sparql');
    // ... but in an Authorization header.
    const fetchMock = vi.fn().mockResolvedValue(new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    await options.fetch(endpoint, {});
    vi.unstubAllGlobals();
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toEqual(
      `Basic ${Buffer.from('username:password').toString('base64')}`,
    );
  });
});

describe('Query against an endpoint', () => {
  const endpointService = new QueryTermsService({
    logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
  });
  const { dataset, distribution } = createTestDataset(
    'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
  );
  const search = (timeoutMs = 10_000) =>
    endpointService.search(
      'nachtwacht',
      QueryMode.RAW,
      dataset,
      distribution,
      10,
      timeoutMs,
    );
  const stubEndpoint = (respond: (signal: AbortSignal) => Promise<Response>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string, init: RequestInit) =>
        respond(init.signal as AbortSignal),
      ),
    );
  // A response that never ends, until the request is aborted.
  const endlessBody = (signal: AbortSignal) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('# still searching\n'));
        signal.addEventListener('abort', () => controller.error(signal.reason));
      },
    });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the terms the endpoint finds', async () => {
    stubEndpoint(
      async () =>
        new Response(
          '<https://example.org/nachtwacht> a <http://www.w3.org/2004/02/skos/core#Concept> ;\n' +
            '  <http://www.w3.org/2004/02/skos/core#prefLabel> "Nachtwacht"@nl .\n',
          { headers: { 'Content-Type': 'text/turtle' } },
        ),
    );
    const response = await search();
    expect(response.result).toBeInstanceOf(Terms);
    expect((response.result as Terms).terms[0].id.value).toEqual(
      'https://example.org/nachtwacht',
    );
  });

  it('reports an error response as a server error', async () => {
    stubEndpoint(
      async () => new Response('Virtuoso 37000 Error', { status: 400 }),
    );
    const response = await search();
    expect(response.result).toBeInstanceOf(ServerError);
    expect((response.result as ServerError).message).toContain(
      'Virtuoso 37000 Error',
    );
  });

  it('falls back to the default timeout when none is given', async () => {
    stubEndpoint(async () => new Response('', { status: 200 }));
    const response = await search(undefined as unknown as number);
    expect(response.result).toBeInstanceOf(Terms);
  });

  it('times out while waiting for a response', async () => {
    stubEndpoint(
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    const response = await search(50);
    expect(response.result).toBeInstanceOf(TimeoutError);
  });

  it('times out while the response is still streaming in, and aborts it', async () => {
    let requestSignal: AbortSignal | undefined;
    stubEndpoint(async (signal) => {
      requestSignal = signal;
      return new Response(endlessBody(signal), {
        headers: { 'Content-Type': 'text/turtle' },
      });
    });
    const response = await search(50);
    expect(response.result).toBeInstanceOf(TimeoutError);
    expect(requestSignal?.aborted).toBe(true);
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

  return fetcherMock.fetchTriples.mock.calls[0] as unknown as [
    string,
    string,
    { fetch: typeof fetch },
  ];
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

  // Each binding used to be substituted in its own pass over the query, so a term inserted by an
  // earlier binding was searched again by the later ones.
  it('does not substitute into a term it just substituted', () => {
    const query = substituteBindings('FILTER(?query) ?s schema:dataset ?datasetUri', {
      query: dataFactory.literal('?datasetUri'),
      datasetUri: dataFactory.namedNode('https://example.com/dataset'),
    });

    expect(query).toBe(
      'FILTER("?datasetUri") ?s schema:dataset <https://example.com/dataset>',
    );
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
