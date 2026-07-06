import { StatusClient } from '../src/status.js';
import type { FastifyBaseLogger } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const statusServiceUrl = 'https://status.example.com';
const datasetIri = 'https://example.com/dataset';

const logger = {
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as FastifyBaseLogger;

const turtle = `
  @prefix sosa: <http://www.w3.org/ns/sosa/> .
  @prefix status: <https://nde.nl/ns/status#> .

  <https://example.com/observation/1>
    sosa:hasFeatureOfInterest <${datasetIri}> ;
    sosa:resultTime "2026-01-01T00:00:00Z" ;
    sosa:hasResult [ status:isAvailable true ] .

  <https://example.com/observation/2>
    sosa:hasFeatureOfInterest <https://example.com/unavailable-dataset> .
`;

describe('StatusClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('caches statuses from the status service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(turtle, { status: 200 })),
    );
    const client = new StatusClient(statusServiceUrl, logger);

    expect(client.getStatus(datasetIri)).toBeNull();
    await vi.waitFor(() =>
      expect(client.getStatus(datasetIri)).toEqual({
        isAvailable: true,
        lastChecked: '2026-01-01T00:00:00Z',
      }),
    );
    expect(client.getStatus('https://example.com/unavailable-dataset')).toEqual(
      {
        isAvailable: false,
        lastChecked: '',
      },
    );
    expect(client.getStatus('https://example.com/unknown-dataset')).toBeNull();
  });

  it('warns when the status service responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );
    const client = new StatusClient(statusServiceUrl, logger);

    expect(client.getStatus(datasetIri)).toBeNull();
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Status service returned 502'),
      ),
    );
  });

  it('warns when the status service is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    const client = new StatusClient(statusServiceUrl, logger);

    expect(client.getStatus(datasetIri)).toBeNull();
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(TypeError) },
        'Failed to fetch status from service',
      ),
    );
  });

  it('warns when the status service responds with invalid Turtle', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('not valid turtle', { status: 200 })),
    );
    const client = new StatusClient(statusServiceUrl, logger);

    expect(client.getStatus(datasetIri)).toBeNull();
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to parse status Turtle',
      ),
    );
  });
});
