import {
  isOrganizationClass,
  isPersonClass,
  isPlaceClass,
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

export const placeType: ReconciliationType = {
  id: 'https://schema.org/Place',
  name: 'Place',
};

export const organizationType: ReconciliationType = {
  id: 'https://schema.org/Organization',
  name: 'Organization',
};

/**
 * The reconciliation types of a term: every term is a concept, and a term the source types as a
 * Schema.org person, place or organization is one of those too. Clients such as OpenRefine guess
 * the type to reconcile against from the types of the candidates, so a source of persons gets
 * Person suggested without the manifest naming it: few sources the catalog files under persons
 * type their terms so. The specific type comes first, because OpenRefine weighs a candidate’s first
 * type most, and would otherwise suggest Concept for a column of persons.
 */
export const termTypes = (term: Term) => [
  ...specificTypes
    .filter(({ isClass }) => term.types.some(isClass))
    .map(({ type }) => type),
  conceptType,
];

export const isPerson = (term: Term) => termTypes(term).includes(personType);

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
  const requested = (Array.isArray(type) ? type : [type]).filter(
    (id) => id !== '',
  );
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

// The types more specific than a concept, each with the Schema.org class that makes a term one. A
// kind of term the query package describes becomes a reconciliation type by adding it here.
const specificTypes = [
  { type: personType, isClass: isPersonClass },
  { type: placeType, isClass: isPlaceClass },
  { type: organizationType, isClass: isOrganizationClass },
];
