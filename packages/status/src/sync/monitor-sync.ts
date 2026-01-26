import type {
  Catalog,
  Dataset,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import type { MonitorConfig } from '@lde/sparql-monitor';

/**
 * Check if a dataset is a child dataset (has # fragment in IRI).
 * Child datasets like "aat#materials" are subsets of parent datasets like "aat".
 */
function isChildDataset(dataset: Dataset): boolean {
  return dataset.iri.includes('#');
}

/**
 * Extract monitor configurations from catalog.
 * Creates one monitor per dataset, using the dataset IRI as the identifier.
 */
export function extractMonitorConfigs(catalog: Catalog): MonitorConfig[] {
  const monitors: MonitorConfig[] = [];

  for (const dataset of catalog.datasets) {
    if (isChildDataset(dataset)) {
      continue;
    }

    const distribution = dataset.distributions[0];
    if (!distribution?.endpoint || !distribution?.searchQuery) {
      continue;
    }

    monitors.push({
      identifier: dataset.iri,
      endpointUrl: new URL(distribution.endpoint.toString()),
      query: distribution.searchQuery,
    });
  }

  return monitors;
}
