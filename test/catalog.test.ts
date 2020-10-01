import {Catalog, Dataset, IRI, SparqlDistribution} from '../src/catalog';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await Catalog.default();
  });

  it('can list datasets', () => {
    expect(catalog.datasets.length).toBe(8);
  });

  it('can retrieve datasets by IRI', () => {
    expect(
      catalog.getDatasetByDistributionIri(new IRI('https://nope.com'))
    ).toBeUndefined();
    const cht = catalog.getDatasetByDistributionIri(
      new IRI('https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht')
    )!;
    expect(cht).toBeInstanceOf(Dataset);
    expect(cht.name).toEqual('Cultuurhistorische Thesaurus');
    expect(cht.alternateName).toEqual('CHT');
    expect(cht.creators[0].name).toEqual(
      'Rijksdienst voor het Cultureel Erfgoed'
    );
    expect(cht.creators[0].alternateName).toEqual('RCE');
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
