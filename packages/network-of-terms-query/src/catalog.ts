import {URL} from 'url';

export class Catalog {
  private readonly prefixToDataset: Map<string, IRI>;

  constructor(readonly datasets: ReadonlyArray<Dataset>) {
    this.prefixToDataset = this.indexPrefixesByStringLength();
  }

  /**
   * Get dataset by IRI, accepting distribution IRIs too for BC.
   */
  public getDatasetByIri(iri: IRI): Dataset | undefined {
    return (
      this.datasets.find(
        dataset => dataset.iri.toString() === iri.toString()
      ) ?? this.getDatasetByDistributionIri(iri)
    );
  }

  public getDatasetsSortedByName(languageCode: string): Dataset[] {
    return [...this.datasets].sort((a, b) =>
      a.name[languageCode].localeCompare(b.name[languageCode])
    );
  }

  public getDatasetByDistributionIri(iri: IRI): Dataset | undefined {
    return this.datasets.find(
      dataset => dataset.getDistributionByIri(iri) !== undefined
    );
  }

  public getDatasetByTermIri(iri: IRI): Dataset | undefined {
    for (const [prefix, datasetIri] of this.prefixToDataset) {
      if (iri.toString().startsWith(prefix)) {
        return this.getDatasetByIri(datasetIri);
      }
    }

    return undefined;
  }

  public getDistributionsProvidingFeature(
    featureType: FeatureType
  ): Distribution[] {
    return this.datasets.reduce<Distribution[]>((acc, dataset) => {
      return [
        ...acc,
        ...dataset.distributions.filter(distribution =>
          distribution.hasFeature(featureType)
        ),
      ];
    }, []);
  }

  /**
   * Index the prefixes of all datasets by their string length in descending order for matching
   * term IRIs against during lookup. When looking up terms, we want to match the longest possible prefix
   * in case prefixes overlap.
   */
  private indexPrefixesByStringLength() {
    return new Map(
      [
        ...this.datasets
          .reduce((acc, dataset) => {
            dataset.termsPrefixes.forEach(prefix => {
              acc.set(prefix.toString(), dataset.iri);
            });
            return acc;
          }, new Map<string, IRI>())
          .entries(),
      ].sort(([a], [b]) => b.localeCompare(a))
    );
  }
}

export type StringDictionary = Record<string, string>;

export class Dataset {
  constructor(
    readonly iri: IRI,
    readonly name: StringDictionary,
    readonly description: StringDictionary,
    readonly genres: IRI[],
    readonly termsPrefixes: IRI[],
    readonly mainEntityOfPage: string,
    readonly inLanguage: string[],
    readonly creators: [Organization],
    readonly distributions: [Distribution],
    readonly alternateName: StringDictionary = {}
  ) {}

  public getSparqlDistribution(): Distribution | undefined {
    return this.distributions.find(
      distribution => distribution instanceof SparqlDistribution
    );
  }

  public getDistributionByIri(iri: IRI): Distribution | undefined {
    return this.distributions.find(
      distribution => distribution.iri.toString() === iri.toString()
    );
  }
}

export class Organization {
  constructor(
    readonly iri: IRI,
    readonly name: StringDictionary,
    readonly alternateName: StringDictionary
  ) {}
}

export class SparqlDistribution {
  constructor(
    readonly iri: IRI,
    readonly endpoint: IRI,
    readonly searchQuery: string,
    readonly lookupQuery: string,
    readonly features: Feature[] = []
  ) {}

  public hasFeature(feature: FeatureType) {
    return this.features.some((value: Feature) => value.type === feature);
  }
}

export class Feature {
  constructor(
    readonly type: FeatureType,
    readonly url: URL
  ) {}
}

export enum FeatureType {
  RECONCILIATION = 'https://reconciliation-api.github.io/specs/latest/',
}

/**
 * A union type to be extended in the future with other distribution types.
 */
export type Distribution = SparqlDistribution;

export class IRI extends URL {}
