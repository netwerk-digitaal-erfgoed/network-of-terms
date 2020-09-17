import fastify from 'fastify';
import fastifyGql from 'fastify-gql';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';

async function startServer(): Promise<void> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const catalog = await Catalog.default();
  const comunica = await newEngine();
  const server = fastify({logger});
  server.register(fastifyGql, {
    schema,
    resolvers,
    graphiql: 'playground',
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
      reply.redirect('/playground');
    },
  });
  await server.listen(3123, '0.0.0.0');
}

(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error(err);
  }
})();
