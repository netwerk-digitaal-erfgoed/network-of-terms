import {defaultCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from './server';

(async () => {
  try {
    const httpServer = await server(await defaultCatalog());
    await httpServer.listen(3123, '0.0.0.0');
  } catch (err) {
    console.error(err);
  }
})();
