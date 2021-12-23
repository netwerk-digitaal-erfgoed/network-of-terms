import {QueryMode, queryVariants} from '../../src/search/query-mode';

describe('Search query', () => {
  it('transforms simple query', () => {
    expect(queryVariants('test', QueryMode.SMART)).toEqual(
      new Map([
        ['?query', 'test'],
        ['?booleanQuery', "'test'"],
      ])
    );
  });

  it('transforms multiple word query', () => {
    expect(queryVariants('Dr. H. Colijnstraat', QueryMode.SMART)).toEqual(
      new Map([
        ['?query', 'dr. h. colijnstraat'],
        ['?booleanQuery', "'dr.' AND 'h.' AND 'colijnstraat'"],
      ])
    );
  });

  it('trims whitespaces', () => {
    expect(queryVariants('   a   b  c  ', QueryMode.SMART)).toEqual(
      new Map([
        ['?query', 'a b c'],
        ['?booleanQuery', "'a' AND 'b' AND 'c'"],
      ])
    );
  });

  it('skips already present boolean operators', () => {
    expect(queryVariants('a AND b c or d', QueryMode.SMART)).toEqual(
      new Map([
        ['?query', 'a and b c or d'],
        ['?booleanQuery', "'a' and 'b' AND 'c' or 'd'"],
      ])
    );
  });

  it('escapes quotation marks', () => {
    expect(queryVariants("Rex Stewart's Big Eight", QueryMode.SMART)).toEqual(
      new Map([
        ['?query', "rex stewart's big eight"],
        ['?booleanQuery', "'rex' AND 'stewart\\'s' AND 'big' AND 'eight'"],
      ])
    );
  });

  it('keeps raw queries unchanged', () => {
    expect(queryVariants("Rex Stewart's Big Eight", QueryMode.RAW)).toEqual(
      new Map([
        ['?query', "Rex Stewart's Big Eight"],
        ['?booleanQuery', "Rex Stewart's Big Eight"],
      ])
    );
  });
});
