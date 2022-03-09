import fastify, {FastifyInstance} from 'fastify';
import fastifyCors from 'fastify-cors';
import fastifyAccepts from 'fastify-accepts';
import {IncomingMessage, Server} from 'http';
import {findManifest} from './manifest';
import formBodyPlugin from 'fastify-formbody';
import {reconciliationQuery, ReconciliationQueryBatch} from './query';
import {preview} from './preview';
import en from './locales/en.json';
import nl from './locales/nl.json';
import {
  Catalog,
  getHttpLogger,
  IRI,
  LookupService,
  QueryTermsService,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import jsonSchema from './json-schema/reconciliation-query.json';
import {parse} from 'querystring';

export async function server(
  catalog: Catalog
): Promise<FastifyInstance<Server, customRequest>> {
  const logger = getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const locales: {nl: locale; en: locale} = {nl, en};
  const queryTermsService = new QueryTermsService();
  const lookupService = new LookupService(catalog, queryTermsService);

  const server = fastify<Server, customRequest>({logger});
  server.register(fastifyCors);
  server.register(formBodyPlugin, {parser});
  server.register(fastifyAccepts);
  server.decorateRequest('previewUrl', '');
  server.addHook('onRequest', (request, reply, done) => {
    request.raw.previewUrl =
      request.protocol + '://' + request.hostname + '/preview/{{id}}';
    done();
  });

  server.get<{Params: {'*': string}}>('/reconcile/*', (request, reply) => {
    const distributionIri = new IRI(request.params['*']);
    const manifest = findManifest(
      distributionIri,
      catalog,
      request.raw.previewUrl
    );
    if (manifest === undefined) {
      reply.code(404).send();
      return;
    }
    reply.send(manifest);
  });

  server.post<{Params: {'*': string}; Body: ReconciliationQueryBatch}>(
    '/reconcile/*',
    {
      schema: {
        body: jsonSchema,
      },
    },
    async (request, reply) => {
      const distributionIri = new IRI(request.params['*']);
      const manifest = findManifest(
        distributionIri,
        catalog,
        request.raw.previewUrl
      );
      if (manifest === undefined) {
        reply.code(404).send();
        return;
      }

      reply.send(
        await reconciliationQuery(
          distributionIri,
          request.body,
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

/**
 * Reconciliation queries are JSON-encoded in a x-www-form-urlencoded ‘queries’ parameter, so unpack that parameter.
 */
const parser = (string: string) => {
  const parsed = parse(string);
  return JSON.parse(parsed['queries'] as string);
};
