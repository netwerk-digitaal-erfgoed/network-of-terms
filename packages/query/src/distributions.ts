import { QueryEngine } from '@comunica/query-sparql';
import Joi from 'joi';
import Pino from 'pino';
import { QueryTermsService, TermsResponse } from './query.js';
import { QueryMode } from './search/query-mode.js';
import { Catalog, IRI } from './catalog.js';
import { comunica } from './index.js';
import { clientQueriesCounter } from './instrumentation.js';

interface BaseQueryOptions {
  query: string;
  queryMode: QueryMode;
  limit: number;
  timeoutMs: number;
}

export interface QueryOptions extends BaseQueryOptions {
  source: IRI;
}

export interface QueryAllOptions extends BaseQueryOptions {
  sources?: IRI[];
  genres?: IRI[];
}

const schemaBase = Joi.object({
  query: Joi.string().required(),
  queryMode: Joi.string().required(),
  limit: Joi.number().integer(),
  timeoutMs: Joi.number().integer(),
});

const schemaQuery = schemaBase.append({
  source: Joi.string().required(),
});

const schemaQueryAll = schemaBase
  .append({
    sources: Joi.array().items(Joi.string().required()).min(1),
    genres: Joi.array().items(Joi.string().required()).min(1),
  })
  .or('sources', 'genres');

export class DistributionsService {
  private logger: Pino.Logger;
  private catalog: Catalog;
  private comunica: QueryEngine;

  constructor(options: {
    logger: Pino.Logger;
    catalog: Catalog;
    comunica?: QueryEngine;
  }) {
    this.logger = options.logger;
    this.catalog = options.catalog;
    this.comunica = options.comunica || comunica();
  }

  async query(
    options: QueryOptions,
    genres?: IRI[],
  ): Promise<TermsResponse> {
    const args = Joi.attempt(options, schemaQuery);
    this.logger.info(`Preparing to query source "${args.source}"...`);
    const dataset = this.catalog.getDatasetByIri(args.source);
    if (dataset === undefined) {
      throw Error(`Source with URI "${args.source}" not found`);
    }
    const distribution = dataset.getSparqlDistribution()!;
    const queryService = new QueryTermsService({
      logger: this.logger,
      comunica: this.comunica,
    });
    return queryService.search(
      args.query,
      args.queryMode,
      dataset,
      distribution,
      args.limit,
      args.timeoutMs,
      genres,
    );
  }

  async queryAll(options: QueryAllOptions): Promise<TermsResponse[]> {
    const args = Joi.attempt(options, schemaQueryAll);

    let effectiveSources: IRI[];
    if (args.sources && args.genres) {
      const genreDatasetIris = new Set(
        this.catalog
          .getDatasetsByGenre(args.genres)
          .map((d) => d.iri.toString()),
      );
      effectiveSources = args.sources.filter((source: IRI) => {
        const dataset = this.catalog.getDatasetByIri(source);
        return dataset && genreDatasetIris.has(dataset.iri.toString());
      });
    } else if (args.genres) {
      effectiveSources = this.catalog
        .getDatasetsByGenre(args.genres)
        .map((d) => d.iri);
    } else {
      effectiveSources = args.sources;
    }

    clientQueriesCounter.add(1, {
      numberOfSources: effectiveSources.length,
      type: 'search',
    });
    const requests = effectiveSources.map((source: IRI) =>
      this.query(
        {
          source,
          query: args.query,
          queryMode: args.queryMode,
          limit: args.limit,
          timeoutMs: args.timeoutMs,
        },
        args.genres,
      ),
    );
    return Promise.all(requests);
  }
}
