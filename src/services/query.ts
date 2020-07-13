import { ActorInitSparql } from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import { literal } from '@rdfjs/data-model';
import { LoggerPino } from '../helpers/logger-pino';
import { Term, TermsTransformer } from './terms';
import * as ComunicaSparql from '@comunica/actor-init-sparql';
import * as Hoek from '@hapi/hoek';
import * as Joi from '@hapi/joi';
import * as Logger from '../helpers/logger';
import * as Pino from 'pino';
import * as PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';

export interface ConstructorOptions {
  logLevel: string;
  endpointUrl: string;
  searchTerms: string;
  query: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
  endpointUrl: Joi.string().required(),
  searchTerms: Joi.string().required(),
  query: Joi.string().required(),
});

export class QueryService {
  protected logger: Pino.Logger;
  protected endpointUrl: string;
  protected searchTerms: string;
  protected query: string;
  protected engine: ActorInitSparql;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = Logger.getLogger({
      name: this.constructor.name,
      level: args.logLevel,
    });
    this.endpointUrl = args.endpointUrl;
    this.searchTerms = args.searchTerms;
    this.query = args.query;
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
          value: this.endpointUrl,
        },
      ],
      initialBindings: Bindings({
        '?searchTerms': literal(this.searchTerms),
      }),
    };
    return config;
  }

  async run(): Promise<Term[]> {
    this.logger.info(
      `Querying "${this.endpointUrl}" with search query "${this.searchTerms}"...`
    );
    const config = this.getConfig();
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.query,
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
          }" in "${this.endpointUrl}" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        resolve(terms);
      });
    });
  }
}
