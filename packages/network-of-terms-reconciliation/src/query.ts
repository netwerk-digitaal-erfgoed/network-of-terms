import {
  Catalog,
  IRI,
  QueryMode,
  QueryTermsService,
  Terms,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

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

  return await Object.entries(query).reduce(
    async (
      resultsPromise: Promise<ReconciliationResultBatch>,
      [queryId, {query: queryString}]
    ) => {
      const results = await resultsPromise;
      const termsResult = await queryTermsService.search(
        queryString,
        QueryMode.OPTIMIZED,
        dataset,
        distribution,
        10000
      );
      const terms = termsResult instanceof Terms ? termsResult.terms : [];
      results[queryId] = {
        result: terms.map(term => ({
          id: term.id.value.toString(),
          name: term.prefLabels.map(label => label.value).join(' • '), // Join similarly to network-of-terms-demo.
          score: 1, // Hard-coded score for now because scoring will have to be done on our side because no scores are returned from the sources.
          description: term.altLabels.map(label => label.value).join(' • '),
        })),
      };
      return results;
    },
    Promise.resolve({})
  );
}

export type ReconciliationQueryBatch = {[key: string]: {query: string}};

export type ReconciliationResultBatch = {
  [key: string]: {result: ReconciliationCandidate[]};
};

export type ReconciliationCandidate = {
  id: string;
  name: string;
  score: number;
  description?: string;
};
