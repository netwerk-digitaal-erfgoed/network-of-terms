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
  timeoutMs: number;
}

const schemaConstructor = Joi.object({
  logger: Joi.object().required(),
  distribution: Joi.object().required(),
  query: Joi.string().required(),
  comunica: Joi.object().required(),
  timeoutMs: Joi.number().required(),
});

export type TermsResult = Terms | TimeoutError | ServerError;

export class Terms {
  constructor(readonly distribution: Distribution, readonly terms: Term[]) {}
}

export class Error {
  constructor(readonly distribution: Distribution, readonly message: string) {}
}
export class TimeoutError extends Error {
  constructor(readonly distribution: Distribution, timeoutMs: number) {
    super(distribution, `Source timed out after ${timeoutMs}ms`);
  }
}
export class ServerError extends Error {}

export class QueryTermsService {
  protected logger: Pino.Logger;
  protected distribution: Distribution;
  protected query: string;
  protected engine: ActorInitSparql;
  protected timeoutMs: number;

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = args.logger;
    this.distribution = args.distribution;
    this.query = args.query;
    this.engine = args.comunica;
    this.timeoutMs = args.timeoutMs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getConfig(): any {
    const logger = new LoggerPino({logger: this.logger});
    return {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: this.distribution.endpoint.toString(),
        },
      ],
      initialBindings: Bindings({
        '?query': literal(this.query),
      }),
    };
  }

  async run(): Promise<TermsResult> {
    this.logger.info(
      `Querying "${this.distribution.endpoint}" with "${this.query}"...`
    );
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.distribution.query,
      this.getConfig()
    )) as IActorQueryOperationOutputQuads;

    return guardTimeout(
      new Promise(resolve => {
        const termsTransformer = new TermsTransformer();
        result.quadStream.on('error', (error: Error) => {
          this.logger.error(
            `An error occurred when querying "${this.distribution.endpoint}": ${error}`
          );
          resolve(new ServerError(this.distribution, error.message));
        });
        result.quadStream.on('data', (quad: RDF.Quad) =>
          termsTransformer.fromQuad(quad)
        );
        result.quadStream.on('end', () => {
          const terms = termsTransformer.asArray().sort(alphabeticallyByLabels);
          this.logger.info(
            `Found ${terms.length} terms matching "${this.query}" in "${
              this.distribution.endpoint
            }" in ${PrettyMilliseconds(timer.elapsed())}`
          );
          resolve(new Terms(this.distribution, terms));
        });
      }),
      this.timeoutMs,
      new TimeoutError(this.distribution, this.timeoutMs)
    );
  }
}

const alphabeticallyByLabels = (a: Term, b: Term) => {
  const prefLabelA = a.prefLabels[0]?.value ?? '';
  const altLabelA = a.altLabels[0]?.value ?? '';
  const sortLabelA = prefLabelA + altLabelA;
  const prefLabelB = b.prefLabels[0]?.value ?? '';
  const altLabelB = b.altLabels[0]?.value ?? '';
  const sortLabelB = prefLabelB + altLabelB;
  return sortLabelA.localeCompare(sortLabelB);
};

function guardTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: TimeoutError
): Promise<T> {
  return Promise.race([
    promise,
    new Promise(resolve =>
      setTimeout(resolve.bind(null, timeoutError), timeoutMs)
    ),
  ]) as Promise<T>;
}
