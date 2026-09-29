import { server } from './server.js';
import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import { shutdownInstrumentation } from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import closeWithGrace from 'close-with-grace';
import { config } from './config.js';
import { fileURLToPath } from 'url';
import path from 'path';

try {
  const catalogPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'catalog',
  );
  const c = await getCatalog(catalogPath);
  console.log('catalog', c);
  const httpServer = await server(c, config);
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
