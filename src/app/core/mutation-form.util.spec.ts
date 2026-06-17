import { parseIntegerList, parseLineList } from './mutation-form.util';

describe('mutation-form.util', () => {
  it('parseLineList splits on newlines and commas', () => {
    expect(parseLineList('a.example\nb.example, c.example')).toEqual(['a.example', 'b.example', 'c.example']);
  });

  it('parseIntegerList drops invalid tokens', () => {
    expect(parseIntegerList('0, 2, bad, 3')).toEqual([0, 2, 3]);
  });
});
