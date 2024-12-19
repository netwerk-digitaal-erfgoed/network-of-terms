import {QueryEngine} from '@comunica/query-sparql';
import Joi from 'joi';
import Pino from 'pino';
import {QueryTermsService, TermsResponse} from './query.js';
import {QueryMode} from './search/query-mode.js';
import {Catalog, IRI} from './catalog.js';
import {comunica} from './index.js';
import {clientQueriesCounter} from './instrumentation.js';

interface BaseQueryOptions {
  query: string;
  queryMode: QueryMode;
  limit: number;
  timeoutMs: number;
}

export interface QueryOptions extends BaseQueryOptions {
  source: IRI;
}

export interface QueryAllOptions extends BaseQueryOptions {
  sources: IRI[];
}

const schemaBase = Joi.object({
  query: Joi.string().required(),
  queryMode: Joi.string().required(),
  limit: Joi.number().integer(),
  timeoutMs: Joi.number().integer(),
});

const schemaQuery = schemaBase.append({
  source: Joi.object().required(),
});

const schemaQueryAll = schemaBase.append({
  sources: Joi.array().items(Joi.object().required()).min(1).required(),
});

export class DistributionsService {
  private logger: Pino.Logger;
  private catalog: Catalog;
  private comunica: QueryEngine;

  constructor(options: {
    logger: Pino.Logger;
    catalog: Catalog;
    comunica?: QueryEngine;
  }) {
    this.logger = options.logger;
    this.catalog = options.catalog;
    this.comunica = options.comunica || comunica;
  }

  async query(options: QueryOptions): Promise<TermsResponse> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(`Preparing to query source "${args.source}"...`);
    const dataset = this.catalog.getDatasetByIri(args.source);
    if (dataset === undefined) {
      throw Error(`Source with URI "${args.source}" not found`);
    }
    const distribution = dataset.getSparqlDistribution()!;
    const queryService = new QueryTermsService({
      logger: this.logger,
      comunica: this.comunica,
    });
    return queryService.search(
      args.query,
      args.queryMode,
      dataset,
      distribution,
      args.limit,
      args.timeoutMs
    );
  }

  async queryAll(options: QueryAllOptions): Promise<TermsResponse[]> {
    const args = Joi.attempt(options, schemaQueryAll);
    clientQueriesCounter.add(1, {
      numberOfSources: args.sources.length,
      type: 'search',
    });
    const requests = args.sources.map((source: IRI) =>
      this.query({
        source,
        query: args.query,
        queryMode: args.queryMode,
        limit: args.limit,
        timeoutMs: args.timeoutMs,
      })
    );
    return Promise.all(requests);
  }
}
