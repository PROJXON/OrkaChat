import { resolveMediaPathUrls, resolveMediaUrlWithFallback } from '../resolveMediaUrl';

describe('resolveMediaUrl', () => {
  describe('resolveMediaUrlWithFallback', () => {
    it('returns preferred when it resolves (does not try fallback)', async () => {
      const resolvePathUrl = jest.fn(async (path: string) =>
        path === 'preferred' ? 'https://cdn.example.com/p' : null,
      );

      const url = await resolveMediaUrlWithFallback(resolvePathUrl, 'preferred', 'fallback');

      expect(url).toBe('https://cdn.example.com/p');
      expect(resolvePathUrl).toHaveBeenCalledTimes(1);
      expect(resolvePathUrl).toHaveBeenCalledWith('preferred');
    });

    it('falls back when preferred fails', async () => {
      const resolvePathUrl = jest.fn(async (path: string) =>
        path === 'fallback' ? 'https://cdn.example.com/f' : null,
      );

      const url = await resolveMediaUrlWithFallback(resolvePathUrl, 'preferred', 'fallback');

      expect(url).toBe('https://cdn.example.com/f');
      expect(resolvePathUrl).toHaveBeenCalledTimes(2);
      expect(resolvePathUrl).toHaveBeenNthCalledWith(1, 'preferred');
      expect(resolvePathUrl).toHaveBeenNthCalledWith(2, 'fallback');
    });

    it('trims preferred and fallback paths', async () => {
      const resolvePathUrl = jest.fn(async (path: string) => `URL:${path}`);

      const url = await resolveMediaUrlWithFallback(
        resolvePathUrl,
        '  preferred  ',
        '  fallback  ',
      );

      expect(url).toBe('URL:preferred');
      expect(resolvePathUrl).toHaveBeenCalledWith('preferred');
    });

    it('does not call resolver twice when fallback equals preferred', async () => {
      const resolvePathUrl = jest.fn(async (_path: string) => null);

      const url = await resolveMediaUrlWithFallback(resolvePathUrl, 'same', 'same');

      expect(url).toBeNull();
      expect(resolvePathUrl).toHaveBeenCalledTimes(1);
      expect(resolvePathUrl).toHaveBeenCalledWith('same');
    });
  });

  describe('resolveMediaPathUrls', () => {
    it('returns same-length array; null for empty/missing paths', async () => {
      const resolvePathUrl = jest.fn(async (path: string) => `URL:${path}`);

      const urls = await resolveMediaPathUrls(resolvePathUrl, [
        { path: 'a' },
        { path: '   ' },
        { path: null },
        {},
        { path: 'b' },
      ]);

      expect(urls).toEqual(['URL:a', null, null, null, 'URL:b']);
      expect(resolvePathUrl).toHaveBeenCalledTimes(2);
      expect(resolvePathUrl).toHaveBeenNthCalledWith(1, 'a');
      expect(resolvePathUrl).toHaveBeenNthCalledWith(2, 'b');
    });
  });
});
