import { beforeAll, describe, expect, it } from 'vitest';
import {
  Catalog,
  Dataset,
  FeatureType,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { getCatalog } from '../src/index.js';
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
    expect(cht.distributions[0].features[0].url?.toString()).toEqual(
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

  it('resolves term IRIs shared by multiple datasets to the broadest one', () => {
    expect(
      catalog.getDatasetByTermIri('http://www.wikidata.org/entity/Q230141')
        ?.iri,
    ).toEqual('https://www.wikidata.org#entities-all');
    expect(
      catalog.getDatasetByTermIri('http://vocab.getty.edu/aat/300010358')?.iri,
    ).toEqual('http://vocab.getty.edu/aat');
    expect(
      catalog.getDatasetByTermIri(
        'https://data.cultureelerfgoed.nl/term/id/cht/b47bd52f-97e5-402b-a2b6-3a0bb56e4e51',
      )?.iri,
    ).toEqual('https://data.cultureelerfgoed.nl/term/id/cht');
    expect(
      catalog.getDatasetByTermIri('https://sws.geonames.org/2745912/')?.iri,
    ).toEqual('https://www.geonames.org');
  });

  it('resolves term IRIs of datasets that hold terms in multiple URI spaces', () => {
    for (const termIri of [
      'https://data.cultureelerfgoed.nl/rights/cc-licenties',
      'https://creativecommons.org/licenses/by-nc/4.0/',
      'http://rightsstatements.org/vocab/InC/1.0/',
      'https://rightsstatements.org/vocab/InC-RUU/1.0/',
    ]) {
      expect(catalog.getDatasetByTermIri(termIri)?.iri, termIri).toEqual(
        'https://data.cultureelerfgoed.nl/rights',
      );
    }
  });

  it('declares each terms prefix on a single dataset, except known shared prefixes', () => {
    // Datasets sharing these prefixes are told apart by each term’s
    // skos:inScheme in their lookup query results instead; see
    // https://github.com/netwerk-digitaal-erfgoed/network-of-terms/issues/1863
    // for modelling them as first-class groups.
    const sharedPrefixes = [
      'http://data.beeldengeluid.nl/gtaa', // GTAA
      'http://data.bibliotheken.nl/id/thes/', // KB: Brinkman, NTA, STCN, corporations
      'https://data.muziekweb.nl/Link/', // Muziekweb
      'https://terms.personsincontext.org/ThesaurusHistorischePersoonsgegevens/', // PiCo-T
    ];
    const datasetsByPrefix = new Map<string, string[]>();
    for (const dataset of catalog.datasets) {
      for (const prefix of dataset.termsPrefixes) {
        datasetsByPrefix.set(prefix, [
          ...(datasetsByPrefix.get(prefix) ?? []),
          dataset.iri,
        ]);
      }
    }
    for (const [prefix, datasetIris] of datasetsByPrefix) {
      if (sharedPrefixes.some((shared) => prefix.startsWith(shared))) {
        continue;
      }
      expect(
        datasetIris,
        `prefix ${prefix} must be declared by a single dataset so that lookups resolve deterministically; broader/subset datasets must declare it only on the broadest one`,
      ).toHaveLength(1);
    }
  });

  it('covers datasets without a terms prefix through a broader dataset', () => {
    for (const dataset of catalog.datasets) {
      if (dataset.termsPrefixes.length > 0) {
        continue;
      }
      const broader = catalog.datasets.find(
        (candidate) =>
          candidate.termsPrefixes.length > 0 &&
          candidate.distributions[0].endpoint ===
            dataset.distributions[0].endpoint,
      );
      expect(
        broader,
        `${dataset.iri} declares no terms prefix (schema:url), so a broader dataset on the same endpoint must declare one for lookups to work`,
      ).toBeDefined();
    }
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
    const catalog = await getCatalog(
      resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/credentials/'),
    );
    const distributionIri =
      'https://data.beeldengeluid.nl/id/datadownload/0027';
    const dataset = catalog.getDatasetByDistributionIri(distributionIri)!;
    expect(
      dataset.getDistributionByIri(distributionIri)?.endpoint.toString(),
    ).toEqual('https://username:password@gtaa.apis.beeldengeluid.nl/sparql');
  });

  it('returns all languages', async () => {
    expect(catalog.getLanguages().sort()).toEqual(['en', 'fy', 'nl']);
  });

  it('loads catalog from a path', async () => {
    const catalog = await getCatalog(
      resolve(dirname(fileURLToPath(import.meta.url)), '../', 'catalog/'),
    );
    expect(catalog.datasets.length).toBeGreaterThan(3);
  }, 50_000);
});
