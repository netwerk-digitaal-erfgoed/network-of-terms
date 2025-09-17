import { server } from './server.js';
import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
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
  await httpServer.listen({ port: 3123, host: '0.0.0.0' });
} catch (err) {
  console.error(err);
}
