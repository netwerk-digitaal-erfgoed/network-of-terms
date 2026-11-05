import { describe, expect, it } from 'vitest';
import {
  Entity,
  OccupationRole,
  RelatedTerm,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { BlankNode, Literal, NamedNode } from '@rdfjs/types';
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

  it('names places the source identifies apart, even by the same name', () => {
    expect(
      entityNames(
        [
          new Entity(iri('https://example.com/places/bergen-nl'), [
            name('Bergen', 'nl'),
          ]),
          new Entity(iri('https://example.com/places/bergen-no'), [
            name('Bergen', 'nl'),
          ]),
          new Entity(iri('https://example.com/places/bergen-nl'), [
            name('Bergen', 'nl'),
          ]),
        ],
        'nl',
      ),
    ).toEqual(['Bergen', 'Bergen']);
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

  it('keeps the names of a role in another language than the requested one', () => {
    expect(
      occupationNames(
        [
          new OccupationRole(
            painter,
            [name('hofschilder', 'nl')],
            undefined,
            undefined,
          ),
          new OccupationRole(
            undefined,
            [name('schilder', 'nl')],
            undefined,
            undefined,
          ),
        ],
        'en',
      ),
    ).toEqual(['painter', 'hofschilder']);
  });

  it('names an occupation its vocabulary does not name by the role', () => {
    const unnamed = new RelatedTerm(
      iri('https://example.com/occupations/123'),
      [],
    );
    expect(
      occupationNames(
        [
          new OccupationRole(
            unnamed,
            [name('hofschilder', 'nl')],
            undefined,
            undefined,
          ),
        ],
        'nl',
      ),
    ).toEqual(['hofschilder']);
    expect(
      occupationNames(
        [new OccupationRole(unnamed, [], undefined, undefined)],
        'nl',
      ),
    ).toEqual(['https://example.com/occupations/123']);
  });

  it('names an occupation that is not an IRI by its names only', () => {
    const blankNode = { termType: 'BlankNode', value: 'b0_occupation' };
    expect(
      occupationNames(
        [
          new OccupationRole(
            new RelatedTerm(blankNode as BlankNode, []),
            [],
            undefined,
            undefined,
          ),
          new OccupationRole(
            new RelatedTerm(blankNode as BlankNode, [name('etser', 'nl')]),
            [],
            undefined,
            undefined,
          ),
        ],
        'nl',
      ),
    ).toEqual(['etser']);
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

  it('prefers no English name when none is in the requested language', () => {
    expect(
      personalNames([name('Jan', 'nl'), name('John', 'en')], 'fr'),
    ).toEqual(['Jan', 'John']);
  });
});
