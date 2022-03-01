import {ActorInitSparql} from '@comunica/actor-init-sparql';
import Joi from 'joi';
import Pino from 'pino';
import {QueryTermsService, TermsResult} from './query';
import {QueryMode} from './search/query-mode';
import {Catalog, IRI} from './catalog';
import {comunica} from './index';

export interface QueryOptions {
  source: IRI;
  query: string;
  queryMode: QueryMode;
  timeoutMs: number;
}

const schemaQuery = Joi.object({
  source: Joi.object().required(),
  query: Joi.string().required(),
  queryMode: Joi.string().required(),
  timeoutMs: Joi.number().integer(),
});

export interface QueryAllOptions {
  sources: IRI[];
  query: string;
  queryMode: QueryMode;
  timeoutMs: number;
}

const schemaQueryAll = Joi.object({
  sources: Joi.array().items(Joi.object().required()).min(1).required(),
  query: Joi.string().required(),
  queryMode: Joi.string().required(),
  timeoutMs: Joi.number().integer(),
});

export class DistributionsService {
  private logger: Pino.Logger;
  private catalog: Catalog;
  private comunica: ActorInitSparql;

  constructor(options: {
    logger: Pino.Logger;
    catalog: Catalog;
    comunica?: ActorInitSparql;
  }) {
    this.logger = options.logger;
    this.catalog = options.catalog;
    this.comunica = options.comunica || comunica;
  }

  async query(options: QueryOptions): Promise<TermsResult> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(`Preparing to query source "${args.source}"...`);
    const dataset = await this.catalog.getDatasetByDistributionIri(args.source);
    if (dataset === undefined) {
      throw Error(`Source with URI "${args.source}" not found`);
    }
    const distribution = dataset.getDistributionByIri(args.source)!;
    const queryService = new QueryTermsService({
      logger: this.logger,
      comunica: this.comunica,
    });
    return queryService.search(
      args.query,
      args.queryMode,
      dataset,
      distribution,
      args.timeoutMs
    );
  }

  async queryAll(options: QueryAllOptions): Promise<TermsResult[]> {
    const args = Joi.attempt(options, schemaQueryAll);
    const requests = args.sources.map((source: IRI) =>
      this.query({
        source,
        query: args.query,
        queryMode: args.queryMode,
        timeoutMs: args.timeoutMs,
      })
    );
    return Promise.all(requests);
  }
}
