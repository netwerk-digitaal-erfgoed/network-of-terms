import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLoggingFetch } from '../../src/helpers/logging-fetch.js';
import Pino from 'pino';

describe('createLoggingFetch', () => {
  const mockLogger = {
    debug: vi.fn(),
  } as unknown as Pino.Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')));
  });

  it('fixes missing whitespace before ORDER BY', async () => {
    const loggingFetch = createLoggingFetch(mockLogger);
    const body = new URLSearchParams();
    body.set(
      'query',
      'SELECT ?uri WHERE { } GROUP BY ?uriORDER BY DESC(?score)',
    );

    await loggingFetch('https://example.org/sparql', {
      method: 'POST',
      body,
      headers: new Headers({ 'content-length': '100' }),
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT ?uri WHERE { } GROUP BY ?uri ORDER BY DESC(?score)',
      }),
      'SPARQL query',
    );
  });

  it('removes stale Content-Length header', async () => {
    const loggingFetch = createLoggingFetch(mockLogger);
    const body = new URLSearchParams();
    body.set('query', 'SELECT ?uriORDER BY ?x');
    const headers = new Headers({ 'content-length': '100' });

    await loggingFetch('https://example.org/sparql', {
      method: 'POST',
      body,
      headers,
    });

    expect(headers.has('content-length')).toBe(false);
  });

  it('logs the URL', async () => {
    const loggingFetch = createLoggingFetch(mockLogger);
    const body = new URLSearchParams();
    body.set('query', 'SELECT * WHERE { }');

    await loggingFetch('https://example.org/sparql', {
      method: 'POST',
      body,
      headers: new Headers(),
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.org/sparql',
      }),
      'SPARQL query',
    );
  });

  it('passes through requests without URLSearchParams body', async () => {
    const loggingFetch = createLoggingFetch(mockLogger);

    await loggingFetch('https://example.org/sparql', {
      method: 'GET',
    });

    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
  });
});
