import {
  Catalog,
  IRI,
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
  distributionIri: IRI,
  query: ReconciliationQueryBatch,
  catalog: Catalog,
  queryTermsService: QueryTermsService
): Promise<ReconciliationResultBatch> {
  const dataset = catalog.getDatasetByDistributionIri(distributionIri)!;
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
        10000
      );
      const terms =
        response.result instanceof Terms ? response.result.terms : [];
      results[queryId] = {
        result: terms
          .map(term => ({
            id: term.id.value.toString(),
            name: term.prefLabels.map(label => label.value).join(' • '), // Join similarly to network-of-terms-demo.
            score: score(queryString, term),
            description: term.altLabels.map(label => label.value).join(' • '),
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
