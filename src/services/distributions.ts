import { CatalogService } from './catalog';
import { promises as Fs } from 'fs';
import { QueryService } from './query';
import * as Joi from '@hapi/joi';
import * as Logger from '../helpers/logger';
import * as Path from 'path';
import * as Pino from 'pino';

export interface ConstructorOptions {
  logLevel: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
});

export interface QueryOptions {
  distributionsIds: string[];
  searchTerm: string;
}

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

  async query(
    distributionId: string,
    searchTerm: string
  ): Promise<NodeJS.ReadableStream> {
    this.logger.info(`Preparing to query distribution "${distributionId}"...`);
    const accessService = await this.catalogService.getAccessServiceByDistribution(
      distributionId
    );
    if (accessService === null) {
      throw Error(
        `Access service of distribution "${distributionId}" not found in catalog`
      );
    }

    let sparqlQuery = accessService.query;
    if (accessService.query.startsWith('file://')) {
      const queryFile = Path.resolve(accessService.query.substr(7));
      this.logger.info(`Reading query from file "${queryFile}"...`);
      sparqlQuery = await Fs.readFile(queryFile, 'utf-8');
    }

    const queryService = new QueryService({
      logLevel: this.logger.level,
      accessServiceType: accessService.accessServiceType,
      endpointUrl: accessService.endpointUrl,
      searchTerm,
      sparqlQuery,
    });
    return queryService.query();
  }

  async queryAll(options: QueryOptions): Promise<NodeJS.ReadableStream[]> {
    const distributionsIds = options.distributionsIds;
    const requests = distributionsIds.map((distributionId: string) =>
      this.query(distributionId, options.searchTerm)
    );
    const results = await Promise.all(requests);
    return results;
  }
}
