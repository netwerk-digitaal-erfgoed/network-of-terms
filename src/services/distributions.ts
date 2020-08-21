import * as Joi from '@hapi/joi';
import Pino from 'pino';
import {QueryResult, QueryTermsService} from './query';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {IActorInitSparqlArgs} from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';

export interface ConstructorOptions {
  logger: Pino.Logger;
  catalog: Catalog;
  comunica: IActorInitSparqlArgs;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  catalog: Joi.object().required(),
  comunica: Joi.object().required(),
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
  private logger: Pino.Logger;
  private catalog: Catalog;
  private comunica: IActorInitSparqlArgs;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.catalog = args.catalog;
    this.comunica = args.comunica;
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
      comunica: this.comunica,
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
