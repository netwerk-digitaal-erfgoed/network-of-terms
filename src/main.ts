import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from './server/server';

(async () => {
  try {
    const httpServer = await server(await Catalog.default(), [
      // Only a single reconciliation service for now.
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
    ]);
    await httpServer.listen(3123, '0.0.0.0');
  } catch (err) {
    console.error(err);
  }
})();
