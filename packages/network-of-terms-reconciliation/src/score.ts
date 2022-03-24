import {Term} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import leven from 'leven';
import RDF from 'rdf-js';

/**
 * Calculate score for term based on case-insensitive Levenshtein distance between the search string and the term’s
 * prefLabels and altLabels, on a scale of 0–100 percentage match.
 */
export const score = (searchString: string, term: Term): number => {
  // Score both prefLabels and altLabels and return the highest score.
  return calculateMatchingScore(searchString.toLowerCase(), [
    ...term.prefLabels,
    ...term.altLabels,
  ]);
};

const calculateMatchingScore = (
  searchString: string,
  literals: RDF.Literal[]
): number => {
  const scores = literals.map(
    literal =>
      1 -
      leven(searchString.toLowerCase(), literal.value.toLowerCase()) /
        Math.max(searchString.length, literal.value.length)
  );
  const maxScore = Math.max(...scores);

  return Math.round((maxScore + Number.EPSILON) * 10000) / 100; // Return percentage match rounded to two decimals.
};
