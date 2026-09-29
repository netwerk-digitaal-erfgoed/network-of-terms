import { shutdownInstrumentation } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('shutdownInstrumentation', () => {
  it('resolves once the meter provider has shut down', async () => {
    await expect(shutdownInstrumentation()).resolves.toBeUndefined();
  });
});
