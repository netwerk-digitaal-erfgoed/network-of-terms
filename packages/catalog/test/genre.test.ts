import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import type { IRI } from '@netwerk-digitaal-erfgoed/network-of-terms-query';

const genreIri: IRI = 'http://example.com/genre/1';

const rdfXmlResponse = (labels: { language: string; value: string }[]) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    xmlns:skos="http://www.w3.org/2004/02/skos/core#">
  <skos:Concept rdf:about="${genreIri}">
    ${labels
      .map(
        (label) =>
          `<skos:prefLabel xml:lang="${label.language}">${label.value}</skos:prefLabel>`,
      )
      .join('\n    ')}
  </skos:Concept>
</rdf:RDF>`,
    { headers: { 'Content-Type': 'application/rdf+xml' } },
  );

let fetchMock: MockInstance;

beforeEach(() => {
  fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      rdfXmlResponse([{ language: 'nl', value: 'Testgenre' }]),
    );
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Reset module to clear caches between tests.
  vi.resetModules();
});

const importGenre = async () =>
  import('../src/genre.js').then((m) => m.dereferenceGenre);

describe('dereferenceGenre', () => {
  it('fetches and caches a genre', async () => {
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);

    expect(result).not.toBeNull();
    expect(result!.name.nl).toEqual('Testgenre');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toEqual(`${genreIri}.rdf`);

    // Second call should return cached data without querying again.
    const cached = await dereferenceGenre(genreIri);
    expect(cached!.name.nl).toEqual('Testgenre');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns stale data and refreshes in the background when cache expires', async () => {
    const dereferenceGenre = await importGenre();

    // Prime the cache.
    await dereferenceGenre(genreIri);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Expire the cache.
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(Date.now() + 86_400_001) // expired check
      .mockReturnValue(Date.now() + 86_400_001); // new cache entry

    // Update mock to return new data for the background refresh.
    fetchMock.mockImplementation(async () =>
      rdfXmlResponse([{ language: 'nl', value: 'Updated genre' }]),
    );

    // Should return stale data immediately.
    const stale = await dereferenceGenre(genreIri);
    expect(stale!.name.nl).toEqual('Testgenre');

    // Wait for background refresh to complete.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('returns null when fetch fails and no cache exists', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);

    expect(result).toBeNull();
  });

  it('returns null when the upstream answers with an error status', async () => {
    fetchMock.mockImplementation(
      async () => new Response('Not found', { status: 404 }),
    );
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);

    expect(result).toBeNull();
  });

  it('does not cache empty results when upstream returns no labels', async () => {
    fetchMock.mockImplementation(async () => rdfXmlResponse([]));
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);
    expect(result).toBeNull();

    // Recovery: upstream starts returning labels on the next call.
    fetchMock.mockImplementation(async () =>
      rdfXmlResponse([{ language: 'nl', value: 'Testgenre' }]),
    );

    const recovered = await dereferenceGenre(genreIri);
    expect(recovered).not.toBeNull();
    expect(recovered!.name.nl).toEqual('Testgenre');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps stale data when background refresh fails', async () => {
    const dereferenceGenre = await importGenre();

    // Prime the cache.
    await dereferenceGenre(genreIri);

    // Expire the cache and make refresh fail.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_001);
    fetchMock.mockRejectedValue(new Error('Server down'));

    // Should still return stale data.
    const stale = await dereferenceGenre(genreIri);
    expect(stale!.name.nl).toEqual('Testgenre');

    // Wait for the failed background refresh to settle.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Data should still be the original stale data.
    const stillStale = await dereferenceGenre(genreIri);
    expect(stillStale!.name.nl).toEqual('Testgenre');
  });

  it('does not trigger multiple concurrent refreshes', async () => {
    const dereferenceGenre = await importGenre();

    // Prime the cache.
    await dereferenceGenre(genreIri);

    // Expire the cache.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_001);

    // Make refresh slow.
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(rdfXmlResponse([{ language: 'nl', value: 'Refreshed' }])),
            50,
          ),
        ),
    );

    // Call multiple times while refresh is pending.
    await dereferenceGenre(genreIri);
    await dereferenceGenre(genreIri);
    await dereferenceGenre(genreIri);

    // Wait for background refresh.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Should have only triggered one refresh despite multiple calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
