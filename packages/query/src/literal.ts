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

  // ‘mul’ literals (Wikidata’s default for all languages) are valid in every language,
  // so return them in the client’s most preferred language.
  const mulLiterals = literals.filter((literal) => literal.language === 'mul');
  if (mulLiterals.length > 0 && languages.length > 0) {
    return mulLiterals.map((literal) =>
      dataFactory.literal(literal.value, languages[0]),
    );
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
