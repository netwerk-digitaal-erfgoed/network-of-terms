import * as Hoek from '@hapi/hoek';
import Joi from 'joi';
import { createLoggingFetch } from './helpers/logging-fetch.js';
import { LoggerPino } from './helpers/logger-pino.js';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from '@rdfjs/types';
import { Term, TermsTransformer } from './terms.js';
import { QueryMode, queryVariants } from './search/query-mode.js';
import { Dataset, Distribution, IRI } from './catalog.js';
import { QueryEngine } from '@comunica/query-sparql';
import { BindingsFactory } from '@comunica/utils-bindings-factory';
import { DataFactory } from 'rdf-data-factory';
import { sourceQueriesHistogram } from './instrumentation.js';
import { config } from './config.js';

export type TermsResult = Terms | TimeoutError | ServerError;

export class TermsResponse {
  constructor(
    readonly result: TermsResult,
    readonly responseTimeMs: number,
  ) {}
}

export class Terms {
  constructor(
    readonly distribution: Distribution,
    readonly terms: Term[],
  ) {}
}

export class Error {
  constructor(
    readonly distribution: Distribution,
    readonly message: string,
  ) {}
}

export class TimeoutError extends Error {
  constructor(
    override readonly distribution: Distribution,
    timeoutMs: number,
  ) {
    super(distribution, `Source timed out after ${timeoutMs}ms`);
  }
}

export class ServerError extends Error {}

export interface BuildSearchQueryOptions {
  /** The dataset to query. */
  dataset: Dataset;
  /** The distribution whose search query template to use. */
  distribution: Distribution;
  /** The search term to bind. */
  searchTerm: string;
  /** Query mode for search term processing. */
  queryMode: QueryMode;
  /** Limit for results. */
  limit: number;
  /** Genres requested by the caller; filtered against dataset genres. */
  requestedGenres?: IRI[];
}

export interface BuildSearchQueryResult {
  /** The query with #LIMIT# replaced and ?genres parameterized (if applicable). */
  query: string;
  /** Bindings for SPARQL variables (?query, ?virtuosoQuery, ?datasetUri, ?limit). */
  bindings: Record<string, RDF.Term>;
}

/**
 * Build a SPARQL query and bindings from a template.
 * Returns the query with #LIMIT# replaced and a set of bindings for variables.
 * The bindings can be used with Comunica's initialBindings or serialized into the query.
 */
export function buildSearchQuery(
  options: BuildSearchQueryOptions,
): BuildSearchQueryResult {
  const variants = queryVariants(options.searchTerm, options.queryMode);

  // Replace #LIMIT# placeholder and parameterize genres
  let query = options.distribution.searchQuery.replace(
    '#LIMIT#',
    `LIMIT ${options.limit}`,
  );
  query = parameterizeGenres(
    query,
    options.requestedGenres,
    options.dataset.genres,
  );

  // Only bind variables that actually appear in the query
  const bindings: Record<string, RDF.Term> = {};
  for (const [varName, value] of variants) {
    if (query.includes(`?${varName}`)) {
      bindings[varName] = dataFactory.literal(value);
    }
  }
  if (query.includes('?datasetUri')) {
    bindings['datasetUri'] = dataFactory.namedNode(
      options.dataset.iri.toString(),
    );
  }
  if (query.includes('?limit')) {
    bindings['limit'] = dataFactory.literal(
      options.limit.toString(),
      dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'),
    );
  }

  return { query, bindings };
}

export function parameterizeGenres(
  query: string,
  requestedGenres: IRI[] | undefined,
  datasetGenres: IRI[],
): string {
  if (!query.includes('?genres')) {
    return query;
  }

  const datasetGenreSet = new Set(datasetGenres);
  const validGenres =
    requestedGenres?.filter((genre) => datasetGenreSet.has(genre)) ?? [];
  const effectiveGenres = validGenres.length > 0 ? validGenres : datasetGenres;

  return query.replaceAll(
    '?genres',
    effectiveGenres.map((iri) => `<${iri}>`).join(' '),
  );
}

export class QueryTermsService {
  private readonly logger: Pino.Logger;
  private readonly engine: QueryEngine;
  private readonly fetch: typeof fetch;

  constructor(options: { comunica?: QueryEngine; logger?: Pino.Logger } = {}) {
    this.engine = options.comunica || new QueryEngine();
    this.logger = options.logger || Pino.pino();
    this.fetch = createLoggingFetch(this.logger);
  }

