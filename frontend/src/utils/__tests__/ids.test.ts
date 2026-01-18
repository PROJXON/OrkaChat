import { randomBase36Suffix, timestampId } from '../ids';

describe('ids', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('randomBase36Suffix', () => {
    it('is deterministic when Math.random is mocked', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      const suf = randomBase36Suffix();

      expect(suf).toEqual(expect.any(String));
      expect(suf.length).toBeGreaterThan(0);
    });
  });

  describe('timestampId', () => {
    it('uses the provided timestamp (floored) and no prefix', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const id = timestampId(1700.9);

      expect(id.startsWith('1700-')).toBe(true);
    });

    it('uses Date.now() when ts is not finite', () => {
      jest.spyOn(Date, 'now').mockReturnValue(424242);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const id = timestampId(Number.NaN);

      expect(id.startsWith('424242-')).toBe(true);
    });

    it('includes prefix when provided', () => {
      jest.spyOn(Date, 'now').mockReturnValue(10);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const id = timestampId(Number.NaN, 'msg');

      expect(id.startsWith('msg-10-')).toBe(true);
    });
  });
});
