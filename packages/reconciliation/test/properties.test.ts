import { describe, expect, it } from 'vitest';
import {
  Entity,
  OccupationRole,
  Person,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { Literal, NamedNode } from '@rdfjs/types';
import {
  compareProperties,
  ReconciliationQueryProperty,
} from '../src/properties.js';

describe('Property comparison', () => {
  it('matches a birth year with a full birth date, and the other way round', () => {
    const term = personTerm({ birthDates: ['1851-03-02'] });
    expect(compare(term, { pid: 'birthDate', v: '1851' })).toEqual(1);
    expect(compare(term, { pid: 'birthDate', v: 1851 })).toEqual(1);
    expect(
      compare(personTerm({ birthDates: ['1851'] }), {
        pid: 'birthDate',
        v: '1851-03-02',
      }),
    ).toEqual(1);
  });

  it('matches a date within an interval or an unspecified decade', () => {
    expect(
      compare(personTerm({ birthDates: ['1606-07-15/1607'] }), {
        pid: 'birthDate',
        v: '1607',
      }),
    ).toEqual(1);
    expect(
      compare(personTerm({ deathDates: ['185X'] }), {
        pid: 'deathDate',
        v: '1857-01-01',
      }),
    ).toEqual(1);
  });

  it('reads the date-time OpenRefine sends for a date column as the day it means', () => {
    expect(
      compare(personTerm({ birthDates: ['1851-03-02'] }), {
        pid: 'birthDate',
        v: '1851-03-02T00:00:00Z',
      }),
    ).toEqual(1);
    // Parsed in Dutch time, 2 March is sent as 23:00 UTC on 1 March.
    expect(
      compare(personTerm({ birthDates: ['1851-03-02'] }), {
        pid: 'birthDate',
        v: '1851-03-01T23:00:00Z',
      }),
    ).toEqual(1);
    expect(
      comparisons(personTerm({ birthDates: ['1851-03-02'] }), {
        pid: 'birthDate',
        v: '1851-13-01T00:00:00Z',
      }),
    ).toEqual([]);
  });

  it('counts a date a year off as half a match, and further off as a contradiction', () => {
    const term = personTerm({ birthDates: ['1851'] });
    expect(compare(term, { pid: 'birthDate', v: '1852-01-01' })).toEqual(0.5);
    expect(compare(term, { pid: 'birthDate', v: '1843' })).toEqual(0);
  });

  it('takes the best of several dates, sent or stated', () => {
    expect(
      compare(personTerm({ birthDates: ['1843', '1851'] }), {
        pid: 'birthDate',
        v: ['1700', '1851'],
      }),
    ).toEqual(1);
  });

  it('knows nothing about a candidate whose source states no date it can read', () => {
    expect(
      comparisons(personTerm({ birthDates: ['unknown', '../1700'] }), {
        pid: 'birthDate',
        v: '1851',
      }),
    ).toEqual([{ id: 'birthDate', value: undefined }]);
    expect(comparisons(nonPersonTerm, { pid: 'birthDate', v: '1851' })).toEqual(
      [{ id: 'birthDate', value: undefined }],
    );
  });

  it('leaves out properties it does not know and values it cannot read', () => {
    const term = personTerm({ birthDates: ['1851'] });
    expect(
      comparisons(
        term,
        { pid: 'P569', v: '1851' },
        { pid: 'birthDate', v: 'not a date' },
        { pid: 'birthDate', v: [true, '', { id: '' }] },
        { pid: 'deathDate', v: { id: 'https://example.com/date' } },
        { pid: 'givenName', v: { id: 'https://example.com/name', name: ' ' } },
      ),
    ).toEqual([]);
  });

  it('compares names with the source’s names', () => {
    const term = personTerm({ givenNames: ['Jan'], familyNames: ['Jansen'] });
    expect(compare(term, { pid: 'givenName', v: 'jan' })).toEqual(1);
    expect(compare(term, { pid: 'familyName', v: 'Janssen' })).toBeGreaterThan(
      0.5,
    );
    expect(compare(term, { pid: 'familyName', v: 'Pietersen' })).toBeLessThan(
      0.5,
    );
    expect(comparisons(personTerm({}), { pid: 'givenName', v: 'Jan' })).toEqual(
      [{ id: 'givenName', value: undefined }],
    );
  });

  it('matches a place by IRI, or by name without the source’s qualifier', () => {
    const term = personTerm({
      birthPlaces: [new Entity(iri(leiden), [name('Leiden (stad)', 'nl')])],
      deathPlaces: [new Entity(undefined, [name('Amsterdam (stad)', 'nl')])],
    });
    expect(compare(term, { pid: 'birthPlace', v: { id: leiden } })).toEqual(1);
    expect(compare(term, { pid: 'birthPlace', v: 'Leiden' })).toEqual(1);
    expect(compare(term, { pid: 'deathPlace', v: 'Amsterdam' })).toEqual(1);
  });

  it('contradicts a place the source identifies by another IRI, unless the name matches', () => {
    const term = personTerm({
      birthPlaces: [new Entity(iri(leiden), [])],
      deathPlaces: [new Entity(undefined, [name('Amsterdam (stad)', 'nl')])],
    });
    expect(
      compare(term, {
        pid: 'birthPlace',
        v: { id: 'https://example.com/gouda' },
      }),
    ).toEqual(0);
    expect(
      compare(term, {
        pid: 'deathPlace',
        v: { id: 'https://example.com/amsterdam', name: 'Amsterdam' },
      }),
    ).toEqual(1);
    // The source only names the place, so an IRI alone says nothing about it.
    expect(
      comparisons(term, {
        pid: 'deathPlace',
        v: { id: 'https://example.com/amsterdam' },
      }),
    ).toEqual([{ id: 'deathPlace', value: undefined }]);
  });

  it('reads a source’s gender literal as Schema.org’s', () => {
    const term = personTerm({
      genders: [new Entity(undefined, [name('Vrouw', 'nl')])],
    });
    expect(compare(term, { pid: 'gender', v: 'female' })).toEqual(1);
    expect(
      compare(term, { pid: 'gender', v: { id: 'https://schema.org/Male' } }),
    ).toEqual(0);
  });

  it('reads the client’s gender as Schema.org’s', () => {
    const term = personTerm({
      genders: [new Entity(iri('https://schema.org/Male'), [])],
    });
    expect(compare(term, { pid: 'gender', v: 'man' })).toEqual(1);
    expect(compare(term, { pid: 'gender', v: 'M' })).toEqual(1);
    expect(
      compare(term, { pid: 'gender', v: { id: 'http://schema.org/Male' } }),
    ).toEqual(1);
    expect(compare(term, { pid: 'gender', v: 'vrouw' })).toEqual(0);
    expect(
      compare(
        personTerm({
          genders: [new Entity(undefined, [name('non-binary', 'en')])],
        }),
        { pid: 'gender', v: 'Non-binary' },
      ),
    ).toEqual(1);
  });

  it('matches an occupation by IRI or by the name of the occupation or role', () => {
    const term = personTerm({
      occupations: [
        new OccupationRole(
          new RelatedTerm(iri(painter), [name('schilder', 'nl')]),
          [],
          undefined,
          undefined,
        ),
        new OccupationRole(undefined, [name('etser', 'nl')], '1625', '1669'),
      ],
    });
    expect(compare(term, { pid: 'hasOccupation', v: { id: painter } })).toEqual(
      1,
    );
    expect(compare(term, { pid: 'hasOccupation', v: 'Schilder' })).toEqual(1);
    expect(compare(term, { pid: 'hasOccupation', v: 'etser' })).toEqual(1);
    expect(
      comparisons(nonPersonTerm, { pid: 'hasOccupation', v: 'schilder' }),
    ).toEqual([{ id: 'hasOccupation', value: undefined }]);
  });

  it('matches a nationality and relatives', () => {
    const term = personTerm({
      nationalities: [new Entity(undefined, [name('Nederlands', 'nl')])],
      parents: [new RelatedTerm(iri(father), [name('Pieter Jansen', 'nl')])],
      children: [new RelatedTerm(iri(child), [])],
      spouses: [new RelatedTerm(iri(wife), [name('Maria de Vries', 'nl')])],
      siblings: [new RelatedTerm(iri(brother), [name('Klaas Jansen', 'nl')])],
    });
    expect(compare(term, { pid: 'nationality', v: 'Nederlands' })).toEqual(1);
    expect(compare(term, { pid: 'parent', v: { id: father } })).toEqual(1);
    expect(compare(term, { pid: 'children', v: { id: child } })).toEqual(1);
    expect(compare(term, { pid: 'spouse', v: 'Maria de Vries' })).toEqual(1);
    expect(compare(term, { pid: 'sibling', v: { id: wife } })).toEqual(0);
    expect(
      comparisons(personTerm({}), { pid: 'birthPlace', v: 'Leiden' }),
    ).toEqual([{ id: 'birthPlace', value: undefined }]);
  });
});

const leiden = 'https://example.com/places/leiden';
const painter = 'https://example.com/occupations/painter';
const father = 'https://example.com/persons/father';
const child = 'https://example.com/persons/child';
const wife = 'https://example.com/persons/wife';
const brother = 'https://example.com/persons/brother';

const comparisons = (
  term: Term,
  ...properties: ReconciliationQueryProperty[]
) => compareProperties(term, properties);

const compare = (term: Term, property: ReconciliationQueryProperty) =>
  compareProperties(term, [property])[0]?.value;

const name = (value: string, language: string) =>
  ({ termType: 'Literal', value, language }) as Literal;

const iri = (value: string) => ({ termType: 'NamedNode', value }) as NamedNode;

const personTerm = ({
  givenNames = [],
  familyNames = [],
  birthDates = [],
  deathDates = [],
  birthPlaces = [],
  deathPlaces = [],
  occupations = [],
  nationalities = [],
  genders = [],
  parents = [],
  children = [],
  spouses = [],
  siblings = [],
}: {
  givenNames?: string[];
  familyNames?: string[];
  birthDates?: string[];
  deathDates?: string[];
  birthPlaces?: Entity[];
  deathPlaces?: Entity[];
  occupations?: OccupationRole[];
  nationalities?: Entity[];
  genders?: Entity[];
  parents?: RelatedTerm[];
  children?: RelatedTerm[];
  spouses?: RelatedTerm[];
  siblings?: RelatedTerm[];
}) =>
  term(
    new Person(
      givenNames.map((value) => name(value, '')),
      familyNames.map((value) => name(value, '')),
      birthDates,
      deathDates,
      birthPlaces,
      deathPlaces,
      occupations,
      nationalities,
      genders,
      parents,
      children,
      spouses,
      siblings,
    ),
  );

const term = (person: Person | undefined) =>
  new Term(
    iri('https://example.com/persons/jan-jansen'),
    [],
    [name('Jan Jansen', 'nl')],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    undefined,
    person,
  );

const nonPersonTerm = term(undefined);
