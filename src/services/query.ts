import {AccessService} from './catalog';
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

export interface ConstructorOptions {
  logger: Pino.Logger;
  accessService: AccessService;
  query: string;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  accessService: Joi.object().required(),
  query: Joi.string().required(),
});

export interface QueryResult {
  accessService: AccessService;
  terms: Term[];
}

export class QueryTermsService {
  protected logger: Pino.Logger;
  protected accessService: AccessService;
  protected query: string;
  protected engine: ActorInitSparql;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.accessService = args.accessService;
    this.query = `'${args.query}'`;
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
          value: this.accessService.endpointUrl,
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
      `Querying "${this.accessService.endpointUrl}" with "${this.query}"...`
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
          `Found ${terms.length} terms matching "${this.query}" in "${
            this.accessService.endpointUrl
          }" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        resolve({accessService: this.accessService, terms});
      });
    });
  }
}
