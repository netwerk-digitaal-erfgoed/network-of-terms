import {
  Catalog,
  FeatureType,
  IRI,
  isPersonClass,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export const conceptType = {
  id: 'http://www.w3.org/2004/02/skos/core#Concept',
  name: 'Concept',
};

export const personType = {
  id: 'https://schema.org/Person',
  name: 'Person',
};

/**
 * The reconciliation types of a term: every term is a concept, and a term the source types as a
 * Schema.org person is a person too. Clients such as OpenRefine guess the type to reconcile
 * against from the types of the candidates, so a source of persons gets Person suggested without
 * the manifest naming it: few sources the catalog files under persons type their terms so.
 */
export const termTypes = (term: Term) =>
  isPerson(term) ? [conceptType, personType] : [conceptType];

export const isPerson = (term: Term) => term.types.some(isPersonClass);

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
