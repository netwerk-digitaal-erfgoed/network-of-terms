export * from './query';
export * from './catalog';
export * from './lookup/lookup';
export * from './terms';
export * from './search/query-mode';
export * from './distributions';
export * from './helpers/logger';
export * from './server-test';

import {newEngine} from '@comunica/actor-init-sparql';

export const comunica = newEngine();
