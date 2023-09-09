import {getCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from './server.js';
import {config} from './config.js';

(async () => {
  try {
    const httpServer = await server(
      await getCatalog((config.CATALOG_PATH as string) || undefined),
      config
    );
    await httpServer.listen({port: 3123, host: '0.0.0.0'});
  } catch (err) {
    console.error(err);
  }
})();
