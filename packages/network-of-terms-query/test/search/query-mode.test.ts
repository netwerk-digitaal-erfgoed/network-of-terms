import {QueryMode, queryVariants} from '../../src/search/query-mode';

describe('Search query', () => {
  it('transforms simple query', () => {
    expect(queryVariants('test', QueryMode.OPTIMIZED)).toEqual(
      new Map([
        ['query', 'test'],
        ['virtuosoQuery', "'test'"],
      ])
    );
  });

  it('transforms multiple word query', () => {
    expect(queryVariants('Dr. H. Colijnstraat', QueryMode.OPTIMIZED)).toEqual(
      new Map([
        ['query', 'dr. h. colijnstraat'],
        ['virtuosoQuery', "'dr.' AND 'h.' AND 'colijnstraat'"],
      ])
    );
  });

  it('trims whitespaces', () => {
    expect(queryVariants('   a   b  c  ', QueryMode.OPTIMIZED)).toEqual(
      new Map([
        ['query', 'a b c'],
        ['virtuosoQuery', "'a' AND 'b' AND 'c'"],
      ])
    );
  });

  it('skips already present boolean operators', () => {
    expect(queryVariants('a AND b c or d', QueryMode.OPTIMIZED)).toEqual(
      new Map([
        ['query', 'a and b c or d'],
        ['virtuosoQuery', "'a' and 'b' AND 'c' or 'd'"],
      ])
    );
  });

  it('escapes quotation marks', () => {
    expect(
      queryVariants("Rex Stewart's 'Big' Eight", QueryMode.OPTIMIZED)
    ).toEqual(
      new Map([
        ['query', "rex stewart's 'big' eight"],
        [
          'virtuosoQuery',
          "'rex' AND 'stewart\\'s' AND '\\'big\\'' AND 'eight'",
        ],
      ])
    );
  });

  it('removes stop words', () => {
    expect(queryVariants('Sammy Dowds & Leslie', QueryMode.OPTIMIZED)).toEqual(
      new Map([
        ['query', 'sammy dowds & leslie'],
        ['virtuosoQuery', "'sammy' AND 'dowds' AND 'leslie'"],
      ])
    );
  });

  it('keeps raw queries unchanged', () => {
    expect(queryVariants("Rex Stewart's Big Eight", QueryMode.RAW)).toEqual(
      new Map([
        ['query', "Rex Stewart's Big Eight"],
        ['virtuosoQuery', "Rex Stewart's Big Eight"],
      ])
    );
  });
});
