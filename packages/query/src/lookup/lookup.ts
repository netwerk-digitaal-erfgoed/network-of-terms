import { Catalog, Dataset, Distribution, IRI } from '../catalog.js';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
  TermsResponse,
  TermsResult,
  TimeoutError,
} from '../query.js';
import { Term } from '../terms.js';
import { clientQueriesCounter } from '../instrumentation.js';

export type LookupQueryResult = {
  uri: string;
  distribution: SourceResult;
  result: LookupResult;

  responseTimeMs: number;
};

export type SourceResult = Distribution | SourceNotFoundError;

export type LookupResult = Term | NotFoundError | TimeoutError | ServerError;

export class SourceNotFoundError {
  readonly message: string;

  constructor(readonly iri: string) {
    this.message = `No source found that can provide term with URI ${iri}`;
  }
}

export class NotFoundError {
  readonly message: string;

  constructor(readonly iri: string) {
    this.message = `No term found with URI ${iri}`;
  }
}

export class LookupService {
  constructor(
    private catalog: Catalog,
    private queryService: QueryTermsService,
  ) {}

  public async lookup(
    iris: string[],
    timeoutMs: number,
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
        datasetMap.set(dataset, [...(datasetMap.get(dataset) ?? []), iri]);
        return datasetMap;
      },
      new Map<Dataset, IRI[]>(),
    );

    const lookups = [...datasetToIris].map(([dataset]) =>
      this.queryService.lookup(iris, dataset.distributions[0], timeoutMs),
    );

    const termsPerSource: TermsResponse[] = await Promise.all(lookups);

    const datasetToTerms = termsPerSource.reduce(
      (acc, response: TermsResponse) => {
        const responseDataset = this.catalog.getDatasetByDistributionIri(
          response.result.distribution.iri,
        )!;
        // Always register the response under the queried dataset so IRIs that
        // weren’t re-routed (or weren’t returned at all) still resolve to it.
        acc.set(responseDataset, response);
        if (response.result instanceof Terms) {
          // When several datasets share a terms prefix (e.g. GTAA sub-schemes),
          // route each returned term to its true dataset via skos:inScheme,
          // and make the response available under that dataset too.
          for (const term of response.result.terms) {
            if (term.datasetIri === undefined) continue;
            const termDataset = this.catalog.getDatasetByIri(
              term.datasetIri.value,
            );
            if (termDataset === undefined) continue;
            irisToDataset.set(term.id.value, termDataset);
            acc.set(termDataset, response);
          }
        }
        return acc;
      },
      new Map<Dataset, TermsResponse>(),
    );

    return iris.map((iri) => {
      const dataset = irisToDataset.get(iri.toString());
      if (dataset === undefined) {
        clientQueriesCounter.add(1, {
          type: 'lookup',
          error: 'SourceNotFound',
        });
        return {
          uri: iri,
          distribution: new SourceNotFoundError(iri),
          result: new NotFoundError(iri),
          responseTimeMs: 0,
        };
      }

      const response = datasetToTerms.get(dataset)!;
      clientQueriesCounter.add(1, { type: 'lookup' });

      return {
        uri: iri,
        distribution: dataset.distributions[0],
        result: result(response.result, iri),
        responseTimeMs: response.responseTimeMs,
      };
    });
  }
}

function result(result: TermsResult, iri: string): LookupResult {
  if (result instanceof Error) {
    return result;
  }

  return (
    result.terms.find((term) => term.id.value === iri.toString()) ??
    new NotFoundError(iri)
  );
}
