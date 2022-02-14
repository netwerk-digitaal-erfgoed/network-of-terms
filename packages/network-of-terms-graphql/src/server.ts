import fastify, {FastifyInstance} from 'fastify';
import mercurius from 'mercurius';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import {Server} from 'http';
import {
  Catalog,
  comunica,
  getHttpLogger,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

export async function server(
  catalog: Catalog
): Promise<FastifyInstance<Server>> {
  const logger = getHttpLogger({
    name: 'http',
    level: 'info',
  });
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

  return server;
}
