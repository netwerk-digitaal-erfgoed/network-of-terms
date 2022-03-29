import {calculateMatchingScore} from '../src/score';

describe('Score', () => {
  it('ignores punctuation', () => {
    expect(
      calculateMatchingScore('pieter de hooch', ['Hooch, Pieter de'])
    ).toEqual(100);
  });
});
