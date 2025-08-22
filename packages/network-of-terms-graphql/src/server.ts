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
  config: EnvSchemaData,
): Promise<FastifyInstance<Server>> {
  const logger: FastifyLoggerOptions = getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const server = fastify({logger, trustProxy: config.TRUST_PROXY as boolean});
  await server.register(fastifyAccepts);
  await server.register(mercurius, {
    schema: schema(catalog.getLanguages()),
    resolvers,
    graphiql: true,
    context: async (req: FastifyRequest) => {
      return {
        catalog,
        // Use a fresh Comunica instance for each request to prevent Comunica's rate-limiting from delaying requests.
        // We need requests to fail within the user-supplied timeoutMs.
        comunica: comunica(),
        catalogLanguage: req.language(['nl', 'en']) || 'nl',
      };
    },
  });
  await server.register(fastifyCors);
  await server.register(mercuriusLogging, {
    logBody: true,
  });
  server.route({
    method: 'GET',
    url: '/',
    handler: (req, reply) => {
      void reply.redirect('/graphiql');
    },
  });

  // Redirect /playground to /graphiql for BC.
  server.route({
    method: 'GET',
    url: '/playground',
    handler: (req, reply) => {
      void reply.redirect('/graphiql', 301);
    },
  });

  return server;
}
