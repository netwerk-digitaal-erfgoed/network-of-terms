import { describe, expect, it } from 'vitest';
import { Entity } from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { Literal, NamedNode } from '@rdfjs/types';
import { placeNames } from '../src/place-names.js';

const name = (value: string, language: string) =>
  ({ termType: 'Literal', value, language }) as Literal;

const iri = (value: string) => ({ termType: 'NamedNode', value }) as NamedNode;

describe('Place names', () => {
  it('names the places a source only names in the requested language', () => {
    expect(
      placeNames(
        [
          new Entity(undefined, [name('Amsterdam (stad)', 'nl')]),
          new Entity(undefined, [name('Amsterdam (city)', 'en')]),
        ],
        'nl',
      ),
    ).toEqual(['Amsterdam (stad)']);
  });

  it('falls back to English when no place has a name in the requested language', () => {
    expect(
      placeNames(
        [new Entity(undefined, [name('Amsterdam (city)', 'en')])],
        'nl',
      ),
    ).toEqual(['Amsterdam (city)']);
  });

  it('names an identified place in English beside a place named in the requested language', () => {
    expect(
      placeNames(
        [
          new Entity(iri('https://example.com/places/leiden'), [
            name('Leiden', 'en'),
          ]),
          new Entity(undefined, [name('Leiderdorp', 'nl')]),
        ],
        'nl',
      ),
    ).toEqual(['Leiden', 'Leiderdorp']);
  });

  it('shows an identified place that the source does not name by its IRI', () => {
    expect(
      placeNames(
        [new Entity(iri('https://example.com/places/leiden'), [])],
        'nl',
      ),
    ).toEqual(['https://example.com/places/leiden']);
  });
});
