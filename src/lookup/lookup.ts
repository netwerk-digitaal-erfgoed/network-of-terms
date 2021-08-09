import {
  Catalog,
  Dataset,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {QueryTermsService, TermsResult} from '../services/query';

export class LookupService {
  constructor(
    private catalog: Catalog,
    private queryService: QueryTermsService
  ) {}

  public async lookup(uris: IRI[], timeoutMs: number) {
    const datasetToIris: Map<Dataset, IRI[]> = uris.reduce(
      (datasetMap, iri) => {
        const dataset = this.catalog.getDatasetByTermIri(iri);
        if (dataset) {
          const iris = [...(datasetMap.get(dataset) ?? []), iri];
          datasetMap.set(dataset, iris);
        }
        return datasetMap;
      },
      new Map<Dataset, IRI[]>()
    );

    const lookups = <Promise<TermsResult>[]>[];
    datasetToIris.forEach((iris, dataset) =>
      lookups.push(
        this.queryService.lookup(iris, dataset.distributions[0], timeoutMs)
      )
    );

    // TODO: decide whether we want to return results grouped by source or indexed by lookup URI.
    return await Promise.all(lookups);
  }
}
