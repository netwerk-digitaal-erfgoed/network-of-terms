import fastify, { FastifyInstance, FastifyLoggerOptions } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyAccepts from '@fastify/accepts';
import { findManifest } from './manifest.js';
import { conceptType } from './types.js';
import formBodyPlugin from '@fastify/formbody';
import { reconciliationQuery, ReconciliationQueryBatch } from './query.js';
import { preview } from './preview.js';
import en from '../locales/en.json' with { type: 'json' };
import nl from '../locales/nl.json' with { type: 'json' };
import {
  Catalog,
  getHttpLogger,
  LookupService,
  QueryTermsService,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import jsonSchema from '../json-schema/reconciliation-query.json' with { type: 'json' };
import dataExtensionQuery from '../json-schema/data-extension-query.json' with { type: 'json' };
import { parse } from 'querystring';
import {
  DataExtensionQuery,
  extendQuery,
  proposedProperties,
} from './data-extension.js';
import { EnvSchemaData } from 'env-schema';
import { propertyIds } from './properties.js';

export async function server(
  catalog: Catalog,
  config: EnvSchemaData,
): Promise<FastifyInstance> {
  const logger: FastifyLoggerOptions = getHttpLogger({
    name: 'http',
    level: 'info',
  });
  const locales: { nl: locale; en: locale } = { nl, en };
  const queryTermsService = new QueryTermsService();
  const lookupService = new LookupService(catalog, queryTermsService);

  const server = fastify({ logger, trustProxy: config.TRUST_PROXY as boolean });
  void server.register(fastifyCors);
  void server.register(formBodyPlugin, { parser });
  void server.register(fastifyAccepts, { decorateReply: true });
  server.decorateRequest('root', '');
  server.decorateRequest('preferredLanguage', 'nl');
  server.addHook('onRequest', (request, reply, done) => {
    request.root = request.protocol + '://' + request.hostname;
    request.preferredLanguage = (request.languages(['nl', 'en']) || 'nl') as
      'nl' | 'en';
    done();
  });

  server.get('/reconcile', (request, reply) => {
    void reply.send('ok');
  });

  server.get<{ Params: { '*': string } }>('/reconcile/*', (request, reply) => {
    const dataset = iriFromPath(request.params['*']);
    const manifest = findManifest(dataset, catalog, request.root);
    if (manifest === undefined) {
      void reply.code(404).send();
      return;
    }
    void reply.send(manifest);
  });

  server.post<{
    Params: { '*': string };
    Body: ReconciliationQueryBatch | DataExtensionQuery;
  }>(
    '/reconcile/*',
    {
      schema: {
        body: { anyOf: [jsonSchema, dataExtensionQuery] },
      },
    },
    async (request, reply) => {
      // BC for Reconciliation API spec 0.2.
      if (request.body.ids) {
        void reply.send(
          await extendQuery(
            (request.body as DataExtensionQuery).ids.map((termIri) => termIri),
            (request.body as DataExtensionQuery).properties,
            lookupService,
            request.preferredLanguage,
            locales[request.preferredLanguage].properties,
          ),
        );
        return;
      }
      const dataset = iriFromPath(request.params['*']);
      const manifest = findManifest(dataset, catalog, request.root);
      if (manifest === undefined) {
        void reply.code(404).send();
        return;
      }

      void reply.send(
        await reconciliationQuery(
          dataset,
          request.body as ReconciliationQueryBatch,
          catalog,
          queryTermsService,
          request.preferredLanguage,
        ),
      );
    },
  );

  // The properties a client can send with a reconciliation query, whose ID or name starts with
  // the prefix the user typed.
  server.get<{ Querystring: { prefix?: string } }>(
    '/suggest/property',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { prefix: { type: 'string' } },
        },
      },
    },
    (request, reply) => {
      const prefix = (request.query.prefix ?? '').trim().toLowerCase();
      const names = locales[request.preferredLanguage].properties;
      void reply.send({
        result: propertyIds
          .map((id) => ({ id, name: names[id] }))
          .filter(({ id, name }) =>
            [id, name].some((label) => label.toLowerCase().startsWith(prefix)),
          ),
      });
    },
  );

  // OpenRefine sends the type the column is reconciled against.
  server.get<{ Querystring: { type?: string[] } }>(
    '/extend/propose',
    {
      schema: {
        querystring: {
          type: 'object',
          // Ajv coerces a single type to an array, so a repeated one is accepted too.
          properties: { type: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
    (request, reply) => {
      const type = request.query.type?.[0] || conceptType.id;
      void reply.send({
        type,
        properties: proposedProperties(
          type,
          locales[request.preferredLanguage].properties,
        ),
      });
    },
  );

  server.post<{ Body: DataExtensionQuery }>(
    '/extend',
    {
      schema: {
        body: dataExtensionQuery,
      },
    },
    async (request, reply) => {
      void reply.send(
        await extendQuery(
          request.body.ids,
          request.body.properties,
          lookupService,
          request.preferredLanguage,
          locales[request.preferredLanguage].properties,
        ),
      );
    },
  );

  server.get<{ Params: { '*': string } }>(
    '/preview/*',
    async (request, reply) => {
      const termIri = iriFromPath(request.params['*']);
      const [lookupResult] = await lookupService.lookup([termIri], 10000);
      const source = catalog.getDatasetByDistributionIri(
        lookupResult.distribution.iri,
      )!;

      void reply
        .type('text/html')
        .send(
          preview(
            lookupResult,
            source,
            locales[request.preferredLanguage],
            request.preferredLanguage,
          ),
        );
    },
  );

  // The page about a term, which OpenRefine links a candidate’s name to. The IRI is in the path, as
  // for the preview, so the template can encode it as it needs.
  server.get<{ Params: { '*': string } }>('/view/*', (request, reply) => {
    void reply.redirect(
      viewUrl(
        config.VIEW_URL_TEMPLATE as string,
        iriFromPath(request.params['*']),
      ),
    );
  });

  return server;
}

export type locale = typeof en;

/**
 * Restore the IRI in a path wildcard. Reverse proxies such as Traefik merge duplicate slashes
 * in the path, which turns `https://example.com` into `https:/example.com`.
 */
const iriFromPath = (path: string) =>
  path.replace(/^(https?):\/(?!\/)/, '$1://');

// As in URI Templates (RFC 6570), {uri} is replaced with the percent-encoded IRI, which suits a
// query parameter, and {+uri} with the IRI as it is, which suits a link to the term itself.
const viewUrl = (template: string, iri: string) =>
  template.replace(/\{(\+?)uri\}/g, (_placeholder, asIs: string) =>
    asIs === '+' ? iri : encodeURIComponent(iri),
  );

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
