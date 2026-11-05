import {
  isPersonClass,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export type ReconciliationType = { id: string; name: string };

export const conceptType: ReconciliationType = {
  id: 'http://www.w3.org/2004/02/skos/core#Concept',
  name: 'Concept',
};

export const personType: ReconciliationType = {
  id: 'https://schema.org/Person',
  name: 'Person',
};

/**
 * The reconciliation types of a term: every term is a concept, and a term the source types as a
 * Schema.org person is a person too. Clients such as OpenRefine guess the type to reconcile
 * against from the types of the candidates, so a source of persons gets Person suggested without
 * the manifest naming it: few sources the catalog files under persons type their terms so.
 */
export const termTypes = (term: Term) =>
  isPerson(term) ? [conceptType, personType] : [conceptType];

export const isPerson = (term: Term) => term.types.some(isPersonClass);

/**
 * Whether a client reconciles against persons, with the type in either Schema.org namespace.
 */
export const isPersonType = (type: string | undefined) =>
  type !== undefined && normalisedType(type) === personType.id;

/**
 * Which of a term’s types a client accepts: any of the types it reconciles against, or all of them
 * with `type_strict` ‘all’. Undefined when every term is accepted: when the client names no type,
 * or an empty one, when the types are only a preference (‘should’), which the score does not
 * weigh, or when a concept satisfies them, since every term is a concept.
 */
export const typeFilter = (
  type: string | string[] = [],
  strict: 'any' | 'should' | 'all' = 'any',
) => {
  const requested = (Array.isArray(type) ? type : [type])
    .filter((id) => id !== '')
    .map(normalisedType);
  const restrictive = requested.filter((id) => id !== conceptType.id);
  if (
    strict === 'should' ||
    restrictive.length === 0 ||
    (strict === 'any' && restrictive.length < requested.length)
  ) {
    return undefined;
  }

  return (types: ReconciliationType[]) => {
    const isOfType = (id: string) => types.some((type) => type.id === id);
    return strict === 'all'
      ? restrictive.every(isOfType)
      : restrictive.some(isOfType);
  };
};

// Sources and clients state Schema.org types in either namespace.
const normalisedType = (type: string) =>
  type.replace(/^http:\/\/schema\.org\//, 'https://schema.org/');
