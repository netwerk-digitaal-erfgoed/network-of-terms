import { Catalog, Dataset, Distribution, IRI } from '../catalog.js';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
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
    // Group IRIs by the dataset their terms-prefix points to. Several datasets
    // may share a prefix (e.g. GTAA sub-schemes); we query a single
    // representative per prefix and rely on each returned term's skos:inScheme
    // to re-route it to its true sub-dataset below.
    const irisByQueriedDataset = new Map<Dataset, IRI[]>();
    for (const iri of iris) {
      const dataset = this.catalog.getDatasetByTermIri(iri);
      if (dataset === undefined) continue;
      const bucket = irisByQueriedDataset.get(dataset) ?? [];
      bucket.push(iri);
      irisByQueriedDataset.set(dataset, bucket);
    }

    const responses = await Promise.all(
      [...irisByQueriedDataset.keys()].map(
        async (queriedDataset) =>
          [
            queriedDataset,
            await this.queryService.lookup(
              iris,
              queriedDataset.distributions[0],
              timeoutMs,
            ),
          ] as const,
      ),
    );

    const resultsByIri = new Map<string, LookupQueryResult>();

    for (const [queriedDataset, response] of responses) {
      if (!(response.result instanceof Terms)) continue;
      for (const term of response.result.terms) {
        const termDataset =
          this.catalog.getDatasetByIri(term.datasetIri?.value ?? '') ??
          queriedDataset;
        resultsByIri.set(term.id.value, {
          uri: term.id.value,
          distribution: termDataset.distributions[0],
          result: term,
          responseTimeMs: response.responseTimeMs,
        });
      }
    }

    for (const [queriedDataset, response] of responses) {
      for (const iri of irisByQueriedDataset.get(queriedDataset) as IRI[]) {
        if (resultsByIri.has(iri)) continue;
        resultsByIri.set(iri, {
          uri: iri,
          distribution: queriedDataset.distributions[0],
          result:
            response.result instanceof Error
              ? response.result
              : new NotFoundError(iri),
          responseTimeMs: response.responseTimeMs,
        });
      }
    }

    return iris.map((iri) => {
      const lookupResult = resultsByIri.get(iri);
      if (lookupResult === undefined) {
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

      clientQueriesCounter.add(1, { type: 'lookup' });
      return lookupResult;
    });
  }
}
