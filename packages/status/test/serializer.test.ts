import { describe, it, expect } from 'vitest';
import {
  LdesSerializer,
  type EnrichedObservation,
} from '../src/ldes/serializer.js';

/** Helper to collect a stream into a string */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('LdesSerializer', () => {
  const baseUrl = 'https://example.org/status/ldes';
  const serializer = new LdesSerializer({ baseUrl });
  const contentType = 'text/turtle';

  function createObservation(
    overrides: Partial<EnrichedObservation> = {},
  ): EnrichedObservation {
    return {
      id: 'test-uuid-123',
      monitor: 'http://example.org/dataset',
      endpointUrl: 'http://example.org/sparql',
      datasetIri: 'http://example.org/dataset',
      observedAt: new Date('2025-01-19T12:00:00Z'),
      responseTimeMs: 150,
      success: true,
      errorMessage: null,
      ...overrides,
    };
  }

  describe('serializeObservation', () => {
    it('should serialize a single observation to Turtle', async () => {
      const observation = createObservation();
      const turtle = await streamToString(
        serializer.serializeObservation(observation, contentType),
      );

      // Check for expected RDF content (full URIs from rdf-serialize)
      expect(turtle).toContain('sosa/Observation');
      expect(turtle).toContain('sosa/hasFeatureOfInterest');
      expect(turtle).toContain('http://example.org/sparql');
      expect(turtle).toContain('sosa/resultTime');
      expect(turtle).toContain('2025-01-19T12:00:00');
      expect(turtle).toContain('status#isAvailable');
      expect(turtle).toContain('true');
      expect(turtle).toContain('status#responseTimeMs');
      expect(turtle).toContain('150');
    });

    it('should include error message when present', async () => {
      const observation = createObservation({
        success: false,
        errorMessage: 'Internal Server Error',
      });
      const turtle = await streamToString(
        serializer.serializeObservation(observation, contentType),
      );

      expect(turtle).toContain('status#errorMessage');
      expect(turtle).toContain('Internal Server Error');
      expect(turtle).toContain('false');
    });

    it('should include dataset IRI as feature of interest', async () => {
      const observation = createObservation({
        datasetIri: 'http://example.org/my-dataset',
      });
      const turtle = await streamToString(
        serializer.serializeObservation(observation, contentType),
      );

      expect(turtle).toContain('sosa/hasFeatureOfInterest');
      expect(turtle).toContain('http://example.org/my-dataset');
    });
  });

  describe('serializeStreamMetadata', () => {
    it('should serialize LDES stream metadata with link to view', async () => {
      const turtle = await streamToString(
        serializer.serializeStreamMetadata(contentType),
      );

      // Check stream metadata (full URIs)
      expect(turtle).toContain('ldes#EventStream');
      expect(turtle).toContain('tree#view');
      expect(turtle).toContain('ldes#timestampPath');
      expect(turtle).toContain('ldes#versionOfPath');
      expect(turtle).toContain('/observations/latest');
    });
  });

  describe('serializeLatestView', () => {
    it('should serialize view with observation members', async () => {
      const observations = [createObservation()];
      const turtle = await streamToString(
        serializer.serializeLatestView(observations, contentType),
      );

      // Check view metadata (full URIs)
      expect(turtle).toContain('ldes#LatestVersionSubset');
      expect(turtle).toContain('tree#member');
    });

    it('should include all observations as members', async () => {
      const observations = [
        createObservation({ id: 'obs-1' }),
        createObservation({
          id: 'obs-2',
          endpointUrl: 'http://other.org/sparql',
        }),
      ];
      const turtle = await streamToString(
        serializer.serializeLatestView(observations, contentType),
      );

      expect(turtle).toContain('/observations/obs-1');
      expect(turtle).toContain('/observations/obs-2');
      expect(turtle).toContain('http://example.org/sparql');
      expect(turtle).toContain('http://other.org/sparql');
    });

    it('should handle empty observation list', async () => {
      const turtle = await streamToString(
        serializer.serializeLatestView([], contentType),
      );

      // Should still have view metadata
      expect(turtle).toContain('ldes#LatestVersionSubset');
      // But no observation data
      expect(turtle).not.toContain('sosa/Observation');
    });

    it('should strip credentials from endpoint URL', async () => {
      const observations = [
        createObservation({
          endpointUrl: 'https://user:password@example.org/sparql',
        }),
      ];
      const turtle = await streamToString(
        serializer.serializeLatestView(observations, contentType),
      );

      expect(turtle).toContain('https://example.org/sparql');
      expect(turtle).not.toContain('user:password');
    });
  });
});
