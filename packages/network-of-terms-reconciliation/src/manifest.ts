import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export class ServiceManifest {
  public readonly versions = ['0.1', '0.2'];
  public readonly schemaSpace = 'http://www.w3.org/2004/02/skos/core#Concept';
  public readonly defaultTypes = [
    {
      id: 'http://www.w3.org/2004/02/skos/core#Concept',
      name: 'Concept',
    },
  ];
  public readonly preview;

  constructor(
    public readonly name: string,
    public readonly identifierSpace: IRI,
    readonly previewUrl: string
  ) {
    this.preview = {
      width: 300,
      height: 300,
      url: previewUrl,
    };
  }
}

export function findManifest(
  distributionIri: IRI,
  catalog: Catalog,
  reconciliationServices: string[],
  hostname: string
): ServiceManifest | undefined {
  const source = catalog.getDatasetByDistributionIri(distributionIri);
  if (source && reconciliationServices.includes(distributionIri.toString())) {
    return new ServiceManifest(source.name, source.iri, hostname);
  }

  return undefined;
}
