import fastify from 'fastify';
import fastifyGql from 'fastify-gql';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

async function startServer(): Promise<void> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const catalog = await Catalog.default();
  const server = fastify({logger});
  server.register(fastifyGql, {
    schema,
    resolvers,
    graphiql: 'playground',
    context: (): Promise<object> =>
      new Promise(resolve => {
        resolve({
          catalog,
        });
      }),
  });
  server.register(fastifyCors);
  await server.listen(3123, '0.0.0.0');
}

(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error(err);
  }
})();
