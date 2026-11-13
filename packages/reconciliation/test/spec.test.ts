import { describe, expect, it } from 'vitest';
import { specViolations } from './spec.js';

describe('specViolations', () => {
  const candidate = {
    id: 'https://example.com/resources/rembrandt',
    name: 'Rembrandt',
    score: 100,
  };

  it('accepts a response as the spec defines it', () => {
    expect(
      specViolations('reconciliation-result-batch', {
        q1: { result: [{ ...candidate, type: [{ id: 'T', name: 'Type' }] }] },
      }),
    ).toEqual([]);
  });

  // The spec allows fields it does not define, so OpenRefine silently ignores a misnamed one.
  it('rejects a field the spec does not define', () => {
    expect(
      specViolations('reconciliation-result-batch', {
        q1: { result: [{ ...candidate, types: [{ id: 'T', name: 'Type' }] }] },
      }),
    ).toEqual(["/q1/result/0 must NOT have additional properties: 'types'"]);
  });

  it('rejects a response that lacks a field the spec requires', () => {
    expect(
      specViolations('reconciliation-result-batch', {
        q1: { result: [{ id: candidate.id, name: candidate.name }] },
      }),
    ).toEqual(["/q1/result/0 must have required property 'score'"]);
  });
});
