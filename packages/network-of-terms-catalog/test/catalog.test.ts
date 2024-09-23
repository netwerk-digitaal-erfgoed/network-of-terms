import {
  Catalog,
  Dataset,
  FeatureType,
  IRI,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {fromFile, fromStore, getCatalog} from '../src/index.js';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await getCatalog();
  });

  it('lists datasets in alphabetical order', () => {
    expect(catalog.datasets.length).toBeGreaterThan(3);
    const datasetNames = catalog.datasets.map(dataset =>
      dataset.name.toLowerCase()
    );
    expect(datasetNames).toEqual([...datasetNames].sort());
  });

  it('can retrieve datasets by IRI', () => {
    expect(
      catalog.getDatasetByDistributionIri(new IRI('https://nope.com'))
    ).toBeUndefined();

    const cht = catalog.getDatasetByIri(
      new IRI('https://data.cultureelerfgoed.nl/term/id/cht')
    )!;
    expect(cht).toBeInstanceOf(Dataset);
    expect(cht.name).toEqual('Cultuurhistorische Thesaurus');
    expect(cht.description).toEqual(
      'Onderwerpen voor het beschrijven van cultureel erfgoed'
    );
    expect(cht.genres).toContainEqual(
      new IRI(
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Abstracte-begrippen'
      )
    );
    expect(cht.termsPrefixes).toEqual([
      new IRI('https://data.cultureelerfgoed.nl/term/id/cht/'),
    ]);
    expect(cht.alternateName).toEqual('CHT');
    expect(cht.inLanguage).toEqual('nl');
    expect(cht.creators[0].name).toEqual(
      'Rijksdienst voor het Cultureel Erfgoed'
    );
    expect(cht.creators[0].alternateName).toEqual('RCE');
    expect(cht.distributions[0].features[0].type).toEqual(
      FeatureType.RECONCILIATION
    );
    expect(cht.distributions[0].features[0].url.toString()).toEqual(
      `https://termennetwerk-api.netwerkdigitaalerfgoed.nl/reconcile/${cht.iri}`
    );
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

  it('retrieves distributions providing feature', () => {
    const reconciliationApis = catalog.getDistributionsProvidingFeature(
      FeatureType.RECONCILIATION
    );
    expect(reconciliationApis[0].features[0].type).toEqual(
      FeatureType.RECONCILIATION
    );
  });

  it('substitutes credentials from environment variables', async () => {
    process.env.DATASET_CREDENTIALS = 'username:password';
    const store = await fromFile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'fixtures/credentials.jsonld'
      )
    );
    const catalog = await fromStore(store);
    const distributionIri = new IRI(
      'https://data.beeldengeluid.nl/id/datadownload/0027'
    );
    const dataset = catalog.getDatasetByDistributionIri(distributionIri)!;
    expect(
      dataset.getDistributionByIri(distributionIri)?.endpoint.toString()
    ).toEqual('https://username:password@gtaa.apis.beeldengeluid.nl/sparql');
  });

  it('loads catalog from a path', async () => {
    const catalog = await getCatalog(
      resolve(dirname(fileURLToPath(import.meta.url)), '../', 'catalog/')
    );
    expect(catalog.datasets.length).toBeGreaterThan(3);
  });
});
