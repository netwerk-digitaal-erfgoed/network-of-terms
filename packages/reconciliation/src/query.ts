import {
  Catalog,
  IRI,
  literalValues,
  QueryMode,
  QueryTermsService,
  Term,
  Terms,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { score } from './score.js';
import {
  compareProperties,
  isPropertyId,
  PropertyComparison,
  PropertyId,
  ReconciliationQueryProperty,
} from './properties.js';

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
  language: string,
): Promise<ReconciliationResultBatch> {
  const dataset = catalog.getDatasetByIri(datasetIri)!;
  const distribution = dataset.distributions[0];

  return Object.entries(query).reduce(
    async (
      resultsPromise: Promise<ReconciliationResultBatch>,
      [queryId, { query: queryString, limit, properties = [] }],
    ) => {
      const results = await resultsPromise;
      const response = await queryTermsService.search(
        queryString,
        QueryMode.OPTIMIZED,
        dataset,
        distribution,
        // The source cuts off the name matches, so with properties to rank them on, the right
        // person among many namesakes must be fetched before the ranking can find them. Only a
        // source of persons states the properties; any other would just answer slower.
        properties.some(({ pid }) => isPropertyId(pid)) &&
          dataset.genres.includes(personsGenre)
          ? 1000
          : 100,
        10000,
      );
      const terms =
        response.result instanceof Terms ? response.result.terms : [];
      const candidates = terms
        .map((term) => {
          const nameScore = score(queryString, term);
          const comparisons = compareProperties(term, properties);
          return {
            id: term.id.value.toString(),
            name: literalValues(term.prefLabels, [language]).join(' • '), // Join similarly to network-of-terms-demo.
            score: combinedScore(nameScore, comparisons),
            description: [
              ...lifespan(term),
              ...literalValues(term.altLabels, [language]),
            ].join(' • '),
            ...(comparisons.length > 0 && {
              features: features(nameScore, comparisons),
            }),
          };
        })
        .sort((a, b) => b.score - a.score);
      // Judged before the limit cuts off the candidates that would tie with the first.
      const match = isMatch(candidates);
      results[queryId] = {
        result: candidates
          .slice(0, limit)
          .map((candidate, index) =>
            index === 0 && match ? { ...candidate, match: true } : candidate,
          ),
      };
      return results;
    },
    Promise.resolve({}),
  );
}

export type ReconciliationQueryBatch = {
  [key: string]: {
    query: string;
    limit?: number;
    properties?: ReconciliationQueryProperty[];
  };
};

export type ReconciliationResultBatch = {
  [key: string]: { result: ReconciliationCandidate[] };
};

export type ReconciliationCandidate = {
  id: string;
  name: string;
  score: number;
  description?: string;
  // Why the candidate scored as it did: the name and each property compared, from 0 to 1.
  features?: { id: string; value: number }[];
  match?: boolean;
};

// The genre the catalog gives sources of persons, such as RKDartists.
const personsGenre =
  'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen';

/**
 * The name and each property the client sent count equally. A property the source states nothing
 * about counts half, so such a candidate ranks below one that matches and above one that
 * contradicts. Only a candidate whose name and properties all match scores 100, however close the
 * others round.
 */
const combinedScore = (
  nameScore: number,
  comparisons: PropertyComparison[],
) => {
  if (
    nameScore === 100 &&
    comparisons.every((comparison) => comparison.value === 1)
  ) {
    return 100;
  }
  const average =
    (nameScore / 100 +
      comparisons.reduce(
        (sum, comparison) => sum + (comparison.value ?? 0.5),
        0,
      )) /
    (1 + comparisons.length);

  return Math.min(Math.round(average * 10000) / 100, 99.99);
};

const features = (nameScore: number, comparisons: PropertyComparison[]) => [
  { id: 'name', value: nameScore / 100 },
  ...comparisons.filter(
    (comparison): comparison is { id: PropertyId; value: number } =>
      comparison.value !== undefined,
  ),
];

// A candidate is the match when its name and every property the client sent match, and no other
// candidate’s do. Without properties, a name alone does not single out a person.
const isMatch = (candidates: ReconciliationCandidate[]) =>
  candidates[0]?.features !== undefined &&
  candidates[0].score === 100 &&
  (candidates[1]?.score ?? 0) < 100;

// The birth and death dates of the person a term denotes, as ‘1606-07-15 – 1669-10-04’, so that
// namesakes can be told apart in the list of candidates. Empty for any other term.
const lifespan = (term: Term) => {
  const dates = [term.person?.birthDates, term.person?.deathDates].map(
    (dates = []) => dates.join(', '),
  );

  return dates.some((date) => date !== '') ? [dates.join(' – ').trim()] : [];
};
