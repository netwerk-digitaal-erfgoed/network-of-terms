import { describe, it, expect } from 'vitest';
import {
  LdesSerializer,
  type EnrichedObservation,
} from '../src/ldes/serializer.js';

describe('LdesSerializer', () => {
  const baseUrl = 'https://example.org/status/ldes';
  const serializer = new LdesSerializer({ baseUrl });

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
      const turtle = await serializer.serializeObservation(observation);

      // Check for expected RDF content
      expect(turtle).toContain('sosa:Observation');
      expect(turtle).toContain('sosa:hasFeatureOfInterest');
      expect(turtle).toContain('http://example.org/sparql');
      expect(turtle).toContain('sosa:resultTime');
      expect(turtle).toContain('2025-01-19T12:00:00');
      expect(turtle).toContain('not:isAvailable');
      expect(turtle).toContain('true');
      expect(turtle).toContain('not:responseTimeMs');
      expect(turtle).toContain('150');
    });

    it('should include error message when present', async () => {
      const observation = createObservation({
        success: false,
        errorMessage: 'Internal Server Error',
      });
      const turtle = await serializer.serializeObservation(observation);

      expect(turtle).toContain('not:errorMessage');
      expect(turtle).toContain('Internal Server Error');
      expect(turtle).toContain('false');
    });

    it('should include dataset IRI', async () => {
      const observation = createObservation({
        datasetIri: 'http://example.org/my-dataset',
      });
      const turtle = await serializer.serializeObservation(observation);

      expect(turtle).toContain('not:datasetIri');
      expect(turtle).toContain('http://example.org/my-dataset');
    });
  });

  describe('serializeStream', () => {
    it('should serialize LDES stream with metadata', async () => {
      const observations = [createObservation()];
      const turtle = await serializer.serializeStream(observations);

      // Check stream metadata
      expect(turtle).toContain('ldes:EventStream');
      expect(turtle).toContain('tree:view');
      expect(turtle).toContain('ldes:LatestVersionSubset');
      expect(turtle).toContain('ldes:timestampPath');
      expect(turtle).toContain('ldes:versionOfPath');
      expect(turtle).toContain('tree:member');
    });

    it('should include all observations as members', async () => {
      const observations = [
        createObservation({ id: 'obs-1' }),
        createObservation({
          id: 'obs-2',
          endpointUrl: 'http://other.org/sparql',
        }),
      ];
      const turtle = await serializer.serializeStream(observations);

      expect(turtle).toContain('/observations/obs-1');
      expect(turtle).toContain('/observations/obs-2');
      expect(turtle).toContain('http://example.org/sparql');
      expect(turtle).toContain('http://other.org/sparql');
    });

    it('should handle empty observation list', async () => {
      const turtle = await serializer.serializeStream([]);

      // Should still have stream metadata
      expect(turtle).toContain('ldes:EventStream');
      expect(turtle).toContain('ldes:LatestVersionSubset');
      // But no members
      expect(turtle).not.toContain('sosa:Observation');
    });
  });

  describe('getJsonLdContext', () => {
    it('should return valid JSON-LD context', () => {
      const context = serializer.getJsonLdContext();

      expect(context).toHaveProperty('@context');
      const ctx = (context as { '@context': Record<string, unknown> })[
        '@context'
      ];
      expect(ctx).toHaveProperty('sosa');
      expect(ctx).toHaveProperty('ldes');
      expect(ctx).toHaveProperty('tree');
      expect(ctx).toHaveProperty('Observation');
      expect(ctx).toHaveProperty('hasFeatureOfInterest');
      expect(ctx).toHaveProperty('isAvailable');
    });
  });
});
