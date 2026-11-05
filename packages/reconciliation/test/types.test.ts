import { describe, expect, it } from 'vitest';
import {
  conceptType,
  isPersonType,
  personType,
  typeFilter,
} from '../src/types.js';

const concept = [conceptType];
const person = [conceptType, personType];

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

  it('accepts Person in the http namespace of Schema.org', () => {
    expect(accepts('http://schema.org/Person')(concept)).toBe(false);
    expect(accepts('http://schema.org/Person')(person)).toBe(true);
    expect(isPersonType('http://schema.org/Person')).toBe(true);
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
