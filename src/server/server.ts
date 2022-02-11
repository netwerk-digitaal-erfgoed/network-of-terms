import fastify, {FastifyInstance} from 'fastify';
import mercurius from 'mercurius';
import * as Logger from '../helpers/logger';
import {resolvers} from './resolvers';
import {schema} from './schema';
import fastifyCors from 'fastify-cors';
import fastifyAccepts from 'fastify-accepts';
import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';
import {IncomingMessage, Server} from 'http';
import {findManifest} from '../reconciliation/manifest';
import formBodyPlugin from 'fastify-formbody';
import {QueryTermsService} from '../services/query';
import {reconciliationQuery} from '../reconciliation/query';
import {LookupService} from '../lookup/lookup';
import {preview} from '../reconciliation/preview';
import en from '../locales/en.json';
import nl from '../locales/nl.json';

export async function server(
  catalog: Catalog,
  reconciliationServices: string[]
): Promise<FastifyInstance<Server, customRequest>> {
  const logger = Logger.getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const comunica = await newEngine();
  const queryTermsService = new QueryTermsService({comunica, logger});
  const lookupService = new LookupService(catalog, queryTermsService);
  const locales: {nl: locale; en: locale} = {nl, en};

  const server = fastify<Server, customRequest>({logger});
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
  server.register(fastifyAccepts);
  server.decorateRequest('previewUrl', '');
  server.addHook('onRequest', (request, reply, done) => {
    request.raw.previewUrl =
      request.protocol + '://' + request.hostname + '/preview/{{id}}';
    done();
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
      reply.redirect(301, '/graphiql');
    },
  });

  server.get<{Params: {'*': string}}>('/reconcile/*', (request, reply) => {
    const distributionIri = new IRI(request.params['*']);
    const manifest = findManifest(
      distributionIri,
      catalog,
      reconciliationServices,
      request.raw.previewUrl
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
        reconciliationServices,
        request.raw.previewUrl
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

  server.get<{Params: {'*': string}}>('/preview/*', async (request, reply) => {
    const language = (request.language(['en', 'nl']) || 'en') as 'nl' | 'en';
    const termIri = new IRI(request.params['*']);
    const [lookupResult] = await lookupService.lookup([termIri], 10000);

    reply.type('text/html').send(preview(lookupResult, locales[language]));
  });

  return server;
}

export interface customRequest extends IncomingMessage {
  previewUrl: string;
}

export type locale = typeof en;
