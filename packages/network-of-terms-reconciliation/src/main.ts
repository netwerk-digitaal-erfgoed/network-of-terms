import {server} from './server';
import {defaultCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

(async () => {
  try {
    const httpServer = await server(await defaultCatalog(), [
      // Only a couple of reconciliation services to begin with.
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
      'https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht',
    ]);
    await httpServer.listen(3123, '0.0.0.0');
  } catch (err) {
    console.error(err);
  }
})();
