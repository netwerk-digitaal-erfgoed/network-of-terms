import {server} from './server';
import {getCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {config} from './config';

(async () => {
  try {
    const httpServer = await server(await getCatalog(), config);
    await httpServer.listen({port: 3123, host: '0.0.0.0'});
  } catch (err) {
    console.error(err);
  }
})();
