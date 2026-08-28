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

/**
 * Characters SPARQL forbids inside an IRIREF: `<>"{}|^\` plus everything up to #x20.
 *
 * There is no escape for them – the grammar simply excludes them – so an IRI carrying one cannot be
 * serialised into a query at all. Since lookup interpolates caller-supplied IRIs into the query
 * text, a `>` would close the IRIREF early and let the rest of the string be read as SPARQL.
 *
 * See https://www.w3.org/TR/sparql11-query/#rIRIREF
 */
// eslint-disable-next-line no-control-regex -- the excluded range is #x00-#x20 by definition
const FORBIDDEN_IN_IRIREF = /[<>"{}|^`\\\u0000-\u0020]/u;

/**
 * The number of IRIs to look up in a single query.
 *
 * A lookup query returns every label, note and related term of every IRI it is given, so its result
 * grows fast with the size of the batch. Sources cannot take an unbounded one: Getty answers a
 * 60-IRI batch with an HTTP 500, and a source that does answer runs into the query’s result limit,
 * which drops the IRIs that did not fit – reported to the caller as NotFoundError, the one outcome
 * a client is entitled to remember.
 */
const LOOKUP_BATCH_SIZE = 25;

function batched<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
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
    // Dropped rather than rejected, so one malformed IRI does not fail a batch: the caller gets the
    // same not-found result as for an IRI that matches no dataset.
    const queryableIris = iris.filter((iri) => !FORBIDDEN_IN_IRIREF.test(iri));

    const irisByQueriedDataset = new Map<Dataset, IRI[]>();
    for (const iri of queryableIris) {
      const dataset = this.catalog.getDatasetByTermIri(iri);
      if (dataset === undefined) continue;
      const bucket = irisByQueriedDataset.get(dataset) ?? [];
      bucket.push(iri);
      irisByQueriedDataset.set(dataset, bucket);
    }

    // Query each dataset for its own IRIs only, in batches of LOOKUP_BATCH_SIZE.
    const responses = await Promise.all(
      [...irisByQueriedDataset.entries()].flatMap(
        ([queriedDataset, datasetIris]) =>
          batched(datasetIris, LOOKUP_BATCH_SIZE).map(
            async (batch) =>
              [
                queriedDataset,
                batch,
                await this.queryService.lookup(
                  batch,
                  queriedDataset.distributions[0],
                  timeoutMs,
                ),
              ] as const,
          ),
      ),
    );

    const resultsByIri = new Map<string, LookupQueryResult>();

    for (const [queriedDataset, , response] of responses) {
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

    for (const [queriedDataset, batch, response] of responses) {
      for (const iri of batch) {
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
