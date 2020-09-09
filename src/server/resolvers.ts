import {DistributionsService} from '../services/distributions';
import {QueryResult} from '../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../services/terms';
import {Dataset, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(object: any, args: any, context: any): Promise<any> {
  return context.catalog.datasets.flatMap((dataset: Dataset) =>
    dataset.distributions.map(distribution => ({
      uri: distribution.iri.toString(),
      name: dataset.name,
      creators: dataset.creators.map(creator => ({
        uri: creator.iri.toString(),
        identifier: creator.identifier,
      })),
    }))
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
  return results.map((result: QueryResult) => {
    return {
      source: {
        uri: result.distribution.iri,
        name: context.catalog.getDatasetByDistributionIri(
          result.distribution.iri
        )?.name,
      },
      terms: result.terms.map((term: Term) => {
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
        };
      }),
    };
  });
}

export const resolvers = {
  Query: {
    sources: listSources,
    terms: queryTerms,
  },
};
