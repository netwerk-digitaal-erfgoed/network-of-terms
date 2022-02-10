import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {server} from './server/server';

(async () => {
  try {
    const httpServer = await server(await Catalog.default(), [
      // Only a couple of reconciliation services to begin with.
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      'https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht',
    ]);
    await httpServer.listen(3123, '0.0.0.0');
  } catch (err) {
    console.error(err);
  }
})();
