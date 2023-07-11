import {Catalog, Dataset, Distribution, IRI} from '../catalog';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
  TermsResponse,
  TermsResult,
  TimeoutError,
} from '../query';
import {Term} from '../terms';
import {clientQueriesCounter} from '../instrumentation';

export type LookupQueryResult = {
  uri: IRI;
  distribution: SourceResult;
  result: LookupResult;

  responseTimeMs: number;
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
        acc.set(iri.toString(), dataset);
      }
      return acc;
    }, new Map<string, Dataset>());

    const datasetToIris = [...irisToDataset].reduce(
      (datasetMap, [iri, dataset]) => {
        datasetMap.set(dataset, [
          ...(datasetMap.get(dataset) ?? []),
          new IRI(iri),
        ]);
        return datasetMap;
      },
      new Map<Dataset, IRI[]>()
    );

    const lookups = [...datasetToIris].map(([dataset]) =>
      this.queryService.lookup(iris, dataset.distributions[0], timeoutMs)
    );

    const termsPerSource: TermsResponse[] = await Promise.all(lookups);

    const datasetToTerms = termsPerSource.reduce(
      (acc, response: TermsResponse) => {
        let dataset = this.catalog.getDatasetByDistributionIri(
          response.result.distribution.iri
        )!;
        if (response.result instanceof Terms) {
          const termsResult =
            (acc.get(dataset)?.result as Terms) ??
            new Terms(response.result.distribution, []);
          for (const term of response.result.terms) {
            if (term.datasetIri !== undefined) {
              const termsDataset = this.catalog.getDatasetByIri(
                new IRI(term.datasetIri.value)
              );
              if (termsDataset !== undefined) {
                dataset = termsDataset;
                irisToDataset.set(term.id.value, dataset);
              }
            }
            termsResult.terms.push(term);
          }
          acc.set(
            dataset,
            new TermsResponse(termsResult, response.responseTimeMs)
          );
        } else {
          const dataset = this.catalog.getDatasetByDistributionIri(
            response.result.distribution.iri
          )!;
          acc.set(dataset, response);
        }
        return acc;
      },
      new Map<Dataset, TermsResponse>()
    );

    return iris.map(iri => {
      const dataset = irisToDataset.get(iri.toString());
      if (dataset === undefined) {
        clientQueriesCounter.add(1, {type: 'lookup', error: 'SourceNotFound'});
        return {
          uri: iri,
          distribution: new SourceNotFoundError(iri),
          result: new NotFoundError(iri),
          responseTimeMs: 0,
        };
      }

      const response = datasetToTerms.get(dataset)!;
      clientQueriesCounter.add(1, {type: 'lookup'});

      return {
        uri: iri,
        distribution: dataset.distributions[0],
        result: result(response.result, iri),
        responseTimeMs: response.responseTimeMs,
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
