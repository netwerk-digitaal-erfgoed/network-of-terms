import {Catalog, fromFiles} from '../src/catalog';

describe('Catalog', () => {
  it('can be created from files', async done => {
    const store = await fromFiles('catalog/');
    const catalog = await Catalog.fromStore(store);
    expect(catalog.datasets.length).toBe(6);
    expect(catalog.datasets[0].distribution.query).toEqual(
      expect.stringContaining('CONSTRUCT {')
    );
    done();
  });
});
