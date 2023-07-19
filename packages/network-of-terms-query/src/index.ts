export * from './query';
export * from './catalog';
export * from './lookup/lookup';
export * from './terms';
export * from './search/query-mode';
export * from './distributions';
export * from './helpers/logger';
export * from './instrumentation';

import {QueryEngine} from '@comunica/query-sparql';

export const comunica = new QueryEngine();
