import {
  Catalog,
  IRI,
  literalValues,
  QueryMode,
  QueryTermsService,
  Terms,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {score} from './score.js';

/**
 * Fan out reconciliation query batch to terminology source queries.
 *
 * This first approach sends the source queries serially, in order to limit load on the sources.
 * We may want to make this smarter by batching queries and acting on Timeout responses.
 */
export async function reconciliationQuery(
  datasetIri: IRI,
  query: ReconciliationQueryBatch,
  catalog: Catalog,
  queryTermsService: QueryTermsService,
  language: string
): Promise<ReconciliationResultBatch> {
  const dataset = catalog.getDatasetByIri(datasetIri)!;
  const distribution = dataset.distributions[0];

  return Object.entries(query).reduce(
    async (
      resultsPromise: Promise<ReconciliationResultBatch>,
      [queryId, {query: queryString, limit}]
    ) => {
      const results = await resultsPromise;
      const response = await queryTermsService.search(
        queryString,
        QueryMode.OPTIMIZED,
        dataset,
        distribution,
        100,
        10000
      );
      const terms =
        response.result instanceof Terms ? response.result.terms : [];
      results[queryId] = {
        result: terms
          .map(term => ({
            id: term.id.value.toString(),
            name: literalValues(term.prefLabels, [language]).join(' • '), // Join similarly to network-of-terms-demo.
            score: score(queryString, term),
            description: literalValues(term.altLabels, [language]).join(' • '),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit),
      };
      return results;
    },
    Promise.resolve({})
  );
}

export type ReconciliationQueryBatch = {
  [key: string]: {
    query: string;
    limit?: number;
  };
};

export type ReconciliationResultBatch = {
  [key: string]: {result: ReconciliationCandidate[]};
};

export type ReconciliationCandidate = {
  id: string;
  name: string;
  score: number;
  description?: string;
};
