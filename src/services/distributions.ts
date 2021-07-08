import * as Joi from '@hapi/joi';
import Pino from 'pino';
import {QueryTermsService, TermsResult} from './query';
import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
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
  source: IRI;
  query: string;
  timeoutMs: number;
}

const schemaQuery = Joi.object({
  source: Joi.object().required(),
  query: Joi.string().required(),
  timeoutMs: Joi.number().integer(),
});

export interface QueryAllOptions {
  sources: IRI[];
  query: string;
  timeoutMs: number;
}

const schemaQueryAll = Joi.object({
  sources: Joi.array().items(Joi.object().required()).min(1).required(),
  query: Joi.string().required(),
  timeoutMs: Joi.number().integer(),
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
      distribution,
      query: args.query,
      timeoutMs: args.timeoutMs,
    });
    return queryService.run();
  }

  async queryAll(options: QueryAllOptions): Promise<TermsResult[]> {
    const args = Joi.attempt(options, schemaQueryAll);
    const requests = args.sources.map((source: IRI) =>
      this.query({source, query: args.query, timeoutMs: args.timeoutMs})
    );
    return Promise.all(requests);
  }
}
