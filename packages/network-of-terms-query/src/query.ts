import * as Hoek from '@hapi/hoek';
import Joi from 'joi';
import {LoggerPino} from './helpers/logger-pino.js';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from '@rdfjs/types';
import {Bindings} from '@rdfjs/types';
import {Term, TermsTransformer} from './terms.js';
import {QueryMode, queryVariants} from './search/query-mode.js';
import {Dataset, Distribution, IRI} from './catalog.js';
import {QueryEngine} from '@comunica/query-sparql';
import {BindingsFactory} from '@comunica/utils-bindings-factory';
import {DataFactory} from 'rdf-data-factory';
import {sourceQueriesHistogram} from './instrumentation.js';
import {config} from './config.js';

export type TermsResult = Terms | TimeoutError | ServerError;

export class TermsResponse {
  constructor(
    readonly result: TermsResult,
    readonly responseTimeMs: number
  ) {}
}

export class Terms {
  constructor(
    readonly distribution: Distribution,
    readonly terms: Term[]
  ) {}
}

export class Error {
  constructor(
    readonly distribution: Distribution,
    readonly message: string
  ) {}
}

export class TimeoutError extends Error {
  constructor(
    readonly distribution: Distribution,
    timeoutMs: number
  ) {
    super(distribution, `Source timed out after ${timeoutMs}ms`);
  }
}

export class ServerError extends Error {}

export class QueryTermsService {
  private readonly logger: Pino.Logger;
  private readonly engine: QueryEngine;

  constructor(options: {comunica?: QueryEngine; logger?: Pino.Logger} = {}) {
    this.engine = options.comunica || new QueryEngine();
    this.logger = options.logger || Pino.pino();
  }

  /**
   * Parameterize the SPARQL query’s limit in two ways:
   * - as a pre-bound variable ?limit (for GraphDB’s luc:limit, Wikidata and text:query);
   * - by replacing the #LIMIT# placeholder (for LIMIT 123).
   */
  parameterizeLimit(args: {
    query: string;
    bindings: Record<string, RDF.Term>;
    limit: number;
  }): {queryWithLimit: string; bindingsWithLimit: Record<string, RDF.Term>} {
    return {
      queryWithLimit: args.query.replace('#LIMIT#', `LIMIT ${args.limit}`),
      bindingsWithLimit: {
        ...args.bindings,
        limit: dataFactory.literal(
          args.limit.toString(),
          dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')
        ),
      },
    };
  }

  async search(
    searchQuery: string,
    queryMode: QueryMode,
    dataset: Dataset,
    distribution: Distribution,
    limit: number,
    timeoutMs: number
  ): Promise<TermsResponse> {
    const bindings = [...queryVariants(searchQuery, queryMode)].reduce(
      (record: Record<string, RDF.Term>, [k, v]) => {
        record[k] = dataFactory.literal(v);
        return record;
      },
      {}
    );
    bindings['datasetUri'] = dataFactory.namedNode(dataset.iri.toString());

    const {queryWithLimit, bindingsWithLimit} = this.parameterizeLimit({
      query: distribution.searchQuery,
      bindings,
      limit,
    });

    return this.run(
      // For plain SPARQL LIMIT (LIMIT 123) that cannot be pre-bound
      queryWithLimit,
      distribution,
      timeoutMs,
      bindingsWithLimit
    );
  }

  async lookup(iris: IRI[], distribution: Distribution, timeoutMs: number) {
    return this.run(
      distribution.lookupQuery.replace(
        '?uris',
        iris.map(iri => `<${iri}>`).join(' ')
      ),
      distribution,
      timeoutMs
    );
  }

  async run(
    query: string,
    distribution: Distribution,
    timeoutMs: number,
    bindings: Record<string, RDF.Term> = {}
  ): Promise<TermsResponse> {
    Joi.attempt(
      timeoutMs,
      Joi.number()
        .integer()
        .min(1)
        .max(config.MAX_QUERY_TIMEOUT)
        .default(config.DEFAULT_QUERY_TIMEOUT)
    );

    const timer = new Hoek.Bench();
    const logger = new LoggerPino({logger: this.logger});
    // Extract HTTP credentials if the distribution URL contains any.
    const url = new URL(distribution.endpoint.toString());
    this.logger.info(`Querying "${url}" with "${query}"...`);
    const quadStream = await this.engine.queryQuads(query, {
      log: logger,
      httpAuth: url.username === '' ? '' : url.username + ':' + url.password,
      httpTimeout: timeoutMs,
      sources: [
        {
          type: 'sparql',
          value: url.origin + url.pathname,
        },
      ],
      initialBindings: bindingsFactory.fromRecord(
        bindings
      ) as unknown as Bindings,
    });

    return new Promise(resolve => {
      const termsTransformer = new TermsTransformer();
      quadStream.on('error', error => {
        const elapsed = Math.round(timer.elapsed());
        this.logger.error(
          `An error occurred when querying "${distribution.endpoint}": ${error} with %o`,
          error
        );

        if (error.message.startsWith('Fetch timed out')) {
          sourceQueriesHistogram.record(Math.round(timer.elapsed()), {
            distribution: distribution.iri.toString(),
            error: 'TimeoutError',
          });
          resolve(
            new TermsResponse(
              new TimeoutError(distribution, timeoutMs),
              elapsed
            )
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
                obfuscateHttpCredentials(error.message)
              ),
              elapsed
            )
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
          }" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        sourceQueriesHistogram.record(Math.round(timer.elapsed()), {
          distribution: distribution.iri.toString(),
        });
        resolve(
          new TermsResponse(
            new Terms(distribution, terms),
            Math.round(timer.elapsed())
          )
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
