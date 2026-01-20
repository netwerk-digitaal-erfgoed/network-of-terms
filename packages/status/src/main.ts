import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {
  MonitorService,
  PostgresObservationStore,
} from '@lde/sparql-monitor';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { extractMonitorConfigs } from './sync/monitor-sync.js';

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
  logger.info({ monitorCount: monitors.length }, 'Monitor configurations extracted');

  // Initialize monitor service
  const monitorService = new MonitorService({
    store,
    monitors,
    intervalSeconds: config.POLLING_INTERVAL_SECONDS,
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    monitorService.stop();
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
} catch (error) {
  logger.error({ error }, 'Failed to start monitoring service');
  process.exit(1);
}
