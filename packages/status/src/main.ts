import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {
  MonitorService,
  PostgresObservationStore,
  SparqlMonitor,
} from '@lde/sparql-monitor';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { rdfSerializer } from 'rdf-serialize';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { extractMonitorConfigs } from './sync/monitor-sync.js';
import { LdesSerializer, enrichObservations } from './ldes/serializer.js';

const logger = pino({ level: 'info' });

// Catalog path relative to the built main.js
const catalogPath = join(dirname(fileURLToPath(import.meta.url)), 'catalog');

try {
  logger.info('Starting SPARQL endpoint monitoring service...');

  // Initialize store
  const store = await PostgresObservationStore.create(config.DATABASE_URL);
  logger.info('Database initialized');

  // Load catalog
  const catalog = await getCatalog(catalogPath);
  logger.info({ datasetCount: catalog.datasets.length }, 'Catalog loaded');

  // Extract monitor configurations from catalog (one per dataset)
  const monitors = extractMonitorConfigs(catalog);
  logger.info(
    { monitorCount: monitors.length },
    'Monitor configurations extracted',
  );

  // Initialize LDES serializer
  const serializer = new LdesSerializer({ baseUrl: config.LDES_BASE_URL });

  // Initialize monitor service with 30s timeout per endpoint
  const sparqlMonitor = new SparqlMonitor({ timeoutMs: 10000 });
  const monitorService = new MonitorService({
    store,
    monitors,
    intervalSeconds: config.POLLING_INTERVAL_SECONDS,
    sparqlMonitor,
  });

  // Initialize Fastify server
  const fastify = Fastify({ logger: true });
  await fastify.register(cors);

  // Get available content types for content negotiation
  const contentTypes = await rdfSerializer.getContentTypes();
  const defaultContentType = 'application/ld+json';

  // Helper to get content type from Accept header
  const getContentType = (accept: string | undefined): string => {
    if (!accept || accept === '*/*') return defaultContentType;
    for (const contentType of contentTypes) {
      if (accept.includes(contentType)) {
        return contentType;
      }
    }
    return defaultContentType;
  };

  // LDES stream metadata (links to view)
  fastify.get('/', async (request, reply) => {
    const contentType = getContentType(request.headers.accept);
    const stream = serializer.serializeStreamMetadata(contentType);
    return reply.type(contentType).send(stream);
  });

  // LDES view with observation members (for GraphQL StatusClient)
  fastify.get('/observations/latest', async (request, reply) => {
    const observations = await store.getLatest();
    const enriched = enrichObservations(observations, monitors);
    const contentType = getContentType(request.headers.accept);
    const stream = serializer.serializeLatestView(enriched, contentType);
    return reply.type(contentType).send(stream);
  });

  // Health endpoint
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    monitorService.stop();
    await fastify.close();
    await store.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start monitoring
  monitorService.start();
  logger.info('Monitoring service started');

  // Run initial check if configured
  if (config.RUN_ON_START) {
    logger.info('Running initial check...');
    await monitorService.checkAll();
  }

  // Start HTTP server
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (error) {
  logger.error({ error }, 'Failed to start monitoring service');
  process.exit(1);
}
