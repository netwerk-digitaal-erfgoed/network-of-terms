import {
  IRI,
  LookupService,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export type DataExtensionQuery = {
  ids: string[];
  properties: {id: string}[];
};

export const dataExtensionProperties: {
  id: 'prefLabels' | 'altLabels' | 'scopeNotes';
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
];

export async function extendQuery(
  terms: IRI[],
  lookupService: LookupService,
  language: string,
) {
  const lookupResults = (await lookupService.lookup(terms, 10000)).filter(
    lookupResult => lookupResult.result instanceof Term,
  );

  const futureSpecResult = {
    meta: dataExtensionProperties,
    rows: lookupResults.map(lookupResult => ({
      id: lookupResult.uri.toString(),
      properties: dataExtensionProperties.map(property => ({
        id: property.id,
        values: (lookupResult.result as Term)[property.id]
          .filter(literal => literal.language === language)
          .map(literal => ({
            str: literal.value,
          })),
      })),
    })),
  };

  return downcastToReconciliationSpecV0_2(futureSpecResult);
}

const downcastToReconciliationSpecV0_2 = (
  futureSpecResult: DataExtensionResult,
) => ({
  meta: futureSpecResult.meta,
  rows: futureSpecResult.rows.reduce(
    (acc: {[key: string]: {[key: string]: {str: string}[]}}, current) => {
      acc[current.id] = current.properties.reduce(
        (acc: {[key: string]: {str: string}[]}, current) => {
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
  meta: {id: string; name: string}[];
  rows: {
    id: string;
    properties: {
      id: string;
      values: {str: string}[];
    }[];
  }[];
};
