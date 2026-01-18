import { appendUniqueById, dedupeById, prependUniqueById } from '../listMerge';

describe('listMerge', () => {
  describe('dedupeById', () => {
    it('keeps first occurrence and preserves order', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }];
      expect(dedupeById(items)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    });

    it('skips items with empty id', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: '' }, { id: 'c' }];
      expect(dedupeById(items)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    });
  });

  describe('appendUniqueById', () => {
    it('appends only ids not already in prev', () => {
      const prev = [{ id: 'a' }, { id: 'b' }];
      const incoming = [{ id: 'b' }, { id: 'c' }];
      expect(appendUniqueById(prev, incoming)).toEqual({
        merged: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        appendedCount: 1,
      });
    });
    it('does not mutate prev', () => {
      const prev = [{ id: 'a' }, { id: 'b' }];
      const incoming = [{ id: 'b' }, { id: 'c' }];
      appendUniqueById(prev, incoming);
      expect(prev).toEqual([{ id: 'a' }, { id: 'b' }]);
    });
    it('empty incoming returns new array and appendedCount is 0', () => {
      const prev = [{ id: 'a' }, { id: 'b' }];
      const incoming: { id: string }[] = [];
      const result = appendUniqueById(prev, incoming);
      expect(result.merged).not.toBe(prev);
    });
  });
  describe('prependUniqueById', () => {
    it('prepends only new ids', () => {
      const prev = [{ id: 'a' }, { id: 'b' }];
      const incoming = [{ id: 'c' }, { id: 'b' }];
      expect(prependUniqueById(incoming, prev)).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    });
  });
});
