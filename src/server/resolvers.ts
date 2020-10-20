import {DistributionsService} from '../services/distributions';
import {Error, Result, ServerError, TimeoutError} from '../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../services/terms';
import {
  Dataset,
  Distribution,
  IRI,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

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
  });
  return results.map((result: Result) => {
    if (result instanceof Error) {
      return {
        source: source(
          result.distribution,
          context.catalog.getDatasetByDistributionIri(result.distribution.iri)
        ),
        result,
        terms: [], // For BC.
      };
    }

    const terms = result.terms.map((term: Term) => {
      return {
        uri: term.id!.value,
        prefLabel: term.prefLabels.map(
          (prefLabel: RDF.Term) => prefLabel.value
        ),
        altLabel: term.altLabels.map((altLabel: RDF.Term) => altLabel.value),
        hiddenLabel: term.hiddenLabels.map(
          (hiddenLabel: RDF.Term) => hiddenLabel.value
        ),
        scopeNote: term.scopeNotes.map(
          (scopeNote: RDF.Term) => scopeNote.value
        ),
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
    });

    return {
      source: source(
        result.distribution,
        context.catalog.getDatasetByDistributionIri(result.distribution.iri)
      ),
      terms, // For BC.
      result: {
        terms: terms,
      },
    };
  });
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
  },
  Result: {
    resolveType(result: Result) {
      if (result instanceof TimeoutError) {
        return 'TimeoutError';
      }

      if (result instanceof ServerError) {
        return 'ServerError';
      }

      return 'Success';
    },
  },
};
