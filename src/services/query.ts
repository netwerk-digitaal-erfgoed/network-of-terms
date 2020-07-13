import { AccessService } from './catalog';
import { ActorInitSparql } from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import * as ComunicaSparql from '@comunica/actor-init-sparql';
import * as Hoek from '@hapi/hoek';
import * as Joi from '@hapi/joi';
import { literal } from '@rdfjs/data-model';
import * as Logger from '../helpers/logger';
import { LoggerPino } from '../helpers/logger-pino';
import * as Pino from 'pino';
import * as PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';
import { Term, TermsTransformer } from './terms';

export interface ConstructorOptions {
  logLevel: string;
  accessService: AccessService;
  searchTerms: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
  accessService: Joi.object().required(),
  searchTerms: Joi.string().required(),
});

export interface QueryResult {
  accessService: AccessService;
  terms: Term[];
}

export class QueryService {
  protected logger: Pino.Logger;
  protected accessService: AccessService;
  protected searchTerms: string;
  protected engine: ActorInitSparql;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = Logger.getLogger({
      name: this.constructor.name,
      level: args.logLevel,
    });
    this.accessService = args.accessService;
    this.searchTerms = args.searchTerms;
    this.engine = ComunicaSparql.newEngine();
  }

  // tslint:disable-next-line:no-any
  protected getConfig(): any {
    const logger = new LoggerPino({ logger: this.logger });
    const config = {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: this.accessService.endpointUrl,
        },
      ],
      initialBindings: Bindings({
        '?searchTerms': literal(this.searchTerms),
      }),
    };
    return config;
  }

  async run(): Promise<QueryResult> {
    this.logger.info(
      `Querying "${this.accessService.endpointUrl}" with search query "${this.searchTerms}"...`
    );
    const config = this.getConfig();
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.accessService.query,
      config
    )) as IActorQueryOperationOutputQuads;

    return new Promise((resolve, reject) => {
      const termsTransformer = new TermsTransformer();
      result.quadStream.on('error', reject);
      result.quadStream.on('data', (quad: RDF.Quad) =>
        termsTransformer.fromQuad(quad)
      );
      result.quadStream.on('end', () => {
        const terms = termsTransformer.asArray();
        this.logger.info(
          `Found ${terms.length} terms matching search query "${
            this.searchTerms
          }" in "${this.accessService.endpointUrl}" in ${PrettyMilliseconds(
            timer.elapsed()
          )}`
        );
        resolve({ accessService: this.accessService, terms });
      });
    });
  }
}
