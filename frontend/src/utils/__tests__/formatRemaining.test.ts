import { formatRemaining } from '../formatRemaining';

describe('formatRemaining', () => {
  it('returns 0s for empty/invalid/non-positive inputs', () => {
    expect(formatRemaining(0)).toBe('0s');
    expect(formatRemaining(-1)).toBe('0s');
    expect(formatRemaining(NaN)).toBe('0s');
  });

  it('formats seconds under a minute', () => {
    expect(formatRemaining(1)).toBe('1s');
    expect(formatRemaining(59)).toBe('59s');
  });

  it('formats minutes', () => {
    expect(formatRemaining(60)).toBe('1m');
    expect(formatRemaining(61)).toBe('1m');
  });

  it('formats hours (and optionally minutes)', () => {
    expect(formatRemaining(3600)).toBe('1h');
    expect(formatRemaining(3660)).toBe('1h 1m');
  });

  it('formats days (and optionally hours)', () => {
    expect(formatRemaining(86400)).toBe('1d');
    expect(formatRemaining(90000)).toBe('1d 1h');
  });
});
