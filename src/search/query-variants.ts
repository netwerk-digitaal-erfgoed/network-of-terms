export enum SearchQueryType {
  RAW = 'raw',
  SMART = 'smart',
  DEPRECATED = 'deprecated',
}

export function queryVariants(query: string, type: SearchQueryType) {
  switch (type) {
    case SearchQueryType.RAW:
      return new Map([
        ['?query', query],
        ['?booleanQuery', query],
      ]);
    case SearchQueryType.SMART:
      return new Map([
        ['?query', stringQuery(query)],
        ['?booleanQuery', booleanQuery(stringQuery(query))],
      ]);
    case SearchQueryType.DEPRECATED:
      return new Map([['?query', query]]);
  }
}

export const stringQuery = (query: string) =>
  query.toLowerCase().replace(/\s+/g, ' ').trim();

export const booleanQuery = (query: string) =>
  join(quote(split(escape(query))));

const escape = (query: string) => query.replace("'", "\\'");

const split = (query: string) => query.split(/\s+/);

/**
 * Quote parts that are not boolean operators.
 */
const quote = (queryParts: string[]) =>
  queryParts.map(part => (isBooleanOperator(part) ? part : `'${part}'`));

/**
 * Join query parts with boolean AND if they are not yet connected with a boolean.
 */
const join = (queryParts: string[]) =>
  queryParts.reduce((previousValue, currentValue, currentIndex, array) => {
    const previous = array[currentIndex - 1];
    if (!isBooleanOperator(previous) && !isBooleanOperator(currentValue)) {
      return `${previousValue} AND ${currentValue}`;
    }

    return `${previousValue} ${currentValue}`;
  });

const isBooleanOperator = (maybeBool: string) =>
  maybeBool.toLowerCase() === 'and' || maybeBool.toLowerCase() === 'or';
