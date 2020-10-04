import {
  ActorInitSparql,
  IActorInitSparqlArgs,
} from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import * as Hoek from '@hapi/hoek';
import * as Joi from '@hapi/joi';
import {literal} from '@rdfjs/data-model';
import {LoggerPino} from '../helpers/logger-pino';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';
import {Term, TermsTransformer} from './terms';
import {Distribution} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export interface ConstructorOptions {
  logger: Pino.Logger;
  distribution: Distribution;
  query: string;
  comunica: IActorInitSparqlArgs;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  distribution: Joi.object().required(),
  query: Joi.string().required(),
  comunica: Joi.object().required(),
});

export interface QueryResult {
  distribution: Distribution;
  terms: Term[];
}

export class QueryTermsService {
  protected logger: Pino.Logger;
  protected distribution: Distribution;
  protected query: string;
  protected engine: ActorInitSparql;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.distribution = args.distribution;
    this.query = args.query;
    this.engine = args.comunica;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getConfig(): any {
    const logger = new LoggerPino({logger: this.logger});
    const config = {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: this.distribution.endpoint,
        },
      ],
      initialBindings: Bindings({
        '?query': literal(this.query),
      }),
    };
    return config;
  }

  async run(): Promise<QueryResult> {
    this.logger.info(
      `Querying "${this.distribution.endpoint}" with "${this.query}"...`
    );
    const config = this.getConfig();
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.distribution.query,
      config
    )) as IActorQueryOperationOutputQuads;

    return new Promise(resolve => {
      const termsTransformer = new TermsTransformer();
      result.quadStream.on('error', (error: Error) => {
        this.logger.error(
          `An error occurred when querying "${this.distribution.endpoint}": ${error}`
        );
        resolve({distribution: this.distribution, terms: []});
      });
      result.quadStream.on('data', (quad: RDF.Quad) =>
        termsTransformer.fromQuad(quad)
      );
      result.quadStream.on('end', () => {
        const terms = termsTransformer.asArray();
        this.logger.info(
          `Found ${terms.length} terms matching "${this.query}" in "${
            this.distribution.endpoint
          }" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        resolve({distribution: this.distribution, terms});
      });
    });
  }
}
