import fastify from 'fastify';
import fastifyGql from 'fastify-gql';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';

async function startServer(): Promise<void> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const server = fastify({logger});
  server.register(fastifyGql, {
    schema,
    resolvers,
    graphiql: 'playground',
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
