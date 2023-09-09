export * from './query.js';
export * from './catalog.js';
export * from './lookup/lookup.js';
export * from './terms.js';
export * from './search/query-mode.js';
export * from './distributions.js';
export * from './helpers/logger.js';

import {QueryEngine} from '@comunica/query-sparql';

export const comunica = new QueryEngine();
