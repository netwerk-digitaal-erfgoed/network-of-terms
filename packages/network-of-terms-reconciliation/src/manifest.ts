import {
  Catalog,
  FeatureType,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export class ServiceManifest {
  public readonly versions = ['0.1', '0.2'];
  public readonly schemaSpace = 'http://www.w3.org/2004/02/skos/core#Concept';
  public readonly defaultTypes = [
    {
      id: this.schemaSpace,
      name: 'Concept',
    },
  ];
  public readonly preview;
  public readonly extend;

  constructor(
    public readonly name: string,
    public readonly identifierSpace: IRI,
    readonly root: string
  ) {
    this.preview = {
      width: 300,
      height: 300,
      url: root + '/preview/{{id}}',
    };

    this.extend = {
      propose_properties: {
        service_url: root,
        service_path: '/extend/propose',
      },
      property_settings: [],
    };
  }
}

export function findManifest(
  dataset: IRI,
  catalog: Catalog,
  root: string
): ServiceManifest | undefined {
  const source = catalog.getDatasetByIri(dataset);
  if (
    source &&
    source.getSparqlDistribution()?.hasFeature(FeatureType.RECONCILIATION)
  ) {
    return new ServiceManifest(source.name, source.iri, root);
  }

  return undefined;
}
