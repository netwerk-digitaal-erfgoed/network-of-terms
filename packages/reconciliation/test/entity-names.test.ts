import { describe, expect, it } from 'vitest';
import {
  Entity,
  OccupationRole,
  RelatedTerm,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { Literal, NamedNode } from '@rdfjs/types';
import {
  entityNames,
  occupationNames,
  personalNames,
} from '../src/entity-names.js';

const name = (value: string, language: string) =>
  ({ termType: 'Literal', value, language }) as Literal;

const iri = (value: string) => ({ termType: 'NamedNode', value }) as NamedNode;

describe('Entity names', () => {
  it('names the places a source only names in the requested language', () => {
    expect(
      entityNames(
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
      entityNames(
        [new Entity(undefined, [name('Amsterdam (city)', 'en')])],
        'nl',
      ),
    ).toEqual(['Amsterdam (city)']);
  });

  it('names an identified place in English beside a place named in the requested language', () => {
    expect(
      entityNames(
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
      entityNames(
        [new Entity(iri('https://example.com/places/leiden'), [])],
        'nl',
      ),
    ).toEqual(['https://example.com/places/leiden']);
  });

  it('names a place the source states twice once', () => {
    expect(
      entityNames(
        [
          new Entity(undefined, [name('Leiden', 'nl')]),
          new Entity(undefined, [name('Leiden', 'nl')]),
        ],
        'nl',
      ),
    ).toEqual(['Leiden']);
  });
});

describe('Occupation names', () => {
  const painter = new RelatedTerm(iri('https://example.com/painter'), [
    name('schilder', 'nl'),
    name('painter', 'en'),
  ]);

  it('names an occupation held in several periods once', () => {
    expect(
      occupationNames(
        [
          new OccupationRole(painter, [], '1625', '1640'),
          new OccupationRole(painter, [], '1650', '1669'),
          new OccupationRole(
            undefined,
            [name('schilder', 'nl')],
            '1625',
            '1669',
          ),
        ],
        'nl',
      ),
    ).toEqual(['schilder']);
  });

  it('names both the occupation and the role the source names', () => {
    expect(
      occupationNames(
        [
          new OccupationRole(
            painter,
            [name('hofschilder', 'nl')],
            undefined,
            undefined,
          ),
        ],
        'nl',
      ),
    ).toEqual(['schilder', 'hofschilder']);
  });
});

describe('Personal names', () => {
  it('returns names in the requested language', () => {
    expect(
      personalNames([name('Jan', 'nl'), name('John', 'en')], 'nl'),
    ).toEqual(['Jan']);
  });

  it('returns names in another language when none is in the requested one', () => {
    expect(personalNames([name('Jan', 'nl')], 'en')).toEqual(['Jan']);
  });
});
