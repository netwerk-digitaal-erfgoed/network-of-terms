import { CatalogService } from './catalog';
import * as Joi from '@hapi/joi';
import Pino from 'pino';
import { QueryResult, QueryTermsService } from './query';

export interface ConstructorOptions {
  logger: Pino.Logger;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
});

export interface QueryOptions {
  distributionId: string;
  query: string;
}

const schemaQuery = Joi.object({
  distributionId: Joi.string().required(),
  query: Joi.string().required(),
});

export interface QueryAllOptions {
  distributionIds: string[];
  query: string;
}

const schemaQueryAll = Joi.object({
  distributionIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required(),
  query: Joi.string().required(),
});

export class DistributionsService {
  protected logger: Pino.Logger;
  protected catalogService: CatalogService;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.catalogService = new CatalogService({ logger: args.logger });
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(`Preparing to query source "${args.distributionId}"...`);
    const accessService = await this.catalogService.getAccessServiceByDistributionId(
      args.distributionId
    );
    if (accessService === null) {
      throw Error(
        `Access service of source "${args.distributionId}" not found in catalog`
      );
    }

    const queryService = new QueryTermsService({
      logger: this.logger,
      accessService,
      query: args.query,
    });
    return queryService.run();
  }

  async queryAll(options: QueryAllOptions): Promise<QueryResult[]> {
    const args = Joi.attempt(options, schemaQueryAll);
    const distributionIds = args.distributionIds;
    const requests = distributionIds.map((distributionId: string) =>
      this.query({ distributionId, query: args.query })
    );
    return Promise.all(requests);
  }
}
