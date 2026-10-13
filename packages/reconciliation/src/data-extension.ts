import {
  IRI,
  literalValues,
  LookupService,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { dateValues } from './date-values.js';
import { placeNames } from './place-names.js';

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
  | 'deathPlaces';

const propertyValues: Record<
  DataExtensionPropertyId,
  (term: Term, language: string) => string[]
> = {
  prefLabels: (term, language) => literalValues(term.prefLabels, [language]),
  altLabels: (term, language) => literalValues(term.altLabels, [language]),
  scopeNotes: (term, language) => literalValues(term.scopeNotes, [language]),
  birthDates: (term) => dateValues(term.birthDates),
  deathDates: (term) => dateValues(term.deathDates),
  birthPlaces: (term, language) => placeNames(term.birthPlaces, language),
  deathPlaces: (term, language) => placeNames(term.deathPlaces, language),
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
