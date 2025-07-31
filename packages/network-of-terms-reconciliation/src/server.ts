import fastify, {FastifyInstance, FastifyLoggerOptions} from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyAccepts from '@fastify/accepts';
import {findManifest} from './manifest.js';
import formBodyPlugin from '@fastify/formbody';
import {reconciliationQuery, ReconciliationQueryBatch} from './query.js';
import {preview} from './preview.js';
import en from './locales/en.json' with {type: 'json'};
import nl from './locales/nl.json' with {type: 'json'};
import {
  Catalog,
  getHttpLogger,
  LookupService,
  QueryTermsService,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import jsonSchema from './json-schema/reconciliation-query.json' with {type: 'json'};
import dataExtensionQuery from './json-schema/data-extension-query.json' with {type: 'json'};
import {parse} from 'querystring';
import {
  dataExtensionProperties,
  DataExtensionQuery,
  extendQuery,
} from './data-extension.js';
import {EnvSchemaData} from 'env-schema';

export async function server(
  catalog: Catalog,
  config: EnvSchemaData
): Promise<FastifyInstance> {
  const logger: FastifyLoggerOptions = getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const locales: {nl: locale; en: locale} = {nl, en};
  const queryTermsService = new QueryTermsService();
  const lookupService = new LookupService(catalog, queryTermsService);

  const server = fastify({logger, trustProxy: config.TRUST_PROXY as boolean});
  server.register(fastifyCors);
  server.register(formBodyPlugin, {parser});
  server.register(fastifyAccepts, {decorateReply: true});
  server.decorateRequest('root', '');
  server.decorateRequest('preferredLanguage', 'nl');
  server.addHook('onRequest', (request, reply, done) => {
    request.root = request.protocol + '://' + request.hostname;
    request.preferredLanguage = (request.languages(['nl', 'en']) || 'nl') as
      | 'nl'
      | 'en';
    done();
  });

  server.get('/reconcile', (request, reply) => {
    reply.send('ok');
  });

  server.get<{Params: {'*': string}}>('/reconcile/*', (request, reply) => {
    const dataset = request.params['*'];
    const manifest = findManifest(dataset, catalog, request.root);
    if (manifest === undefined) {
      reply.code(404).send();
      return;
    }
    reply.send(manifest);
  });

  server.post<{
    Params: {'*': string};
    Body: ReconciliationQueryBatch | DataExtensionQuery;
  }>(
    '/reconcile/*',
    {
      schema: {
        body: {anyOf: [jsonSchema, dataExtensionQuery]},
      },
    },
    async (request, reply) => {
      // BC for Reconciliation API spec 0.2.
      if (request.body.ids) {
        await extendQuery(
          (request.body as DataExtensionQuery).ids.map(termIri => termIri),
          lookupService,
          request.preferredLanguage
        );
        reply.send(
          await extendQuery(
            (request.body as DataExtensionQuery).ids.map(termIri => termIri),
            lookupService,
            request.preferredLanguage
          )
        );
        return;
      }
      const dataset = request.params['*'];
      const manifest = findManifest(dataset, catalog, request.root);
      if (manifest === undefined) {
        reply.code(404).send();
        return;
      }

      reply.send(
        await reconciliationQuery(
          dataset,
          request.body as ReconciliationQueryBatch,
          catalog,
          queryTermsService,
          request.preferredLanguage
        )
      );
    }
  );

  server.get('/extend/propose', (request, reply) => {
    reply.send({
      type: 'Concept',
      properties: dataExtensionProperties,
    });
  });

  server.post<{Body: DataExtensionQuery}>(
    '/extend',
    {
      schema: {
        body: dataExtensionQuery,
      },
    },
    async (request, reply) => {
      reply.send(
        await extendQuery(
          request.body.ids,
          lookupService,
          request.preferredLanguage
        )
      );
    }
  );

  server.get<{Params: {'*': string}}>('/preview/*', async (request, reply) => {
    const termIri = request.params['*'];
    const [lookupResult] = await lookupService.lookup([termIri], 10000);
    const source = catalog.getDatasetByDistributionIri(
      lookupResult.distribution.iri
    )!;

    reply
      .type('text/html')
      .send(
        preview(
          lookupResult,
          source,
          locales[request.preferredLanguage],
          request.preferredLanguage
        )
      );
  });

  return server;
}

export type locale = typeof en;

/**
 * Reconciliation queries are JSON-encoded in a x-www-form-urlencoded ‘queries’ parameter, so unpack that parameter.
 */
const parser = (string: string) => {
  const parsed = parse(string);

  return JSON.parse((parsed['queries'] ?? parsed['extend']) as string);
};

declare module 'fastify' {
  interface FastifyRequest extends Accepts {
    root: string;
    preferredLanguage: 'nl' | 'en';
  }
}
