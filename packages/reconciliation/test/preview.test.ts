import { describe, expect, it } from 'vitest';
import {
  Dataset,
  Entity,
  LookupQueryResult,
  Person,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { Literal, NamedNode, Term as RdfTerm } from '@rdfjs/types';
import { preview } from '../src/preview.js';
import nl from '../locales/nl.json' with { type: 'json' };

const iri = (value: string) =>
  ({
    termType: 'NamedNode',
    value,
    equals: (other: RdfTerm | null | undefined) => other?.value === value,
  }) as NamedNode;

const name = (value: string) =>
  ({ termType: 'Literal', value, language: 'nl' }) as Literal;

const source = {
  name: { nl: 'Personen' },
  creators: [{ alternateName: { nl: 'NDE' } }],
} as unknown as Dataset;

describe('Preview', () => {
  it('shows a related term of a person only when it is not family', () => {
    const spouse = new RelatedTerm(iri('https://example.com/spouse'), [
      name('Grietje Jans'),
    ]);
    const friend = new RelatedTerm(iri('https://example.com/friend'), [
      name('Pieter Claesz'),
    ]);
    const guild = new RelatedTerm(iri('https://example.com/guild'), [
      name('Sint-Lucasgilde'),
    ]);
    const person = new Term(
      iri('https://example.com/person'),
      [iri('https://schema.org/Person')],
      [name('Jan de Vries')],
      [],
      [],
      [],
      [],
      [guild],
      [],
      [spouse, friend],
      [],
      undefined,
      undefined,
      undefined,
      new Person(
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        // A gender the source states as a literal is named in the client’s language.
        [new Entity(undefined, [name('v')])],
        [],
        [],
        [spouse],
        [],
      ),
    );

    const html = preview(
      { result: person } as unknown as LookupQueryResult,
      source,
      nl,
      'nl',
      '{+uri}',
    );

    expect(html).toMatch(
      new RegExp('<dt>Echtgeno\\(o\\)t\\(e\\)</dt>\\s*<dd>Grietje Jans</dd>'),
    );
    expect(html).toMatch(
      new RegExp('<dt>Gerelateerde termen</dt>\\s*<dd>Pieter Claesz</dd>'),
    );
    expect(html).toMatch(new RegExp('<dt>Gender</dt>\\s*<dd>vrouw</dd>'));
    expect(html).toMatch(
      new RegExp('<dt>Bredere termen</dt>\\s*<dd>Sint-Lucasgilde</dd>'),
    );
    expect(html).toContain('<html lang="nl">');
  });
});
