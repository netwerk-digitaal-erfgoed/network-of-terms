export enum QueryMode {
  RAW = 'raw',
  OPTIMIZED = 'optimized',
}

export function queryVariants(query: string, type: QueryMode) {
  switch (type) {
    case QueryMode.RAW:
      return new Map([
        ['query', query],
        ['virtuosoQuery', query],
      ]);
    case QueryMode.OPTIMIZED:
      return new Map([
        ['query', stringQuery(query)],
        ['virtuosoQuery', virtuosoQuery(stringQuery(query))],
      ]);
  }
}

const stringQuery = (query: string) =>
  query.toLowerCase().replace(/\s+/g, ' ').trim();

const virtuosoQuery = (query: string) =>
  join(quote(filterStopWords(split(escape(query)))));

const escape = (query: string) => query.replace(/'/g, "\\'");

const split = (query: string) => query.split(/\s+/);

/**
 * Quote parts that are not boolean operators.
 */
const quote = (queryParts: string[]) =>
  queryParts.map(part => (isBooleanOperator(part) ? part : `'${part}'`));

const filterStopWords = (queryParts: string[]) =>
  queryParts.filter(part => part !== '&');

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
