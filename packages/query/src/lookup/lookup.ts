import { Catalog, Dataset, Distribution, IRI } from '../catalog.js';
import {
  Error,
  QueryTermsService,
  ServerError,
  Terms,
  TermsResponse,
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
 * grows fast with the size of the batch – faster than the batch itself, because the source plans
 * one query over all of them. Neither the query text nor any single IRI is the problem: 60 IRIs
 * make a 6 KB query, and each of the IRIs below answers on its own in about a second.
 *
 * What a source cannot take is the resulting amount of work. Getty answers a batch of 30 rich AAT
 * terms in a few seconds, but from around 36 it sends an HTTP 200, streams for 17 seconds and then
 * cuts the connection in the middle of a triple. A source that does answer runs into the query’s
 * result limit instead, which drops the IRIs that did not fit – reported to the caller as
 * NotFoundError, the one outcome a client is entitled to remember.
 *
 * 25 keeps a comfortable margin below where Getty, the least forgiving source measured, gives up.
 * It is a starting point rather than a fixed size: see batchSizes.
 */
const MAX_LOOKUP_BATCH_SIZE = 25;

/**
 * The batch size each source is currently answering, halved when it fails and doubled again when it
 * succeeds, between 1 and MAX_LOOKUP_BATCH_SIZE.
 *
 * A source's limit is not a property we can look up or configure once. Where it sits differs by two
 * orders of magnitude between sources, it is a cliff rather than a slope – EuroVoc answers 80 IRIs
 * in 1.2s and 100 in 143s – and it moves with how busy the source is. So rather than carry a number
 * per source in the catalog, which would be a measurement of one afternoon, each source's size is
 * learned from what it does and kept for the lifetime of the process.
 *
 * Doubling on success matters as much as halving on failure: without it, one outage would pin a
 * source at 1 IRI per query for as long as the process lived.
 */
const batchSizes = new Map<string, number>();

/** Only for tests, which would otherwise inherit the sizes a previous test taught us. */
export function forgetLookupBatchSizes(): void {
  batchSizes.clear();
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

    // Query each dataset for its own IRIs only, in batches of LOOKUP_BATCH_SIZE. The batches of one
    // dataset run one after another, so a large request stays a single query at a time per source
    // instead of the burst that would get us rate-limited; different sources are queried in
    // parallel, as before.
    //
    // timeoutMs is what the caller allows the whole lookup, so the batches share it as a deadline
    // rather than each getting the full amount: batching a request must not make it take longer
    // than the caller asked for.
    const deadline = Date.now() + timeoutMs;
    const responses = (
      await Promise.all(
        [...irisByQueriedDataset.entries()].map(
          async ([queriedDataset, datasetIris]) => {
            const distribution = queriedDataset.distributions[0];
            const source = distribution.iri.toString();
            const datasetResponses = [];
            let remaining = datasetIris;

            while (remaining.length > 0) {
              const size = batchSizes.get(source) ?? MAX_LOOKUP_BATCH_SIZE;
              const batch = remaining.slice(0, size);
              const remainingMs = deadline - Date.now();

              if (remainingMs <= 0) {
                datasetResponses.push([
                  queriedDataset,
                  batch,
                  new TermsResponse(new TimeoutError(distribution, timeoutMs), 0),
                ] as const);
                remaining = remaining.slice(batch.length);
                continue;
              }

              const response = await this.queryService.lookup(
                batch,
                distribution,
                remainingMs,
              );

              // A batch of several IRIs that fails may be one the source could not take, so halve
              // it and try again with what is left of the deadline. A batch of one has nothing left
              // to halve: that IRI gets the error.
              if (response.result instanceof Error && batch.length > 1) {
                batchSizes.set(source, Math.floor(batch.length / 2));
                continue;
              }

              if (!(response.result instanceof Error)) {
                batchSizes.set(
                  source,
                  Math.min(batch.length * 2, MAX_LOOKUP_BATCH_SIZE),
                );
              }

              datasetResponses.push([queriedDataset, batch, response] as const);
              remaining = remaining.slice(batch.length);
            }

            return datasetResponses;
          },
        ),
      )
    ).flat();

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
