import fastify, {
  FastifyInstance,
  FastifyLoggerOptions,
  FastifyRequest,
} from 'fastify';
import mercurius from 'mercurius';
import {resolvers} from './resolvers.js';
import {schema} from './schema.js';
import fastifyCors from '@fastify/cors';
import {Server} from 'http';
import {
  Catalog,
  comunica,
  getHttpLogger,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {EnvSchemaData} from 'env-schema';
import mercuriusLogging from 'mercurius-logging';
import fastifyAccepts from '@fastify/accepts';

export async function server(
  catalog: Catalog,
  config: EnvSchemaData
): Promise<FastifyInstance<Server>> {
  const logger: FastifyLoggerOptions = getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const server = fastify({logger, trustProxy: config.TRUST_PROXY as boolean});
  server.register(fastifyAccepts);
  server.register(mercurius, {
    schema,
    resolvers,
    graphiql: true,
    context: async (req: FastifyRequest) => {
      return {
        catalog,
        comunica,
        catalogLanguage: req.language(['nl', 'en']) || 'nl',
        termLanguages: req.languages(),
      };
    },
  });
  server.register(fastifyCors);
  server.register(mercuriusLogging, {
    logBody: true,
  });
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
      reply.redirect('/graphiql', 301);
    },
  });

  return server;
}
