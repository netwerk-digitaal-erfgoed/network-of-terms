import {
  Catalog,
  Dataset,
  Distribution,
  DistributionsService,
  Error,
  Feature,
  FeatureType,
  IRI,
  LookupQueryResult,
  LookupResult,
  LookupService,
  NotFoundError,
  QueryMode,
  QueryTermsService,
  ServerError,
  SourceNotFoundError,
  SourceResult,
  Term,
  TermsResponse,
  TermsResult,
  TimeoutError,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import * as RDF from '@rdfjs/types';
import {dereferenceGenre} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(object: any, args: any, context: any): Promise<any> {
  return context.catalog
    .getDatasetsSortedByName(context.catalogLanguage)
    .flatMap((dataset: Dataset) =>
      dataset.distributions.map(distribution =>
        source(distribution, dataset, context.catalogLanguage)
      )
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryTerms(object: any, args: any, context: any): Promise<any> {
  const service = new DistributionsService({
    logger: context.app.log,
    catalog: context.catalog,
    comunica: context.comunica,
  });
  const results = await service.queryAll({
    sources: args.sources.map((datasetIri: string) => new IRI(datasetIri)),
    query: args.query,
    queryMode: QueryMode[args.queryMode as keyof typeof QueryMode],
    limit: args.limit,
    timeoutMs: args.timeoutMs,
  });
  return resolveTermsResponse(
    results,
    context.catalog,
    context.catalogLanguage
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lookupTerms(object: any, args: any, context: any) {
  const service = new LookupService(
    context.catalog,
    new QueryTermsService({comunica: context.comunica, logger: context.app.log})
  );
  const results = await service.lookup(
    args.uris.map((iri: string) => new IRI(iri)),
    args.timeoutMs
  );

  return results.map((result: LookupQueryResult) => {
    return {
      uri: result.uri,
      source:
        result.distribution instanceof SourceNotFoundError
          ? result.distribution
          : source(
              result.distribution,
              context.catalog.getDatasetByDistributionIri(
                result.distribution.iri
              )!,
              context.catalogLanguage
            ),
      result:
        result.result instanceof Term ? term(result.result) : result.result,
      responseTimeMs: result.responseTimeMs,
    };
  });
}

function resolveTermsResponse(
  results: TermsResponse[],
  catalog: Catalog,
  catalogLanguage: string
) {
  return results.map((response: TermsResponse) => {
    if (response.result instanceof Error) {
      return {
        source: source(
          response.result.distribution,
          catalog.getDatasetByDistributionIri(
            response.result.distribution.iri
          )!,
          catalogLanguage
        ),
        result: response.result,
        responseTimeMs: response.responseTimeMs,
        terms: [], // For BC.
      };
    }

    const terms = response.result.terms.map(term);

    return {
      source: source(
        response.result.distribution,
        catalog.getDatasetByDistributionIri(response.result.distribution.iri)!,
        catalogLanguage
      ),
      result: {
        terms: terms,
      },
      responseTimeMs: response.responseTimeMs,
      terms, // For BC.
    };
  });
}

function term(term: Term) {
  return {
    uri: term.id!.value,
    prefLabel: term.prefLabels.map((prefLabel: RDF.Term) => prefLabel.value),
    altLabel: term.altLabels.map((altLabel: RDF.Term) => altLabel.value),
    hiddenLabel: term.hiddenLabels.map(
      (hiddenLabel: RDF.Term) => hiddenLabel.value
    ),
    definition: term.scopeNotes.map((scopeNote: RDF.Term) => scopeNote.value),
    scopeNote: term.scopeNotes.map((scopeNote: RDF.Term) => scopeNote.value),
    seeAlso: term.seeAlso.map((seeAlso: RDF.NamedNode) => seeAlso.value),
    broader: term.broaderTerms.map(related => ({
      uri: related.id.value,
      prefLabel: related.prefLabels.map(prefLabel => prefLabel.value),
    })),
    narrower: term.narrowerTerms.map(related => ({
      uri: related.id.value,
      prefLabel: related.prefLabels.map(prefLabel => prefLabel.value),
    })),
    related: term.relatedTerms.map(related => ({
      uri: related.id.value,
      prefLabel: related.prefLabels.map(prefLabel => prefLabel.value),
    })),
    exactMatch: term.exactMatches.map(exactMatch => ({
      uri: exactMatch.id.value,
      prefLabel: exactMatch.prefLabels.map(prefLabel => prefLabel.value),
    })),
  };
}

async function source(
  distribution: Distribution,
  dataset: Dataset,
  catalogLanguage: string
) {
  return {
    uri: dataset.iri,
    name: dataset.name[catalogLanguage],
    alternateName: dataset.alternateName?.[catalogLanguage],
    description: dataset.description[catalogLanguage],
    mainEntityOfPage: [dataset.mainEntityOfPage],
    inLanguage: dataset.inLanguage,
    creators: dataset.creators.map(creator => ({
      uri: creator.iri,
      name: creator.name[catalogLanguage] ?? Object.entries(creator.name)[0][1],
      alternateName:
        creator.alternateName[catalogLanguage] ??
        Object.entries(creator.alternateName)[0][1],
    })),
    genres: dataset.genres.map(async genre => ({
      uri: genre.toString(),
      name: (await dereferenceGenre(genre))?.name ?? 'Unknown',
    })),
    features: distribution.features.map((feature: Feature) => ({
      type: Object.entries(FeatureType).find(
        ([_, val]) => val === feature.type
      )?.[0],
      url: feature.url.toString(),
    })),
  };
}

export const resolvers = {
  Query: {
    sources: listSources,
    terms: queryTerms,
    lookup: lookupTerms,
  },
  TermsResult: {
    resolveType(result: TermsResult) {
      if (result instanceof TimeoutError) {
        return 'TimeoutError';
      }

      if (result instanceof ServerError) {
        return 'ServerError';
      }

      return 'Terms';
    },
  },
  SourceResult: {
    resolveType(result: SourceResult) {
      if (result instanceof SourceNotFoundError) {
        return 'SourceNotFoundError';
      }

      return 'Source';
    },
  },
  LookupResult: {
    resolveType(result: LookupResult) {
      if (result instanceof NotFoundError) {
        return 'NotFoundError';
      }

      if (result instanceof TimeoutError) {
        return 'TimeoutError';
      }

      if (result instanceof ServerError) {
        return 'ServerError';
      }

      return 'Term';
    },
  },
};
