import {Term} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {cosine} from 'string-comparison';

/**
 * Calculate score for term based on case-insensitive cosine similarity, ignoring punctuation, between the search string
 * and the term’s prefLabels and altLabels, on a scale of 0–100 percentage match.
 */
export const score = (searchString: string, term: Term): number => {
  return calculateMatchingScore(
    searchString.toLowerCase(),
    [...term.prefLabels, ...term.altLabels].map(literal => literal.value)
  );
};

export const calculateMatchingScore = (
  searchString: string,
  againstStrings: string[]
): number => {
  const normalizedSearchString = normalize(searchString);
  const scores = againstStrings.map(againstString =>
    cosine.similarity(normalizedSearchString, normalize(againstString))
  );
  const maxScore = Math.max(...scores);

  return Math.round((maxScore + Number.EPSILON) * 10000) / 100; // Return percentage match rounded to two decimals.
};

const normalize = (string: string) => string.replace(/[,.]/g, '');
