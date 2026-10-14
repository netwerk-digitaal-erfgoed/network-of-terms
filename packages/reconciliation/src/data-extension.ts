import {
  IRI,
  literalValues,
  LookupService,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { entityNames } from './entity-names.js';

export type DataExtensionQuery = {
  ids: string[];
  properties: { id: string }[];
};

export const dataExtensionProperties: {
  id: DataExtensionPropertyId;
  name: string;
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
];

export async function extendQuery(
  terms: IRI[],
  lookupService: LookupService,
  language: string,
) {
  const lookupResults = (await lookupService.lookup(terms, 10000)).filter(
    (lookupResult) => lookupResult.result instanceof Term,
  );

  const futureSpecResult = {
    meta: dataExtensionProperties,
    rows: lookupResults.map((lookupResult) => ({
      id: lookupResult.uri.toString(),
      properties: dataExtensionProperties.map((property) => ({
        id: property.id,
        values: propertyValues[property.id](
          lookupResult.result as Term,
          language,
        ).map((value) => ({
          str: value,
        })),
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
  | 'genders';

const propertyValues: Record<
  DataExtensionPropertyId,
  (term: Term, language: string) => string[]
> = {
  prefLabels: (term, language) => literalValues(term.prefLabels, [language]),
  altLabels: (term, language) => literalValues(term.altLabels, [language]),
  scopeNotes: (term, language) => literalValues(term.scopeNotes, [language]),
  birthDates: (term) => term.person?.birthDates ?? [],
  deathDates: (term) => term.person?.deathDates ?? [],
  birthPlaces: (term, language) =>
    entityNames(term.person?.birthPlaces ?? [], language),
  deathPlaces: (term, language) =>
    entityNames(term.person?.deathPlaces ?? [], language),
  // Male and female carry no names, so they are their IRIs.
  genders: (term, language) =>
    entityNames(term.person?.genders ?? [], language),
};

const downcastToReconciliationSpecV0_2 = (
  futureSpecResult: DataExtensionResult,
) => ({
  meta: futureSpecResult.meta,
  rows: futureSpecResult.rows.reduce(
    (acc: { [key: string]: { [key: string]: { str: string }[] } }, current) => {
      acc[current.id] = current.properties.reduce(
        (acc: { [key: string]: { str: string }[] }, current) => {
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
  meta: { id: string; name: string }[];
  rows: {
    id: string;
    properties: {
      id: string;
      values: { str: string }[];
    }[];
  }[];
};
