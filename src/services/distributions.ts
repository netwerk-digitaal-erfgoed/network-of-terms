import { CatalogService } from './catalog';
import { Term } from './terms';
import { QueryService } from './query';
import * as Joi from '@hapi/joi';
import * as Logger from '../helpers/logger';
import * as Pino from 'pino';

export interface ConstructorOptions {
  logLevel: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
});

export interface QueryOptions {
  distributionId: string;
  searchTerms: string;
}

const schemaQuery = Joi.object({
  distributionId: Joi.string().required(),
  searchTerms: Joi.string().required(),
});

export interface QueryAllOptions {
  distributionIds: string[];
  searchTerms: string;
}

const schemaQueryAll = Joi.object({
  distributionIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required(),
  searchTerms: Joi.string().required(),
});

export class DistributionsService {
  protected logger: Pino.Logger;
  protected catalogService: CatalogService;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = Logger.getLogger({
      name: this.constructor.name,
      level: args.logLevel,
    });
    this.catalogService = new CatalogService({
      logLevel: args.logLevel,
    });
  }

  async query(options: QueryOptions): Promise<Term[]> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(
      `Preparing to query distribution "${args.distributionId}"...`
    );
    const accessService = await this.catalogService.getAccessServiceByDistributionId(
      args.distributionId
    );
    if (accessService === null) {
      throw Error(
        `Access service of distribution "${args.distributionId}" not found in catalog`
      );
    }

    const queryService = new QueryService({
      logLevel: this.logger.level,
      accessServiceType: accessService.accessServiceType,
      endpointUrl: accessService.endpointUrl,
      searchTerms: args.searchTerms,
      query: accessService.query,
    });
    return queryService.run();
  }

  async queryAll(options: QueryAllOptions): Promise<Term[][]> {
    const args = Joi.attempt(options, schemaQueryAll);
    const distributionIds = args.distributionIds;
    const requests = distributionIds.map((distributionId: string) =>
      this.query({ distributionId, searchTerms: args.searchTerms })
    );
    return Promise.all(requests);
  }
}
