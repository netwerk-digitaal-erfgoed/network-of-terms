import * as Joi from '@hapi/joi';
import Pino from 'pino';
import {QueryResult, QueryTermsService} from './query';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export interface ConstructorOptions {
  logger: Pino.Logger;
  catalog: Catalog;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  catalog: Joi.object().required(),
});

export interface QueryOptions {
  source: string;
  query: string;
}

const schemaQuery = Joi.object({
  source: Joi.string().required(),
  query: Joi.string().required(),
});

export interface QueryAllOptions {
  sources: string[];
  query: string;
}

const schemaQueryAll = Joi.object({
  sources: Joi.array().items(Joi.string().required()).min(1).required(),
  query: Joi.string().required(),
});

export class DistributionsService {
  protected logger: Pino.Logger;
  protected catalog: Catalog;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.catalog = args.catalog;
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(`Preparing to query source "${args.source}"...`);
    const dataset = await this.catalog.getByIdentifier(args.source);
    if (dataset === undefined) {
      throw Error(
        `Source with identifier "${args.source}" not found in catalog`
      );
    }

    const queryService = new QueryTermsService({
      logger: this.logger,
      dataset,
      query: args.query,
    });
    return queryService.run();
  }

  async queryAll(options: QueryAllOptions): Promise<QueryResult[]> {
    const args = Joi.attempt(options, schemaQueryAll);
    const requests = args.sources.map((source: string) =>
      this.query({source, query: args.query})
    );
    return Promise.all(requests);
  }
}
