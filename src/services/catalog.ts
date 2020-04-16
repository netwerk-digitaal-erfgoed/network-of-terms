import { ActorInitSparql } from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import { Bindings } from '@comunica/bus-query-operation';
import { literal } from '@rdfjs/data-model';
import { LoggerPino } from '../helpers/logger-pino';
import { storeStream } from 'rdf-store-stream';
import * as Comunica from '@comunica/actor-init-sparql-rdfjs';
import * as Fs from 'fs';
import * as Joi from '@hapi/joi';
import * as Logger from '../helpers/logger';
import * as Path from 'path';
import * as Pino from 'pino';
import RdfParser from 'rdf-parse';

export interface ConstructorOptions {
  logLevel: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
});

export interface Distribution {
  distribution: string;
  distributionId: string;
  distributionTitle: string;
  datasetTitle: string;
}

export interface AccessService {
  distribution: string;
  distributionId: string;
  accessServiceType: string;
  endpointUrl: string;
  query: string;
}

export class CatalogService {
  protected logger: Pino.Logger;
  protected engine: ActorInitSparql;
  protected catalogFile = Path.resolve('./configs/catalog.ttl'); // Hard-coded for now

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = Logger.getLogger({
      name: this.constructor.name,
      level: args.logLevel,
    });
    this.engine = Comunica.newEngine();
  }

  // tslint:disable-next-line:no-any
  async getConfig(): Promise<any> {
    this.logger.info(
      `Processing distributions in file "${this.catalogFile}"...`
    );
    const quadStream = RdfParser.parse(Fs.createReadStream(this.catalogFile), {
      path: this.catalogFile,
    });
    const store = await storeStream(quadStream);
    const logger = new LoggerPino({ logger: this.logger });
    const config = {
      log: logger,
      sources: [
        {
          type: 'rdfjsSource',
          value: store,
        },
      ],
    };
    return config;
  }

  async listDistributions(): Promise<Distribution[]> {
    const config = await this.getConfig();
    this.logger.info(`Listing distributions...`);
    const query = `
      PREFIX dcat: <http://www.w3.org/ns/dcat#>
      SELECT * WHERE {
        ?distribution a dcat:Distribution .
        ?distribution dcterms:title ?distributionTitle .
        ?distribution dcterms:identifier ?distributionId .
        ?dataset a dcat:Dataset .
        ?dataset dcat:distribution ?distribution .
        ?dataset dcterms:title ?datasetTitle
      }
      ORDER BY LCASE(?distributionTitle)
    `;

    const result = await this.engine.query(query, config);
    const distributions: Distribution[] = [];

    return new Promise((resolve, reject) => {
      result.bindingsStream.on('error', reject);
      // tslint:disable-next-line:no-any
      result.bindingsStream.on('data', (bindings: any) => {
        distributions.push({
          distribution: bindings.get('?distribution').value,
          distributionId: bindings.get('?distributionId').value,
          distributionTitle: bindings.get('?distributionTitle').value,
          datasetTitle: bindings.get('?datasetTitle').value,
        });
      });
      result.bindingsStream.on('end', () => {
        this.logger.info(`Found ${distributions.length} distributions`);
        resolve(distributions);
      });
    });
  }

  async getAccessServiceByDistribution(
    distributionId: string
  ): Promise<AccessService | null> {
    const config = await this.getConfig();
    this.logger.info(
      `Retrieving access service of distribution "${distributionId}"...`
    );
    config.initialBindings = Bindings({
      '?distributionId': literal(distributionId),
    });
    const query = `
      PREFIX dcat: <http://www.w3.org/ns/dcat#>
      SELECT * WHERE {
        ?distribution a dcat:Distribution .
        ?distribution dcterms:identifier ?distributionId .
        ?distribution dcat:accessService ?accessService .
        ?accessService dcterms:type ?accessServiceType .
        ?accessService dcat:endpointURL ?endpointUrl .
        ?accessService schema:potentialAction/schema:query ?query .
      }
      LIMIT 1
    `;

    const result = await this.engine.query(query, config);
    let accessService: AccessService;

    return new Promise((resolve, reject) => {
      result.bindingsStream.on('error', reject);
      // tslint:disable-next-line:no-any
      result.bindingsStream.on('data', (bindings: any) => {
        accessService = {
          distribution: bindings.get('?distribution').value,
          distributionId,
          accessServiceType: bindings.get('?accessServiceType').value,
          endpointUrl: bindings.get('?endpointUrl').value,
          query: bindings.get('?query').value,
        };
      });
      result.bindingsStream.on('end', () => resolve(accessService || null));
    });
  }
}
