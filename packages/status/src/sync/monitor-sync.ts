import {
  type Catalog,
  type Dataset,
  buildSearchQuery,
  QueryMode,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import type { MonitorConfig } from '@lde/sparql-monitor';
import type * as RDF from '@rdfjs/types';

/**
 * Check if a dataset is a child dataset (has # fragment in IRI).
 * Child datasets like "aat#materials" are subsets of parent datasets like "aat".
 */
function isChildDataset(dataset: Dataset): boolean {
  return dataset.iri.includes('#');
}

/**
 * Serialize RDF term to SPARQL syntax.
 */
function serializeTerm(term: RDF.Term): string {
  if (term.termType === 'NamedNode') {
    return `<${term.value}>`;
  }
  if (term.termType === 'Literal') {
    if (term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#integer') {
      return term.value;
    }
    return `"${term.value.replace(/"/g, '\\"')}"`;
  }
  return `"${term.value}"`;
}

/**
 * Build a query with bindings substituted into the query string.
 */
function buildMonitorQuery(template: string, datasetIri: string): string {
  const { query, bindings } = buildSearchQuery({
    template,
    searchTerm: 'test',
    queryMode: QueryMode.OPTIMIZED,
    datasetIri,
    limit: 1,
  });

  let substituted = query;
  for (const [varName, term] of Object.entries(bindings)) {
    const regex = new RegExp(`\\?${varName}\\b`, 'g');
    substituted = substituted.replace(regex, serializeTerm(term));
  }

  return substituted;
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
      query: buildMonitorQuery(distribution.searchQuery, dataset.iri),
    });
  }

  return monitors;
}
