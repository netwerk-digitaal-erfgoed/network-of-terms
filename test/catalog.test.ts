import {
  Catalog,
  Dataset,
  fromFiles,
  IRI,
  SparqlDistribution,
} from '../src/catalog';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await Catalog.default();
  });

  it('can be created from files', async done => {
    const store = await fromFiles('catalog/');
    const catalog = await Catalog.fromStore(store);
    expect(catalog.datasets.length).toBe(6);
    expect(catalog.datasets[0].distributions[0].query).toEqual(
      expect.stringContaining('CONSTRUCT {')
    );
    done();
  });

  it('can list datasets', () => {
    expect(catalog.datasets.length).toBe(6);
  });

  it('can retrieve datasets by IRI', () => {
    expect(
      catalog.getDatasetByDistributionIri(new IRI('https://nope.com'))
    ).toBeUndefined();
    const cht = catalog.getDatasetByDistributionIri(
      new IRI('https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht')
    )!;
    expect(cht).toBeInstanceOf(Dataset);
    expect(cht.name).toEqual('Cultuurhistorische Thesaurus (CHT)');
  });

  it('can retrieve distributions by IRI', () => {
    const distributionIri = new IRI('https://www.wikidata.org/sparql');
    const wikidata = catalog.getDatasetByDistributionIri(distributionIri)!;
    const distribution = wikidata.getDistributionByIri(distributionIri)!;
    expect(distribution).toBeInstanceOf(SparqlDistribution);
    expect(distribution.iri).toEqual(distributionIri);
    expect(distribution.endpoint).toEqual(
      new IRI('https://query.wikidata.org/sparql')
    );
  });
});
