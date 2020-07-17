import { ActorInitSparql } from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputBindings,
} from '@comunica/bus-query-operation';
import * as Comunica from '@comunica/actor-init-sparql-rdfjs';
import * as Fs from 'fs';
import * as Joi from '@hapi/joi';
import { literal } from '@rdfjs/data-model';
import { LoggerPino } from '../helpers/logger-pino';
import * as Path from 'path';
import Pino from 'pino';
import * as RDF from 'rdf-js';
import RdfParser from 'rdf-parse';
import { storeStream } from 'rdf-store-stream';

export interface ConstructorOptions {
  logger: Pino.Logger;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
});

export interface Distribution {
  distributionId: RDF.Term;
  distributionTitle: RDF.Term;
  datasetTitle: RDF.Term;
}

export interface AccessService {
  distribution: Distribution;
  endpointUrl: string;
  query: string;
}

export class CatalogService {
  protected logger: Pino.Logger;
  protected engine: ActorInitSparql;
  protected catalogFile = Path.resolve('./configs/catalog.ttl'); // Hard-coded for now

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.engine = Comunica.newEngine();
  }

  // tslint:disable-next-line:no-any
  async getConfig(): Promise<any> {
    this.logger.info(`Processing sources in file "${this.catalogFile}"...`);
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

    const result = (await this.engine.query(
      query,
      config
    )) as IActorQueryOperationOutputBindings;

    return new Promise((resolve, reject) => {
      const distributions: Distribution[] = [];
      result.bindingsStream.on('error', reject);
      result.bindingsStream.on('data', (bindings: Bindings) => {
        distributions.push({
          distributionId: bindings.get('?distributionId'),
          distributionTitle: bindings.get('?distributionTitle'),
          datasetTitle: bindings.get('?datasetTitle'),
        });
      });
      result.bindingsStream.on('end', () => {
        this.logger.info(`Found ${distributions.length} sources`);
        resolve(distributions);
      });
    });
  }

  async getAccessServiceByDistributionId(
    distributionId: string
  ): Promise<AccessService | null> {
    const config = await this.getConfig();
    this.logger.info(
      `Retrieving access service of source "${distributionId}"...`
    );
    config.initialBindings = Bindings({
      '?distributionId': literal(distributionId),
    });
    const query = `
      PREFIX dcat: <http://www.w3.org/ns/dcat#>
      SELECT * WHERE {
        BIND(?distributionId AS ?distrId) .
        ?distribution a dcat:Distribution .
        ?distribution dcterms:title ?distributionTitle .
        ?distribution dcterms:identifier ?distributionId .
        ?distribution dcat:accessService ?accessService .
        ?accessService dcat:endpointURL ?endpointUrl .
        ?accessService schema:potentialAction/schema:query ?query .
        ?dataset a dcat:Dataset .
        ?dataset dcat:distribution ?distribution .
        ?dataset dcterms:title ?datasetTitle
      }
      LIMIT 1
    `;

    const result = (await this.engine.query(
      query,
      config
    )) as IActorQueryOperationOutputBindings;

    const promise: Promise<AccessService | null> = new Promise(
      (resolve, reject) => {
        let accessService: AccessService;
        result.bindingsStream.on('error', reject);
        result.bindingsStream.on('data', (bindings: Bindings) => {
          accessService = {
            distribution: {
              distributionId: bindings.get('?distrId'), // As RDF.Term
              distributionTitle: bindings.get('?distributionTitle'),
              datasetTitle: bindings.get('?datasetTitle'),
            },
            endpointUrl: bindings.get('?endpointUrl').value, // As string
            query: bindings.get('?query').value, // As string
          };
        });
        result.bindingsStream.on('end', () => resolve(accessService || null));
      }
    );

    const accessService = await promise;

    // "query" can be a string or a file path - if the latter, load from file
    if (accessService && accessService.query.startsWith('file://')) {
      const queryFile = Path.resolve(accessService.query.substr(7));
      this.logger.info(`Reading query from file "${queryFile}"...`);
      accessService.query = await Fs.promises.readFile(queryFile, 'utf-8');
    }

    return accessService;
  }
}
