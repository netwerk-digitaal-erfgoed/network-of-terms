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

  return Object.entries(query).reduce(
    async (
      resultsPromise: Promise<ReconciliationResultBatch>,
      [queryId, {query: queryString, limit}]
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
          .sort((a, b) => b.score - a.score)
          .slice(0, limit),
      };
      return results;
    },
    Promise.resolve({})
  );
}

/**
 * Calculate score for term based on case-insensitive Levenshtein distance between the query string and the term’s
 * prefLabels, on a scale of 0–100 percentage match.
 */
const score = (queryString: string, term: Term): number => {
  if (term.prefLabels.length === 0) {
    return 0;
  }

  const distance = term.prefLabels.reduce(
    (distance, prefLabel) =>
      distance -
      leven(queryString.toLowerCase(), prefLabel.value.toLowerCase()) /
        Math.max(queryString.length, prefLabel.value.length),
    1
  );

  return Math.round((distance + Number.EPSILON) * 10000) / 100; // Return percentage match rounded to two decimals.
};

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
