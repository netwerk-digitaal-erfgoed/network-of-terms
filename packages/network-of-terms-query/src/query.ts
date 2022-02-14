import {ActorInitSparql} from '@comunica/actor-init-sparql';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import * as Hoek from '@hapi/hoek';
import Joi from 'joi';
import factory from '@rdfjs/data-model';
import {LoggerPino} from './helpers/logger-pino';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';
import {Term, TermsTransformer} from './terms';
import {QueryMode, queryVariants} from './search/query-mode';
import {newEngine} from '@comunica/actor-init-sparql';
import {Distribution, IRI} from './catalog';

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
  private readonly logger: Pino.Logger;
  private readonly engine: ActorInitSparql;

  constructor(
    options: {comunica?: ActorInitSparql; logger?: Pino.Logger} = {}
  ) {
    this.engine = options.comunica || newEngine();
    this.logger = options.logger || Pino();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getConfig(distribution: Distribution, bindings?: Bindings): any {
    const logger = new LoggerPino({logger: this.logger});
    return {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: distribution.endpoint.toString(),
        },
      ],
      initialBindings: bindings,
    };
  }

  async search(
    searchQuery: string,
    queryMode: QueryMode,
    distribution: Distribution,
    timeoutMs: number
  ) {
    return this.run(
      distribution.searchQuery,
      distribution,
      timeoutMs,
      Bindings(
        [...queryVariants(searchQuery, queryMode)].reduce(
          (record: Record<string, RDF.Term>, [k, v]) => {
            record[k] = factory.literal(v);
            return record;
          },
          {}
        )
      )
    );
  }

  async lookup(iris: IRI[], distribution: Distribution, timeoutMs: number) {
    return this.run(
      distribution.lookupQuery.replace(
        '?uris',
        iris.map(iri => `<${iri}>`).join(' ')
      ),
      distribution,
      timeoutMs
    );
  }

  async run(
    query: string,
    distribution: Distribution,
    timeoutMs: number,
    bindings?: Bindings
  ): Promise<TermsResult> {
    Joi.attempt(
      timeoutMs,
      Joi.number()
        .integer()
        .min(1)
        .max(parseInt(process.env.MAX_QUERY_TIMEOUT as string) || 10000)
        .default(parseInt(process.env.DEFAULT_QUERY_TIMEOUT as string) || 5000)
    );

    this.logger.info(`Querying "${distribution.endpoint}" with "${query}"...`);
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      query,
      this.getConfig(distribution, bindings)
    )) as IActorQueryOperationOutputQuads;

    return guardTimeout(
      new Promise(resolve => {
        const termsTransformer = new TermsTransformer();
        result.quadStream.on('error', (error: Error) => {
          this.logger.error(
            `An error occurred when querying "${distribution.endpoint}": ${error}`
          );
          resolve(new ServerError(distribution, error.message));
        });
        result.quadStream.on('data', (quad: RDF.Quad) => {
          termsTransformer.fromQuad(quad);
        });
        result.quadStream.on('end', () => {
          const terms = termsTransformer.asArray().sort(alphabeticallyByLabels);
          this.logger.info(
            `Found ${terms.length} terms matching "${query}" in "${
              distribution.endpoint
            }" in ${PrettyMilliseconds(timer.elapsed())}`
          );
          resolve(new Terms(distribution, terms));
        });
      }),
      timeoutMs,
      new TimeoutError(distribution, timeoutMs)
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
