import {DistributionsService} from '../services/distributions';
import {QueryResult} from '../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../services/terms';
import {Dataset} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(object: any, args: any, context: any): Promise<any> {
  return context.catalog.datasets.map((dataset: Dataset) => {
    return {
      identifier: dataset.iri,
      name: dataset.name,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryTerms(object: any, args: any, context: any): Promise<any> {
  const service = new DistributionsService({
    logger: context.app.log,
    catalog: context.catalog,
  });
  const results = await service.queryAll({
    sources: args.sources,
    query: args.query,
  });
  return results.map((result: QueryResult) => {
    return {
      source: {
        identifier: result.dataset.identifier,
        name: result.dataset.name,
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
