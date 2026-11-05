import {
  Catalog,
  FeatureType,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { conceptType } from './types.js';

export class ServiceManifest {
  public readonly versions = ['0.1', '0.2'];
  public readonly schemaSpace = conceptType.id;
  public readonly defaultTypes = [conceptType];
  public readonly preview;
  public readonly extend;
  // The properties a client can send with a query, so OpenRefine offers them for its columns.
  public readonly suggest;

  constructor(
    public readonly name: string,
    public readonly identifierSpace: IRI,
    readonly root: string,
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

    this.suggest = {
      property: {
        service_url: root,
        service_path: '/suggest/property',
      },
    };
  }
}

export function findManifest(
  dataset: IRI,
  catalog: Catalog,
  root: string,
): ServiceManifest | undefined {
  const source = catalog.getDatasetByIri(dataset);
  if (
    source &&
    source.getSparqlDistribution()?.hasFeature(FeatureType.RECONCILIATION)
  ) {
    return new ServiceManifest(source.name.nl, source.iri, root);
  }

  return undefined;
}
