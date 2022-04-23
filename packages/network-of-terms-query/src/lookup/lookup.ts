import {Catalog, Dataset, Distribution, IRI} from '../catalog';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
  TermsResult,
  TimeoutError,
} from '../query';
import {Term} from '../terms';

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

    const termsPerSource: (Terms | TimeoutError | ServerError)[] =
      await Promise.all(lookups);

    const datasetToTerms = termsPerSource.reduce((acc, result: TermsResult) => {
      let dataset = this.catalog.getDatasetByDistributionIri(
        result.distribution.iri
      )!;
      if (result instanceof Terms) {
        const termsResult =
          (acc.get(dataset) as Terms) ?? new Terms(result.distribution, []);
        for (const term of result.terms) {
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
        acc.set(dataset, termsResult);
      } else {
        const dataset = this.catalog.getDatasetByDistributionIri(
          result.distribution.iri
        )!;
        acc.set(dataset, result);
      }
      return acc;
    }, new Map<Dataset, TermsResult>());

    return iris.map(iri => {
      const dataset = irisToDataset.get(iri.toString());
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
