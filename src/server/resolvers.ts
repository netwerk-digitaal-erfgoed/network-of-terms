import {DistributionsService} from '../services/distributions';
import {
  Error,
  QueryTermsService,
  ServerError,
  TermsResult,
  TimeoutError,
} from '../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../services/terms';
import {
  Catalog,
  Dataset,
  Distribution,
  IRI,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {
  LookupQueryResult,
  LookupResult,
  LookupService,
  NotFoundError,
  SourceNotFoundError,
  SourceResult,
} from '../lookup/lookup';
import {SearchQueryType} from '../search/query-variants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(object: any, args: any, context: any): Promise<any> {
  return context.catalog.datasets.flatMap((dataset: Dataset) =>
    dataset.distributions.map(distribution => source(distribution, dataset))
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
    sources: args.sources.map(
      (distributionIri: string) => new IRI(distributionIri)
    ),
    query: args.query,
    queryType: SearchQueryType[args.type as keyof typeof SearchQueryType],
    timeoutMs: args.timeoutMs,
  });
  return resolveTermsResults(results, context.catalog);
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
        result.distribution instanceof SparqlDistribution
          ? source(
              result.distribution,
              context.catalog.getDatasetByDistributionIri(
                result.distribution.iri
              )!
            )
          : result.distribution,
      result:
        result.result instanceof Term ? term(result.result) : result.result,
    };
  });
}

function resolveTermsResults(results: TermsResult[], catalog: Catalog) {
  return results.map((result: TermsResult) => {
    if (result instanceof Error) {
      return {
        source: source(
          result.distribution,
          catalog.getDatasetByDistributionIri(result.distribution.iri)!
        ),
        result,
        terms: [], // For BC.
      };
    }

    const terms = result.terms.map(term);

    return {
      source: source(
        result.distribution,
        catalog.getDatasetByDistributionIri(result.distribution.iri)!
      ),
      terms, // For BC.
      result: {
        terms: terms,
      },
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
  };
}

function source(distribution: Distribution, dataset: Dataset) {
  return {
    uri: distribution.iri,
    name: dataset.name,
    alternateName: dataset.alternateName,
    creators: dataset.creators.map(creator => ({
      uri: creator.iri,
      name: creator.name,
      alternateName: creator.alternateName,
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
