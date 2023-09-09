import {server} from './server.js';
import {getCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {config} from './config.js';

(async () => {
  try {
    const httpServer = await server(await getCatalog(), config);
    await httpServer.listen({port: 3123, host: '0.0.0.0'});
  } catch (err) {
    console.error(err);
  }
})();
