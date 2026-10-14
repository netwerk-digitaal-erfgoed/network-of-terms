import {
  IRI,
  literalValues,
  LookupService,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { entityNames } from './entity-names.js';
import { conceptType } from './manifest.js';

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
  | 'broaderTerms'
  | 'narrowerTerms'
  | 'relatedTerms'
  | 'exactMatches';

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
  broaderTerms: (term, language) => entities(term.broaderTerms, language),
  narrowerTerms: (term, language) => entities(term.narrowerTerms, language),
  relatedTerms: (term, language) => entities(term.relatedTerms, language),
  exactMatches: (term) =>
    strings(term.exactMatches.map((exactMatch) => exactMatch.id.value)),
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
