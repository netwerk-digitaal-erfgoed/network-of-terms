import fastify, {FastifyInstance} from 'fastify';
import mercurius from 'mercurius';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';
import {Server} from 'http';

export async function server(
  catalog: Catalog
): Promise<FastifyInstance<Server>> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const comunica = await newEngine();
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
