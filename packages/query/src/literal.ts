import * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';

const dataFactory = new DataFactory();

export function filterLiteralsByLanguage(
  literals: RDF.Literal[],
  languages: string[],
) {
  const preferredLanguageLiterals = literals.filter((literal) =>
    languages.includes(literal.language),
  );
  if (preferredLanguageLiterals.length > 0) {
    return preferredLanguageLiterals;
  }

  // If literal has no language tag, we assume it is in the Network of Terms’ default language, Dutch.
  return literals
    .filter((literal) => literal.language === '')
    .map((literal) => dataFactory.literal(literal.value, 'nl'));
}

/**
 * Return value from {@link Literal} in the given languages.
 *
 * @param literals
 * @param languages
 */
export function literalValues(
  literals: RDF.Literal[],
  languages: string[] = ['nl'],
) {
  const languageLiterals = filterLiteralsByLanguage(literals, languages);
  if (languageLiterals.length > 0) {
    return languageLiterals.map((literal) => literal.value);
  }

  // Fall back to English for sources that provide no Dutch labels.
  return filterLiteralsByLanguage(literals, ['en']).map(
    (literal) => literal.value,
  );
}
