import { toCdnUrl } from '../cdn';

describe('toCdnUrl', () => {
  it('joins base + path', () => {
    expect(toCdnUrl('https://cdn.example.com', 'uploads/a.png')).toBe(
      'https://cdn.example.com/uploads/a.png',
    );
  });

  it('handles extra slashes', () => {
    expect(toCdnUrl('https://cdn.example.com/', '/uploads/a.png')).toBe(
      'https://cdn.example.com/uploads/a.png',
    );
  });

  it('returns empty string when base is empty', () => {
    expect(toCdnUrl('', 'uploads/a.png')).toBe('');
  });

  it('returns empty string when path is empty', () => {
    expect(toCdnUrl('https://cdn.example.com', '')).toBe('');
  });

  it('returns empty string for invalid base URL', () => {
    expect(toCdnUrl('not-a-url', 'uploads/a.png')).toBe('');
  });
});
