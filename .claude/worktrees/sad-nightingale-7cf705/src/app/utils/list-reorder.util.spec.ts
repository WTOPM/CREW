import { reorderIdList } from './list-reorder.util';

describe('reorderIdList', () => {
  it('moves an item forward (lower index to higher)', () => {
    expect(reorderIdList(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward (higher index to lower)', () => {
    expect(reorderIdList(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op when from === to', () => {
    expect(reorderIdList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('returns a new array (does not mutate the input)', () => {
    const input = ['a', 'b', 'c'];
    const result = reorderIdList(input, 0, 2);
    expect(result).not.toBe(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('handles moving to the last position', () => {
    expect(reorderIdList(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
});
