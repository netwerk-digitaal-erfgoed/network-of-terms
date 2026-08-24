import { getCatalog } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import { describe, expect, it } from 'vitest';
import { schema } from '../src/schema.js';

/**
 * The published GraphQL surface, snapshotted into `schema.graphql` so that a pull request which
 * moves it shows the move in Files changed and CI can diff it for breaking changes. Regenerate the
 * snapshot with `npx nx test graphql -- -u`.
 */
describe('Schema', () => {
  it('matches the published contract', async () => {
    const catalog = await getCatalog();
    await expect(schema(catalog.getLanguages())).toMatchFileSnapshot(
      '../schema.graphql',
    );
  }, 30_000);
});