  async search(
    searchQuery: string,
    queryMode: QueryMode,
    dataset: Dataset,
    distribution: Distribution,
    limit: number,
    timeoutMs: number,
    genres?: IRI[],
  ): Promise<TermsResponse> {
    const { query, bindings } = buildSearchQuery({
      dataset,
      distribution,
      searchTerm: searchQuery,
      queryMode,
      limit,
      requestedGenres: genres,
    });

    return this.run(query, distribution, timeoutMs, bindings);
  }

  async lookup(iris: IRI[], distribution: Distribution, timeoutMs: number) {
    return this.run(
      distribution.lookupQuery.replace(
        '?uris',
        iris.map((iri) => `<${iri}>`).join(' '),
      ),
      distribution,
      timeoutMs,
    );
  }

  async run(
    query: string,
    distribution: Distribution,
    timeoutMs: number,
    bindings: Record<string, RDF.Term> = {},
  ): Promise<TermsResponse> {
    Joi.attempt(
      timeoutMs,
      Joi.number()
        .integer()
        .min(1)
        .max(config.MAX_QUERY_TIMEOUT)
        .default(config.DEFAULT_QUERY_TIMEOUT),
    );

    const timer = new Hoek.Bench();
    const logger = new LoggerPino({ logger: this.logger });
    // Extract HTTP credentials if the distribution URL contains any.
    const url = new URL(distribution.endpoint.toString());
    this.logger.info(`Querying "${url}" with "${query}"...`);
    const quadStream = await this.engine.queryQuads(query, {
      log: logger,
      fetch: this.fetch,
      httpAuth:
        url.username === '' ? undefined : url.username + ':' + url.password,
      httpTimeout: timeoutMs,
      noCache: true,
      sources: [
        {
          type: 'sparql',
          value: url.origin + url.pathname,
        },
      ],
      initialBindings: bindingsFactory.fromRecord(bindings),
    });

    return new Promise((resolve) => {
      const termsTransformer = new TermsTransformer();
      quadStream.on('error', (error) => {
        const elapsed = Math.round(timer.elapsed());
        this.logger.error(
          `An error occurred when querying "${distribution.endpoint}": ${error} with %o`,
          error,
        );

        if (error.message.startsWith('Fetch timed out')) {
          sourceQueriesHistogram.record(Math.round(timer.elapsed()), {
            distribution: distribution.iri.toString(),
            error: 'TimeoutError',
          });
          resolve(
            new TermsResponse(
              new TimeoutError(distribution, timeoutMs),
              elapsed,
            ),
          );
        } else {
          sourceQueriesHistogram.record(Math.round(timer.elapsed()), {
            distribution: distribution.iri.toString(),
            error: 'ServerError',
          });
          resolve(
            new TermsResponse(
              new ServerError(
                distribution,
                obfuscateHttpCredentials(error.message),
              ),
              elapsed,
            ),
          );
        }
      });
      quadStream.on('data', (quad: RDF.Quad) => {
        termsTransformer.fromQuad(quad);
      });
      quadStream.on('end', () => {
        const terms = termsTransformer
          .asArray()
          .sort(byScoreThenAlphabetically);
        this.logger.info(
          `Found ${terms.length} terms matching "${query}" in "${
            distribution.endpoint
          }" in ${PrettyMilliseconds(timer.elapsed())}`,
        );
        sourceQueriesHistogram.record(Math.round(timer.elapsed()), {
          distribution: distribution.iri.toString(),
        });
        resolve(
          new TermsResponse(
            new Terms(distribution, terms),
            Math.round(timer.elapsed()),
          ),
        );
      });
    });
  }
}

const byScoreThenAlphabetically = (a: Term, b: Term) => {
  const scoreA = parseFloat(a.score?.value ?? '0');
  const scoreB = parseFloat(b.score?.value ?? '0');
  if (scoreA === scoreB) {
    return alphabeticallyByLabels(a, b);
  } else {
    return scoreA < scoreB ? 1 : -1;
  }
};

const alphabeticallyByLabels = (a: Term, b: Term) => {
  const prefLabelA = a.prefLabels[0]?.value ?? '';
  const altLabelA = a.altLabels[0]?.value ?? '';
  const sortLabelA = prefLabelA + altLabelA;
  const prefLabelB = b.prefLabels[0]?.value ?? '';
  const altLabelB = b.altLabels[0]?.value ?? '';
  const sortLabelB = prefLabelB + altLabelB;
  return sortLabelA.localeCompare(sortLabelB);
};

const dataFactory = new DataFactory();
const bindingsFactory = new BindingsFactory(dataFactory);

const obfuscateHttpCredentials = (message: string) =>
  message.replace(/(https?):\/\/.+:.+@/, '$1://***@');
