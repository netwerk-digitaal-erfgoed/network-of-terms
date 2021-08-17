import {Catalog, Dataset, IRI, SparqlDistribution} from '../src/catalog';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await Catalog.default();
  });

  it('lists datasets in alphabetical order', () => {
    expect(catalog.datasets.length).toBeGreaterThan(3);
    const datasetNames = catalog.datasets.map(dataset => dataset.name);
    expect([...datasetNames].sort()).toEqual(datasetNames);
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
    expect(cht.termsPrefixes).toEqual([
      new IRI('https://data.cultureelerfgoed.nl/term/id/cht/'),
    ]);
    expect(cht.alternateName).toEqual('CHT');
    expect(cht.creators[0].name).toEqual(
      'Rijksdienst voor het Cultureel Erfgoed'
    );
    expect(cht.creators[0].alternateName).toEqual('RCE');
  });

  it('can retrieve distributions by IRI', () => {
    const distributionIri = new IRI(
      'https://query.wikidata.org/sparql#entities-all'
    );
    const wikidata = catalog.getDatasetByDistributionIri(distributionIri)!;
    const distribution = wikidata.getDistributionByIri(distributionIri)!;
    expect(distribution).toBeInstanceOf(SparqlDistribution);
    expect(distribution.iri).toEqual(distributionIri);
    expect(distribution.endpoint).toEqual(
      new IRI('https://query.wikidata.org/sparql')
    );
    expect(distribution.searchQuery).toMatch(/CONSTRUCT/);
    expect(distribution.lookupQuery).toMatch(/CONSTRUCT/);
  });

  it('can retrieve dataset by term IRI', () => {
    expect(
      catalog.getDatasetByTermIri(new IRI('https://nope'))
    ).toBeUndefined();
    const rkd = catalog.getDatasetByTermIri(
      new IRI('https://data.rkd.nl/artists/123')
    );
    expect(rkd).toBeInstanceOf(Dataset);
    expect(rkd?.iri).toEqual(new IRI('https://data.rkd.nl/rkdartists'));
  });
});
