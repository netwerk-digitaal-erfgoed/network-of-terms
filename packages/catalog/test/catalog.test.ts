import {
  Catalog,
  Dataset,
  FeatureType,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { fromFile, fromStore, getCatalog } from '../src/index.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

let catalog: Catalog;

describe('Catalog', () => {
  beforeAll(async () => {
    catalog = await getCatalog();
  }, 20_000);

  it('lists datasets in alphabetical order', () => {
    expect(catalog.datasets.length).toBeGreaterThan(3);
    const datasetNames = catalog
      .getDatasetsSortedByName('nl')
      .map((dataset) => dataset.name.nl.toLowerCase());
    expect(datasetNames).toEqual([...datasetNames].sort());
  });

  it('can retrieve datasets by IRI', () => {
    expect(
      catalog.getDatasetByDistributionIri('https://nope.com'),
    ).toBeUndefined();

    const cht = catalog.getDatasetByIri(
      'https://data.cultureelerfgoed.nl/term/id/cht',
    )!;
    expect(cht).toBeInstanceOf(Dataset);
    expect(cht.name.nl).toEqual('Cultuurhistorische Thesaurus');
    expect(cht.description.nl).toEqual(
      'Onderwerpen voor het beschrijven van cultureel erfgoed',
    );
    expect(cht.genres).toContainEqual(
      'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Abstracte-begrippen',
    );
    expect(cht.termsPrefixes).toEqual([
      'https://data.cultureelerfgoed.nl/term/id/cht/',
    ]);
    expect(cht.alternateName.nl).toEqual('CHT');
    expect(cht.inLanguage).toHaveLength(2);
    expect(cht.inLanguage).toEqual(expect.arrayContaining(['en', 'nl']));
    expect(cht.creators[0].name.nl).toEqual(
      'Rijksdienst voor het Cultureel Erfgoed',
    );
    expect(cht.creators[0].alternateName['']).toEqual('RCE');
    expect(cht.distributions[0].features[0].type).toEqual(
      FeatureType.RECONCILIATION,
    );
    expect(cht.distributions[0].features[0].url.toString()).toEqual(
      `https://termennetwerk-api.netwerkdigitaalerfgoed.nl/reconcile/${cht.iri}`,
    );
  });

  it('can retrieve distributions by IRI', () => {
    const distributionIri = 'https://query.wikidata.org/sparql#entities-all';
    const wikidata = catalog.getDatasetByDistributionIri(distributionIri)!;
    const distribution = wikidata.getDistributionByIri(distributionIri)!;
    expect(distribution).toBeInstanceOf(SparqlDistribution);
    expect(distribution.iri).toEqual(distributionIri);
    expect(distribution.endpoint).toEqual('https://query.wikidata.org/sparql');
    expect(distribution.searchQuery).toMatch(/CONSTRUCT/);
    expect(distribution.lookupQuery).toMatch(/CONSTRUCT/);
  });

  it('can retrieve dataset by term IRI', () => {
    expect(catalog.getDatasetByTermIri('https://nope')).toBeUndefined();
    const rkd = catalog.getDatasetByTermIri('https://data.rkd.nl/artists/123');
    expect(rkd).toBeInstanceOf(Dataset);
    expect(rkd?.iri).toEqual('https://data.rkd.nl/rkdartists');
  });

  it('retrieves distributions providing feature', () => {
    const reconciliationApis = catalog.getDistributionsProvidingFeature(
      FeatureType.RECONCILIATION,
    );
    expect(reconciliationApis[0].features[0].type).toEqual(
      FeatureType.RECONCILIATION,
    );
  });

  it('substitutes credentials from environment variables', async () => {
    process.env.DATASET_CREDENTIALS = 'username:password';
    const store = await fromFile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'fixtures/credentials.jsonld',
      ),
    );
    const catalog = await fromStore(store);
    const distributionIri =
      'https://data.beeldengeluid.nl/id/datadownload/0027';
    const dataset = catalog.getDatasetByDistributionIri(distributionIri)!;
    expect(
      dataset.getDistributionByIri(distributionIri)?.endpoint.toString(),
    ).toEqual('https://username:password@gtaa.apis.beeldengeluid.nl/sparql');
  });

  it('returns all languages', async () => {
    expect(catalog.getLanguages().sort()).toEqual(['en', 'nl']);
  });

  it('loads catalog from a path', async () => {
    const catalog = await getCatalog(
      resolve(dirname(fileURLToPath(import.meta.url)), '../', 'catalog/'),
    );
    expect(catalog.datasets.length).toBeGreaterThan(3);
  }, 50_000);
});
