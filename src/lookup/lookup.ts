import {
  Catalog,
  Dataset,
  Distribution,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
  TermsResult,
  TimeoutError,
} from '../services/query';
import {Term} from '../services/terms';

export type LookupResult = {
  uri: IRI;
  distribution?: Distribution;
  result?: LookupSuccessErrorResult;
};

export type LookupSuccessErrorResult =
  | Term
  | TimeoutError
  | ServerError
  | SourceNotFoundError;

export class SourceNotFoundError {
  readonly message: string;

  constructor(readonly iri: IRI) {
    this.message = `No source found for term with IRI ${iri}`;
  }
}

export class LookupService {
  constructor(
    private catalog: Catalog,
    private queryService: QueryTermsService
  ) {}

  public async lookup(iris: IRI[], timeoutMs: number): Promise<LookupResult[]> {
    const irisToDataset = iris.reduce((acc, iri) => {
      const dataset = this.catalog.getDatasetByTermIri(iri);
      if (dataset) {
        acc.set(iri, dataset);
      }
      return acc;
    }, new Map<IRI, Dataset>());

    const datasetToIris = [...irisToDataset].reduce(
      (datasetMap, [iri, dataset]) => {
        datasetMap.set(dataset, [...(datasetMap.get(dataset) ?? []), iri]);
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

    const termsPerSource: (
      | Terms
      | TimeoutError
      | ServerError
    )[] = await Promise.all(lookups);

    const datasetToTerms = termsPerSource.reduce((acc, result: TermsResult) => {
      const dataset = this.catalog.getDatasetByDistributionIri(
        result.distribution.iri
      )!;
      acc.set(dataset, result);
      return acc;
    }, new Map<Dataset, TermsResult>());

    // We must return distibution.IRI and dataset
    return iris.map(iri => {
      const dataset = irisToDataset.get(iri);
      if (dataset === undefined) {
        return {
          uri: iri,
          result: new SourceNotFoundError(iri),
        };
      }

      const terms = datasetToTerms.get(dataset)!;

      return {
        uri: iri,
        distribution: dataset.distributions[0],
        result: result(terms, iri),
      };
    });
  }
}

function result(
  result: TermsResult,
  iri: IRI
): LookupSuccessErrorResult | undefined {
  if (result instanceof Error) {
    return result;
  }

  return result.terms.find(term => term.id.value === iri.toString());
}
