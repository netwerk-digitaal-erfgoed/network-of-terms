import {URL} from 'url';

export class Catalog {
  constructor(readonly datasets: ReadonlyArray<Dataset>) {}

  public getDatasetByDistributionIri(iri: IRI): Dataset | undefined {
    return this.datasets.find(
      dataset => dataset.getDistributionByIri(iri) !== undefined
    );
  }

  public getDatasetByTermIri(iri: IRI): Dataset | undefined {
    return this.datasets.find(dataset =>
      dataset.termsPrefixes.some(termPrefix =>
        iri.toString().startsWith(termPrefix.toString())
      )
    );
  }

  public getDistributionsProvidingFeature(feature: Feature): Distribution[] {
    return this.datasets.reduce<Distribution[]>((acc, dataset) => {
      return [
        ...acc,
        ...dataset.distributions.filter(distribution =>
          distribution.features.includes(feature)
        ),
      ];
    }, []);
  }
}

export class Dataset {
  constructor(
    readonly iri: IRI,
    readonly name: string,
    readonly termsPrefixes: IRI[],
    readonly creators: [Organization],
    readonly distributions: [Distribution],
    readonly alternateName?: string
  ) {}

  public getDistributionByIri(iri: IRI): Distribution | undefined {
    return this.distributions.find(
      distribution => distribution.iri.toString() === iri.toString()
    );
  }
}

export class Organization {
  constructor(
    readonly iri: IRI,
    readonly name: string,
    readonly alternateName: string
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

  public hasFeature(feature: Feature) {
    return this.features.includes(feature);
  }
}

/**
 * A union type to be extended in the future with other distribution types.
 */
export type Distribution = SparqlDistribution;

export class IRI extends URL {}

export enum Feature {
  RECONCILIATION = 'https://reconciliation-api.github.io/specs/latest/',
}
