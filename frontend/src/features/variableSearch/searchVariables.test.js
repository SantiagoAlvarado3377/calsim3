import { describe, expect, it } from 'vitest';
import { paginate } from './searchVariables.js';

describe('paginate (SCRUM-161)', () => {
  const items = Array.from({ length: 23 }, (_, index) => index);

  it('returns one page and the page count', () => {
    expect(paginate(items, 2, 10)).toEqual({ items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], page: 2, pageCount: 3 });
  });

  it('clamps out-of-range pages and keeps one page for no results', () => {
    expect(paginate(items, 9, 10)).toMatchObject({ items: [20, 21, 22], page: 3 });
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});
