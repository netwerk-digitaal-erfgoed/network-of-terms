import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import { shutdownInstrumentation } from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import closeWithGrace from 'close-with-grace';
import { server } from './server.js';
import { config } from './config.js';

try {
  const httpServer = await server(
    await getCatalog((config.CATALOG_PATH as string) || undefined),
    config,
  );
  // On SIGTERM, finish in-flight requests and export the last metrics before exiting.
  closeWithGrace(async ({ err }) => {
    if (err) {
      console.error(err);
    }
    await httpServer.close();
    await shutdownInstrumentation();
  });
  await httpServer.listen({ port: 3123, host: '0.0.0.0' });
} catch (err) {
  console.error(err);
}
