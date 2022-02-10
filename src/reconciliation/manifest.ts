import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export class ServiceManifest {
  public readonly versions = ['0.1', '0.2'];
  public readonly schemaSpace = 'http://www.w3.org/2004/02/skos/core#Concept';

  constructor(
    public readonly name: string,
    public readonly identifierSpace: IRI
  ) {}
}

export function findManifest(
  distributionIri: IRI,
  catalog: Catalog,
  reconciliationServices: string[]
): ServiceManifest | undefined {
  const source = catalog.getDatasetByDistributionIri(distributionIri);
  if (source && reconciliationServices.includes(distributionIri.toString())) {
    return new ServiceManifest(source.name, source.iri);
  }

  return undefined;
}
