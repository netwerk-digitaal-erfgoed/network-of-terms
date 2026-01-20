import { describe, it, expect } from 'vitest';
import { extractMonitorConfigs } from '../src/sync/monitor-sync.js';
import {
  Catalog,
  Dataset,
  Organization,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

function createDataset(
  iri: string,
  name: string,
  endpoint: string,
  query = 'SELECT * WHERE { ?s ?p ?o } #LIMIT#',
): Dataset {
  return new Dataset(
    iri,
    { nl: name, en: name },
    { nl: 'Description', en: 'Description' },
    [],
    [],
    'http://example.org/page',
    ['nl', 'en'],
    [new Organization('http://example.org/org', { nl: 'Org' }, {})],
    [
      new SparqlDistribution(
        `${iri}/distribution`,
        endpoint,
        query,
        'SELECT * WHERE { ?s ?p ?o }',
      ),
    ],
  );
}

describe('monitor-sync', () => {
  describe('extractMonitorConfigs', () => {
    it('should create one monitor per dataset', () => {
      const catalog = new Catalog([
        createDataset(
          'http://example.org/dataset1',
          'Dataset 1',
          'http://example.org/sparql',
        ),
        createDataset(
          'http://example.org/dataset2',
          'Dataset 2',
          'http://other.org/sparql',
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(2);
      expect(monitors.map((m) => m.identifier)).toContain(
        'http://example.org/dataset1',
      );
      expect(monitors.map((m) => m.identifier)).toContain(
        'http://example.org/dataset2',
      );
    });

    it('should use dataset IRI as monitor identifier', () => {
      const catalog = new Catalog([
        createDataset(
          'http://example.org/my-dataset',
          'My Dataset',
          'http://example.org/sparql',
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(1);
      expect(monitors[0].identifier).toBe('http://example.org/my-dataset');
    });

    it('should create separate monitors even for datasets sharing same endpoint', () => {
      const catalog = new Catalog([
        createDataset(
          'http://example.org/dataset1',
          'Dataset 1',
          'http://example.org/sparql',
        ),
        createDataset(
          'http://example.org/dataset2',
          'Dataset 2',
          'http://example.org/sparql',
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(2);
    });

    it('should skip child datasets (those with # in IRI)', () => {
      const catalog = new Catalog([
        createDataset(
          'http://example.org/aat',
          'AAT',
          'http://example.org/sparql',
        ),
        createDataset(
          'http://example.org/aat#materials',
          'AAT Materials',
          'http://example.org/sparql',
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(1);
      expect(monitors[0].identifier).toBe('http://example.org/aat');
    });

    it('should strip credentials from endpoint URLs', () => {
      const catalog = new Catalog([
        createDataset(
          'http://example.org/dataset',
          'Dataset',
          'http://user:pass@example.org/sparql',
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(1);
      expect(monitors[0].endpointUrl.toString()).toBe(
        'http://example.org/sparql',
      );
    });

    it('should include query in monitor config', () => {
      const query = 'SELECT ?term WHERE { ?term a skos:Concept }';
      const catalog = new Catalog([
        createDataset(
          'http://example.org/dataset',
          'Dataset',
          'http://example.org/sparql',
          query,
        ),
      ]);

      const monitors = extractMonitorConfigs(catalog);

      expect(monitors.length).toBe(1);
      expect(monitors[0].query).toBe(query);
    });
  });
});
