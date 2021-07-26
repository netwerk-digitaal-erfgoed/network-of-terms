import {
  Dataset,
  Distribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export function source(distribution: Distribution, dataset: Dataset) {
  return {
    uri: distribution.iri,
    name: dataset.name,
    alternateName: dataset.alternateName,
    creators: dataset.creators.map(creator => ({
      uri: creator.iri,
      name: creator.name,
      alternateName: creator.alternateName,
    })),
  };
}
