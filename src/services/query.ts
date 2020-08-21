import {ActorInitSparql} from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import * as Comunica from '@comunica/actor-init-sparql';
import * as Hoek from '@hapi/hoek';
import * as Joi from '@hapi/joi';
import {literal} from '@rdfjs/data-model';
import {LoggerPino} from '../helpers/logger-pino';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';
import {Term, TermsTransformer} from './terms';
import {Dataset} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export interface ConstructorOptions {
  logger: Pino.Logger;
  dataset: Dataset;
  query: string;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  dataset: Joi.object().required(),
  query: Joi.string().required(),
});

export interface QueryResult {
  dataset: Dataset;
  terms: Term[];
}

export class QueryTermsService {
  protected logger: Pino.Logger;
  protected dataset: Dataset;
  protected query: string;
  protected engine: ActorInitSparql;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.dataset = args.dataset;
    this.query = args.query;
    this.engine = Comunica.newEngine();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getConfig(): any {
    const logger = new LoggerPino({logger: this.logger});
    const config = {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: this.dataset.distribution.url,
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
      `Querying "${this.dataset.distribution.url}" with "${this.query}"...`
    );
    const config = this.getConfig();
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.dataset.distribution.query,
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
          `Found ${terms.length} terms matching "${this.query}" in "${
            this.dataset.distribution.url
          }" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        resolve({dataset: this.dataset, terms});
      });
    });
  }
}
