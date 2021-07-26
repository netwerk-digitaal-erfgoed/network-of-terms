import {
  Catalog,
  Dataset,
  Distribution,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {QueryTermsService, Terms, TermsResult} from '../services/query';

export class LookupService {
  constructor(
    private catalog: Catalog,
    private queryService: QueryTermsService
  ) {}

  public async lookup(uris: IRI[], timeoutMs: number) {
    const datasetToIris: Map<Dataset, IRI[]> = uris.reduce(
      (datasetMap, iri) => {
        const dataset = this.findDatasetForUriPrefix(iri);
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
      lookups.push(this.query(dataset.distributions[0], iris, timeoutMs))
    );

    // TODO: decide whether we want to return results grouped by source or indexed by lookup URI.
    return await Promise.all(lookups);
  }

  private async query(
    distribution: Distribution,
    iris: IRI[],
    timeoutMs: number
  ): Promise<TermsResult> {
    await this.queryService.lookup(iris, distribution, timeoutMs);

    return new Terms(distribution, []);
  }

  private findDatasetForUriPrefix(uri: IRI): Dataset | null {
    console.log(`TODO: find dataset for URI ${uri}`);
    // TODO: add real dataset lookup function to catalog.ts and use that instead.
    return this.catalog.datasets[0];
  }
}
