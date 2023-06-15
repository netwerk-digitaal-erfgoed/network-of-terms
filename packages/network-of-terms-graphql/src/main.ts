import {getCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from './server';

(async () => {
  try {
    const httpServer = await server(
      await getCatalog(process.env.CATALOG_PATH || undefined)
    );
    await httpServer.listen({port: 3123, host: '0.0.0.0'});
  } catch (err) {
    console.error(err);
  }
})();
