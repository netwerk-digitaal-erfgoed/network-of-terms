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
import Literal from '@rdfjs/data-model/lib/Literal.js';

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

async function queryTerms(
  _: unknown,
  args: {
    sources: string[];
    query: string;
    queryMode: string;
    limit: number;
    timeoutMs: number;
    languages: string[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
): Promise<unknown> {
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
    (args.languages ?? []).length > 0
      ? args.languages[0]
      : context.catalogLanguage,
    args.languages
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
        result.result instanceof Term
          ? mapTerm(result.result, args.languages)
          : result.result,
      responseTimeMs: result.responseTimeMs,
    };
  });
}

function resolveTermsResponse(
  results: TermsResponse[],
  catalog: Catalog,
  catalogLanguage: string,
  resultLanguages: string[]
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

    const terms = response.result.terms.map(term =>
      mapTerm(term, resultLanguages)
    );

    return {
      source: source(
        response.result.distribution,
        catalog.getDatasetByDistributionIri(response.result.distribution.iri)!,
        catalogLanguage
      ),
      result:
        resultLanguages === undefined
          ? {terms}
          : new TranslatedTerms(
              response.result.terms.map(term =>
                mapTranslatedTerm(term, resultLanguages)
              )
            ),
      responseTimeMs: response.responseTimeMs,
      terms, // For BC.
    };
  });
}

class TranslatedTerms {
  constructor(readonly terms: object[]) {}
}

function mapTranslatedTerm(term: Term, languages: string[]) {
  return {
    uri: term.id!.value,
    prefLabel: filterLiterals(term.prefLabels, languages).map(mapLiterals),
    altLabel: filterLiterals(term.altLabels, languages),
    hiddenLabel: filterLiterals(term.hiddenLabels, languages),
    definition: filterLiterals(term.scopeNotes, languages),
    scopeNote: filterLiterals(term.scopeNotes, languages),
    seeAlso: term.seeAlso.map((seeAlso: RDF.NamedNode) => seeAlso.value),
    broader: term.broaderTerms.map(related => ({
      uri: related.id.value,
      prefLabel: filterLiterals(related.prefLabels, languages),
    })),
    narrower: term.narrowerTerms.map(related => ({
      uri: related.id.value,
      prefLabel: filterLiterals(related.prefLabels, languages),
    })),
    related: term.relatedTerms.map(related => ({
      uri: related.id.value,
      prefLabel: filterLiterals(related.prefLabels, languages),
    })),
    exactMatch: term.exactMatches.map(exactMatch => ({
      uri: exactMatch.id.value,
      prefLabel: filterLiterals(exactMatch.prefLabels, languages),
    })),
  };
}

function mapTerm(term: Term, languages: string[]) {
  return {
    uri: term.id!.value,
    prefLabel: literalValues(term.prefLabels, languages),
    altLabel: literalValues(term.altLabels, languages),
    hiddenLabel: literalValues(term.hiddenLabels, languages),
    definition: literalValues(term.scopeNotes, languages),
    scopeNote: literalValues(term.scopeNotes, languages),
    seeAlso: term.seeAlso.map((seeAlso: RDF.NamedNode) => seeAlso.value),
    broader: term.broaderTerms.map(related => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    narrower: term.narrowerTerms.map(related => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    related: term.relatedTerms.map(related => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    exactMatch: term.exactMatches.map(exactMatch => ({
      uri: exactMatch.id.value,
      prefLabel: literalValues(exactMatch.prefLabels, languages),
    })),
  };
}

function filterLiterals(literals: RDF.Literal[], languages: string[]) {
  const preferredLanguageLiterals = literals.filter(literal =>
    languages.includes(literal.language)
  );
  if (preferredLanguageLiterals.length > 0) {
    return preferredLanguageLiterals;
  }

  // If literal has no language tag, we assume it is in the Network of Terms’ default language, Dutch.
  return literals
    .filter(literal => literal.language === '')
    .map(literal => new Literal(literal.value, 'nl'));
}

function mapLiterals(literal: RDF.Literal) {
  return {
    language: literal.language,
    value: literal.value,
  };
}

function literalValues(literals: RDF.Literal[], languages: string[] = ['nl']) {
  const languageLiterals = filterLiterals(literals, languages);
  if (languageLiterals.length > 0) {
    return languageLiterals.map(literal => literal.value);
  }

  // Fall back to English for sources that provide no Dutch labels.
  return filterLiterals(literals, ['en']).map(literal => literal.value);
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
      name: creator.name[catalogLanguage] ?? Object.values(creator.name)[0],
      alternateName:
        creator.alternateName[catalogLanguage] ?? creator.alternateName[''],
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

      if (result instanceof TranslatedTerms) {
        return 'TranslatedTerms';
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
