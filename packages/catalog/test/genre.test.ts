import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { QueryEngine } from '@comunica/query-sparql';
import type { IRI } from '@netwerk-digitaal-erfgoed/network-of-terms-query';

const genreIri: IRI = 'http://example.com/genre/1';

const mockBindings = (labels: { language: string; value: string }[]) =>
  labels.map(label => ({
    get: () => label,
  }));

let queryBindingsMock: MockInstance;

beforeEach(() => {
  queryBindingsMock = vi
    .spyOn(QueryEngine.prototype, 'queryBindings')
    .mockResolvedValue({
      toArray: async () =>
        mockBindings([{ language: 'nl', value: 'Testgenre' }]),
    } as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Reset module to clear caches between tests.
  vi.resetModules();
});

const importGenre = async () =>
  import('../src/genre.js').then(m => m.dereferenceGenre);

describe('dereferenceGenre', () => {
  it('fetches and caches a genre', async () => {
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);

    expect(result).not.toBeNull();
    expect(result!.name.nl).toEqual('Testgenre');
    expect(queryBindingsMock).toHaveBeenCalledTimes(1);

    // Second call should return cached data without querying again.
    const cached = await dereferenceGenre(genreIri);
    expect(cached!.name.nl).toEqual('Testgenre');
    expect(queryBindingsMock).toHaveBeenCalledTimes(1);
  });

  it('returns stale data and refreshes in the background when cache expires', async () => {
    const dereferenceGenre = await importGenre();

    // Prime the cache.
    await dereferenceGenre(genreIri);
    expect(queryBindingsMock).toHaveBeenCalledTimes(1);

    // Expire the cache.
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(Date.now() + 86_400_001) // expired check
      .mockReturnValue(Date.now() + 86_400_001); // new cache entry

    // Update mock to return new data for the background refresh.
    queryBindingsMock.mockResolvedValue({
      toArray: async () =>
        mockBindings([{ language: 'nl', value: 'Updated genre' }]),
    } as never);

    // Should return stale data immediately.
    const stale = await dereferenceGenre(genreIri);
    expect(stale!.name.nl).toEqual('Testgenre');

    // Wait for background refresh to complete.
    await vi.waitFor(() =>
      expect(queryBindingsMock).toHaveBeenCalledTimes(2),
    );
  });

  it('returns null when fetch fails and no cache exists', async () => {
    queryBindingsMock.mockRejectedValue(new Error('Network error'));
    const dereferenceGenre = await importGenre();

    const result = await dereferenceGenre(genreIri);

    expect(result).toBeNull();
  });

  it('keeps stale data when background refresh fails', async () => {
    const dereferenceGenre = await importGenre();

    // Prime the cache.
    await dereferenceGenre(genreIri);

    // Expire the cache and make refresh fail.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_001);
    queryBindingsMock.mockRejectedValue(new Error('Server down'));

    // Should still return stale data.
    const stale = await dereferenceGenre(genreIri);
    expect(stale!.name.nl).toEqual('Testgenre');

    // Wait for the failed background refresh to settle.
    await vi.waitFor(() =>
      expect(queryBindingsMock).toHaveBeenCalledTimes(2),
    );

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
    queryBindingsMock.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                toArray: async () =>
                  mockBindings([{ language: 'nl', value: 'Refreshed' }]),
              }),
            50,
          ),
        ),
    );

    // Call multiple times while refresh is pending.
    await dereferenceGenre(genreIri);
    await dereferenceGenre(genreIri);
    await dereferenceGenre(genreIri);

    // Wait for background refresh.
    await vi.waitFor(() =>
      expect(queryBindingsMock).toHaveBeenCalledTimes(2),
    );

    // Should have only triggered one refresh despite multiple calls.
    expect(queryBindingsMock).toHaveBeenCalledTimes(2);
  });
});
