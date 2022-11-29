import {calculateMatchingScore} from '../src/score';

describe('Score', () => {
  it('ignores punctuation', () => {
    expect(
      calculateMatchingScore('pieter de hooch', ['Hooch, Pieter de'])
    ).toEqual(91.67);
  });

  it('notices small differences', () => {
    expect(calculateMatchingScore('zagen', ['inzagen'])).toEqual(80);
  });

  it('matches identical strings', () => {
    expect(calculateMatchingScore('schilderen', ['schilderen'])).toEqual(100);
  });
});
