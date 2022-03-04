import {
  Catalog,
  IRI,
  QueryMode,
  QueryTermsService,
  Term,
  Terms,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import leven from 'leven';

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
        result: terms
          .map(term => ({
            id: term.id.value.toString(),
            name: term.prefLabels.map(label => label.value).join(' • '), // Join similarly to network-of-terms-demo.
            score: score(queryString, term),
            description: term.altLabels.map(label => label.value).join(' • '),
          }))
          .sort((a, b) => b.score - a.score),
      };
      return results;
    },
    Promise.resolve({})
  );
}

/**
 * Calculate score for term based on case-insensitive Levenshtein distance between the query string and the term’s
 * prefLabels.
 */
const score = (queryString: string, term: Term): number => {
  if (term.prefLabels.length === 0) {
    return 0;
  }

  return (
    1 /
    term.prefLabels.reduce(
      (distance, prefLabel) =>
        distance +
        leven(queryString.toLowerCase(), prefLabel.value.toLowerCase()),
      1
    )
  );
};

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
