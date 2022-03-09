import {Term} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import leven from 'leven';
import RDF from 'rdf-js';

/**
 * Calculate score for term based on case-insensitive Levenshtein distance between the search string and the term’s
 * prefLabels and altLabels, on a scale of 0–100 percentage match.
 */
export const score = (searchString: string, term: Term): number => {
  // Score both prefLabels and altLabels and return the highest score.
  return Math.max(
    calculateMatchingScore(searchString.toLowerCase(), term.prefLabels),
    calculateMatchingScore(searchString.toLowerCase(), term.altLabels)
  );
};

const calculateMatchingScore = (
  searchString: string,
  literals: RDF.Literal[]
): number => {
  if (literals.length === 0) {
    return 0;
  }

  const distance = literals.reduce(
    (distance, literal) =>
      distance -
      leven(searchString.toLowerCase(), literal.value.toLowerCase()) /
        Math.max(searchString.length, literal.value.length),
    1
  );

  return Math.round((distance + Number.EPSILON) * 10000) / 100; // Return percentage match rounded to two decimals.
};
