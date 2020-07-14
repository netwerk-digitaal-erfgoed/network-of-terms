import { CatalogService, Distribution } from '../services/catalog';
import { DistributionsService } from '../services/distributions';
import { QueryResult } from '../services/query';
import * as RDF from 'rdf-js';
import { Term } from '../services/terms';

// tslint:disable-next-line:no-any
async function getSources(object: any, args: any, context: any): Promise<any> {
  const service = new CatalogService({ logger: context.app.log });
  const distributions = await service.listDistributions();
  return distributions.map((distribution: Distribution) => {
    return {
      identifier: distribution.distributionId.value,
      name: distribution.distributionTitle.value,
    };
  });
}

// tslint:disable-next-line:no-any
async function queryTerms(object: any, args: any, context: any): Promise<any> {
  const service = new DistributionsService({ logger: context.app.log });
  const results = await service.queryAll({
    distributionIds: args.sources,
    query: args.query,
  });
  return results.map((result: QueryResult) => {
    return {
      source: {
        identifier: result.accessService.distribution.distributionId.value,
        name: result.accessService.distribution.distributionTitle.value,
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
    // tslint:disable-next-line:no-any
    sources: async (obj: any, args: any, context: any) => {
      return getSources(obj, args, context);
    },
    // tslint:disable-next-line:no-any
    terms: async (obj: any, args: any, context: any) => {
      return queryTerms(obj, args, context);
    },
  },
};
