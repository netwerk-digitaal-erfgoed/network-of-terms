import { describe, expect, it } from 'vitest';
import { Term } from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { NamedNode } from '@rdfjs/types';
import {
  conceptType,
  organizationType,
  personType,
  placeType,
  termTypes,
  typeFilter,
} from '../src/types.js';

const iri = (value: string) => ({ termType: 'NamedNode', value }) as NamedNode;

// A term the source types with these classes, and states nothing else about.
const typedTerm = (...classes: string[]) =>
  new Term(
    iri('https://example.com/term'),
    classes.map(iri),
    [],
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
  );

describe('Term types', () => {
  it('makes every term a concept', () => {
    expect(
      termTypes(typedTerm('http://www.w3.org/2004/02/skos/core#Concept')),
    ).toEqual([conceptType]);
    expect(termTypes(typedTerm())).toEqual([conceptType]);
  });

  it('puts the Schema.org class the source types a term with first, in either namespace', () => {
    expect(termTypes(typedTerm('https://schema.org/Person'))).toEqual([
      personType,
      conceptType,
    ]);
    expect(termTypes(typedTerm('http://schema.org/Place'))).toEqual([
      placeType,
      conceptType,
    ]);
    expect(termTypes(typedTerm('https://schema.org/Organization'))).toEqual([
      organizationType,
      conceptType,
    ]);
  });
});

const concept = [conceptType];
const person = [personType, conceptType];

// Whether a term of these types is a candidate for a query of the type sent.
const accepts = (
  type: string | string[],
  strict?: 'any' | 'should' | 'all',
) => {
  const ofType = typeFilter(type, strict);
  return (types: typeof person) => ofType?.(types) ?? true;
};

describe('Type filter', () => {
  it('accepts every term when the client names no type, or an empty one', () => {
    expect(typeFilter()).toBeUndefined();
    expect(typeFilter('')).toBeUndefined();
    expect(typeFilter([])).toBeUndefined();
  });

  it('accepts every term when the types are only a preference', () => {
    expect(typeFilter(personType.id, 'should')).toBeUndefined();
  });

  it('accepts every term when a concept satisfies the types', () => {
    expect(typeFilter(conceptType.id)).toBeUndefined();
    expect(typeFilter([conceptType.id, personType.id])).toBeUndefined();
  });

  it('accepts only persons when the client reconciles against them', () => {
    const ofType = accepts(personType.id);
    expect(ofType(person)).toBe(true);
    expect(ofType(concept)).toBe(false);
  });

  it('accepts only terms of all types with type_strict all', () => {
    const ofType = accepts([conceptType.id, personType.id], 'all');
    expect(ofType(person)).toBe(true);
    expect(ofType(concept)).toBe(false);
  });

  it('accepts no term of a type no term has', () => {
    expect(accepts('https://example.com/Unknown')(person)).toBe(false);
  });
});
