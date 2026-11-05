import {
  IRI,
  literalValues,
  LookupService,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { entityNames, occupationNames, personalNames } from './entity-names.js';
import { conceptType, personType } from './types.js';

export type DataExtensionQuery = {
  ids: string[];
  properties: { id: string }[];
};

export const dataExtensionProperties: {
  id: DataExtensionPropertyId;
  name: string;
  type?: { id: string; name: string };
}[] = [
  {
    id: 'prefLabels',
    name: 'prefLabels',
  },
  {
    id: 'altLabels',
    name: 'altLabels',
  },
  {
    id: 'scopeNotes',
    name: 'scopeNotes',
  },
  // What the source states about the person a term denotes; empty for any other term.
  {
    id: 'birthDates',
    name: 'birthDates',
  },
  {
    id: 'deathDates',
    name: 'deathDates',
  },
  {
    id: 'birthPlaces',
    name: 'birthPlaces',
  },
  {
    id: 'deathPlaces',
    name: 'deathPlaces',
  },
  {
    id: 'genders',
    name: 'genders',
  },
  {
    id: 'givenNames',
    name: 'givenNames',
  },
  {
    id: 'familyNames',
    name: 'familyNames',
  },
  {
    id: 'occupations',
    name: 'occupations',
  },
  {
    id: 'nationalities',
    name: 'nationalities',
  },
  // Family members are persons in the same source, so entities as related terms are, of the person
  // type, so that OpenRefine proposes a person’s properties again for a column of them.
  {
    id: 'parents',
    name: 'parents',
    type: personType,
  },
  {
    id: 'children',
    name: 'children',
    type: personType,
  },
  {
    id: 'spouses',
    name: 'spouses',
    type: personType,
  },
  {
    id: 'siblings',
    name: 'siblings',
    type: personType,
  },
  // Terms in the same source, as entities a client can keep reconciled, so far as the source names them.
  {
    id: 'broaderTerms',
    name: 'broaderTerms',
    // The type the service manifest declares, so that OpenRefine gives a column of related terms
    // the same expected type as the column they were extended from.
    type: conceptType,
  },
  {
    id: 'narrowerTerms',
    name: 'narrowerTerms',
    type: conceptType,
  },
  {
    id: 'relatedTerms',
    name: 'relatedTerms',
    type: conceptType,
  },
  // IRIs in other sources, such as ULAN, VIAF or Wikidata, so as strings rather than entities.
  {
    id: 'exactMatches',
    name: 'exactMatches',
  },
  // Web pages about the term, such as the records a person reconstruction was derived from.
  {
    id: 'seeAlso',
    name: 'seeAlso',
  },
];

/**
 * The properties to propose for a column reconciled against a type. Sources seldom place persons
 * in a hierarchy, so a person column is not offered broader and narrower terms, which would nearly
 * always be empty; a column reconciled against Concept still is. Any other column may hold
 * persons, since every person is a concept too, so it gets every property.
 */
export const proposedProperties = (type: string | undefined) =>
  type === personType.id
    ? dataExtensionProperties.filter(
        (property) => !hierarchyProperties.includes(property.id),
      )
    : dataExtensionProperties;

const hierarchyProperties: DataExtensionPropertyId[] = [
  'broaderTerms',
  'narrowerTerms',
];

export async function extendQuery(
  terms: IRI[],
  requestedProperties: { id: string }[],
  lookupService: LookupService,
  language: string,
) {
  // Clients build a column per property in the response, so it holds only those asked for.
  const properties = dataExtensionProperties.filter((property) =>
    requestedProperties.some((requested) => requested.id === property.id),
  );
  const lookupResults = (await lookupService.lookup(terms, 10000)).filter(
    (lookupResult) => lookupResult.result instanceof Term,
  );

  const futureSpecResult = {
    meta: properties,
    rows: lookupResults.map((lookupResult) => ({
      id: lookupResult.uri.toString(),
      properties: properties.map((property) => ({
        id: property.id,
        values: propertyValues[property.id](
          lookupResult.result as Term,
          language,
        ),
      })),
    })),
  };

  return downcastToReconciliationSpecV0_2(futureSpecResult);
}

type DataExtensionPropertyId =
  | 'prefLabels'
  | 'altLabels'
  | 'scopeNotes'
  | 'birthDates'
  | 'deathDates'
  | 'birthPlaces'
  | 'deathPlaces'
  | 'genders'
  | 'givenNames'
  | 'familyNames'
  | 'occupations'
  | 'nationalities'
  | 'parents'
  | 'children'
  | 'spouses'
  | 'siblings'
  | 'broaderTerms'
  | 'narrowerTerms'
  | 'relatedTerms'
  | 'exactMatches'
  | 'seeAlso';

const propertyValues: Record<
  DataExtensionPropertyId,
  (term: Term, language: string) => DataExtensionValue[]
> = {
  prefLabels: (term, language) =>
    strings(literalValues(term.prefLabels, [language])),
  altLabels: (term, language) =>
    strings(literalValues(term.altLabels, [language])),
  scopeNotes: (term, language) =>
    strings(literalValues(term.scopeNotes, [language])),
  birthDates: (term) => strings(term.person?.birthDates ?? []),
  deathDates: (term) => strings(term.person?.deathDates ?? []),
  birthPlaces: (term, language) =>
    strings(entityNames(term.person?.birthPlaces ?? [], language)),
  deathPlaces: (term, language) =>
    strings(entityNames(term.person?.deathPlaces ?? [], language)),
  // Male and female carry no names, so they are their IRIs.
  genders: (term, language) =>
    strings(entityNames(term.person?.genders ?? [], language)),
  givenNames: (term, language) =>
    strings(personalNames(term.person?.givenNames ?? [], language)),
  familyNames: (term, language) =>
    strings(personalNames(term.person?.familyNames ?? [], language)),
  occupations: (term, language) =>
    strings(occupationNames(term.person?.occupations ?? [], language)),
  nationalities: (term, language) =>
    strings(entityNames(term.person?.nationalities ?? [], language)),
  parents: (term, language) => entities(term.person?.parents ?? [], language),
  children: (term, language) => entities(term.person?.children ?? [], language),
  spouses: (term, language) => entities(term.person?.spouses ?? [], language),
  siblings: (term, language) => entities(term.person?.siblings ?? [], language),
  broaderTerms: (term, language) => entities(term.broaderTerms, language),
  narrowerTerms: (term, language) => entities(term.narrowerTerms, language),
  relatedTerms: (term, language) => entities(term.relatedTerms, language),
  exactMatches: (term) =>
    strings(term.exactMatches.map((exactMatch) => exactMatch.id.value)),
  seeAlso: (term) => strings(term.seeAlso.map((page) => page.value)),
};

const strings = (values: string[]) => values.map((value) => ({ str: value }));

// A term the source names is one it holds, so it is an entity, named in the client’s language where
// it can be. A term without a name may be in another vocabulary, or cut off by the query limit, so
// it stays an IRI that a client can reconcile itself.
const entities = (terms: RelatedTerm[], language: string) =>
  terms.map((term) =>
    term.prefLabels.length === 0
      ? { str: term.id.value }
      : {
          id: term.id.value,
          name:
            literalValues(term.prefLabels, [language])[0] ??
            term.prefLabels[0].value,
        },
  );

const downcastToReconciliationSpecV0_2 = (
  futureSpecResult: DataExtensionResult,
) => ({
  meta: futureSpecResult.meta,
  rows: futureSpecResult.rows.reduce(
    (
      acc: { [key: string]: { [key: string]: DataExtensionValue[] } },
      current,
    ) => {
      acc[current.id] = current.properties.reduce(
        (acc: { [key: string]: DataExtensionValue[] }, current) => {
          acc[current.id] = current.values;
          return acc;
        },
        {},
      );
      return acc;
    },
    {},
  ),
});

export type DataExtensionResult = {
  meta: { id: string; name: string; type?: { id: string; name: string } }[];
  rows: {
    id: string;
    properties: {
      id: string;
      values: DataExtensionValue[];
    }[];
  }[];
};

// A literal value, or an entity in the same source, per the Reconciliation Service API.
export type DataExtensionValue = { str: string } | { id: string; name: string };
