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

export type LookupQueryResult = {
  uri: IRI;
  distribution: SourceResult;
  result: LookupResult;
};

export type SourceResult = Distribution | SourceNotFoundError;

export type LookupResult = Term | NotFoundError | TimeoutError | ServerError;

export class SourceNotFoundError {
  readonly message: string;

  constructor(readonly iri: IRI) {
    this.message = `No source found that can provide term with URI ${iri}`;
  }
}

export class NotFoundError {
  readonly message: string;

  constructor(readonly iri: IRI) {
    this.message = `No term found with URI ${iri}`;
  }
}

export class LookupService {
  constructor(
    private catalog: Catalog,
    private queryService: QueryTermsService
  ) {}

  public async lookup(
    iris: IRI[],
    timeoutMs: number
  ): Promise<LookupQueryResult[]> {
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

    const lookups = [...datasetToIris].map(([dataset]) =>
      this.queryService.lookup(iris, dataset.distributions[0], timeoutMs)
    );

    const termsPerSource: (Terms | TimeoutError | ServerError)[] =
      await Promise.all(lookups);

    const datasetToTerms = termsPerSource.reduce((acc, result: TermsResult) => {
      const dataset = this.catalog.getDatasetByDistributionIri(
        result.distribution.iri
      )!;
      acc.set(dataset, result);
      return acc;
    }, new Map<Dataset, TermsResult>());

    return iris.map(iri => {
      const dataset = irisToDataset.get(iri);
      if (dataset === undefined) {
        return {
          uri: iri,
          distribution: new SourceNotFoundError(iri),
          result: new NotFoundError(iri),
        };
      }

      return {
        uri: iri,
        distribution: dataset.distributions[0],
        result: result(datasetToTerms.get(dataset)!, iri),
      };
    });
  }
}

function result(result: TermsResult, iri: IRI): LookupResult {
  if (result instanceof Error) {
    return result;
  }

  return (
    result.terms.find(term => term.id.value === iri.toString()) ??
    new NotFoundError(iri)
  );
}
