import {Catalog, fromFiles} from '../src/catalog';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await Catalog.default();
  });

  it('can be created from files', async done => {
    const store = await fromFiles('catalog/');
    const catalog = await Catalog.fromStore(store);
    expect(catalog.datasets.length).toBe(6);
    expect(catalog.datasets[0].distribution.query).toEqual(
      expect.stringContaining('CONSTRUCT {')
    );
    done();
  });

  it('can list datasets', () => {
    expect(catalog.datasets.length).toBe(6);
  });

  it('can retrieve datasets by identifier', () => {
    expect(catalog.getByIdentifier('nope')).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
    const cht = catalog.getByIdentifier('cht')!!;
    expect(cht.identifier).toEqual('cht');
  });
});
