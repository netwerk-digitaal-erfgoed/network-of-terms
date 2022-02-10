import fastify, {FastifyInstance} from 'fastify';
import mercurius from 'mercurius';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';
import {Server} from 'http';
import {findManifest} from '../reconciliation/manifest';
import formBodyPlugin from 'fastify-formbody';
import {QueryTermsService} from '../services/query';
import {reconciliationQuery} from '../reconciliation/query';

export async function server(
  catalog: Catalog,
  reconciliationServices: string[]
): Promise<FastifyInstance<Server>> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const comunica = await newEngine();
  const queryTermsService = new QueryTermsService({comunica, logger: logger});
  const server = fastify({logger});
  server.register(mercurius, {
    schema,
    resolvers,
    graphiql: true,
    context: (): Promise<object> =>
      new Promise(resolve => {
        resolve({
          catalog,
          comunica,
        });
      }),
  });
  server.register(fastifyCors);
  server.register(formBodyPlugin);
  server.route({
    method: 'GET',
    url: '/',
    handler: (req, reply) => {
      reply.redirect('/graphiql');
    },
  });

  // Redirect /playground to /graphiql for BC.
  server.route({
    method: 'GET',
    url: '/playground',
    handler: (req, reply) => {
      reply.redirect(301, '/graphiql');
    },
  });

  server.get<{Params: {'*': string}}>('/reconcile/*', (request, reply) => {
    const distributionIri = new IRI(request.params['*']);
    const manifest = findManifest(
      distributionIri,
      catalog,
      reconciliationServices
    );
    if (manifest === undefined) {
      reply.code(404).send();
      return;
    }
    reply.send(manifest);
  });

  server.post<{Params: {'*': string}; Body: {queries: string}}>(
    '/reconcile/*',
    async (request, reply) => {
      const distributionIri = new IRI(request.params['*']);
      const manifest = findManifest(
        distributionIri,
        catalog,
        reconciliationServices
      );
      if (manifest === undefined) {
        reply.code(404).send();
        return;
      }

      // Reconciliation queries are JSON-encoded in a x-www-form-urlencoded ‘queries’ parameter.
      const queryBatch = JSON.parse(request.body['queries']);

      reply.send(
        await reconciliationQuery(
          distributionIri,
          queryBatch,
          catalog,
          queryTermsService
        )
      );
    }
  );

  return server;
}
