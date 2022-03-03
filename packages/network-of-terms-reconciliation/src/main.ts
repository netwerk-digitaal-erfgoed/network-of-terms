import {server} from './server';
import {defaultCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

(async () => {
  try {
    const httpServer = await server(await defaultCatalog());
    await httpServer.listen(3123, '0.0.0.0');
  } catch (err) {
    console.error(err);
  }
})();
