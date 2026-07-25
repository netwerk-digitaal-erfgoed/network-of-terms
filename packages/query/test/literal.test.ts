import { filterLiteralsByLanguage, literalValues } from '../src/index.js';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, it } from 'vitest';

const dataFactory = new DataFactory();

describe('filterLiteralsByLanguage', () => {
  it('falls back to mul literals, re-tagged as the requested language, when no literal matches the requested languages', () => {
    // Wikidata uses the ‘mul’ language code for labels that apply to all languages;
    // see https://www.wikidata.org/wiki/Help:Default_values_for_labels_and_aliases.
    const literals = [dataFactory.literal('Marion Michelle Koblitz', 'mul')];

    expect(filterLiteralsByLanguage(literals, ['nl'])).toEqual([
      dataFactory.literal('Marion Michelle Koblitz', 'nl'),
    ]);
  });

  it('re-tags mul literals as the first of multiple requested languages', () => {
    const literals = [dataFactory.literal('Marion Michelle Koblitz', 'mul')];

    expect(filterLiteralsByLanguage(literals, ['en', 'nl'])).toEqual([
      dataFactory.literal('Marion Michelle Koblitz', 'en'),
    ]);
  });

  it('prefers labels in requested languages over mul labels, preventing duplicates', () => {
    const literals = [
      dataFactory.literal('Feest', 'nl'),
      dataFactory.literal('Fest', 'mul'),
    ];

    expect(filterLiteralsByLanguage(literals, ['nl'])).toEqual([
      dataFactory.literal('Feest', 'nl'),
    ]);
  });
});

describe('literalValues', () => {
  it('returns mul label values for terms that have labels in none of the requested languages', () => {
    const literals = [dataFactory.literal('Marion Michelle Koblitz', 'mul')];

    expect(literalValues(literals)).toEqual(['Marion Michelle Koblitz']);
  });
});
