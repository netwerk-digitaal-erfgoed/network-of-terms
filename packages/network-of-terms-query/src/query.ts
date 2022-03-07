import * as Hoek from '@hapi/hoek';
import Joi from 'joi';
import {LoggerPino} from './helpers/logger-pino';
import Pino from 'pino';
import PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';
import {Term, TermsTransformer} from './terms';
import {QueryMode, queryVariants} from './search/query-mode';
import {Dataset, Distribution, IRI} from './catalog';
import {QueryEngine} from '@comunica/query-sparql';
import {BindingsFactory} from '@comunica/bindings-factory';
import {DataFactory} from 'rdf-data-factory';

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
  private readonly engine: QueryEngine;

  constructor(options: {comunica?: QueryEngine; logger?: Pino.Logger} = {}) {
    this.engine = options.comunica || new QueryEngine();
    this.logger = options.logger || Pino();
  }

  protected getConfig(
    distribution: Distribution,
    bindings: Record<string, RDF.Term>
  ): object {
    const logger = new LoggerPino({logger: this.logger});
    return {
      log: logger,
      sources: [
        {
          type: 'sparql', // Only supported type for now
          value: distribution.endpoint.toString(),
        },
      ],
      initialBindings: bindingsFactory.fromRecord(bindings),
    };
  }

  async search(
    searchQuery: string,
    queryMode: QueryMode,
    dataset: Dataset,
    distribution: Distribution,
    timeoutMs: number
  ) {
    const bindings = [...queryVariants(searchQuery, queryMode)].reduce(
      (record: Record<string, RDF.Term>, [k, v]) => {
        record[k] = dataFactory.literal(v);
        return record;
      },
      {}
    );
    bindings['datasetUri'] = dataFactory.namedNode(dataset.iri.toString());

    return this.run(
      distribution.searchQuery,
      distribution,
      timeoutMs,
      bindings
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
    bindings: Record<string, RDF.Term> = {}
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
    const quadStream = await this.engine.queryQuads(
      query,
      this.getConfig(distribution, bindings)
    );

    return guardTimeout(
      new Promise(resolve => {
        const termsTransformer = new TermsTransformer();
        quadStream.on('error', (error: Error) => {
          this.logger.error(
            `An error occurred when querying "${distribution.endpoint}": ${error}`
          );
          resolve(new ServerError(distribution, error.message));
        });
        quadStream.on('data', (quad: RDF.Quad) => {
          termsTransformer.fromQuad(quad);
        });
        quadStream.on('end', () => {
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

const dataFactory = new DataFactory();
const bindingsFactory = new BindingsFactory(dataFactory);
