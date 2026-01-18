import { formatSeenLabel, getSeenLabelForCreatedAt } from '../seenLabels';

describe('seenLabels', () => {
  describe('formatSeenLabel', () => {
    it('returns "Seen" for invalid or non-positive timestamps', () => {
      expect(formatSeenLabel(0, new Date())).toBe('Seen');
      expect(formatSeenLabel(-1, new Date())).toBe('Seen');
      expect(formatSeenLabel(Number.NaN, new Date())).toBe('Seen');
    });

    it('formats as "Seen · HH:MM" when readAt is today', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0); // Jan 2, 2026 local
      const readAtSec = Math.floor(now.getTime() / 1000);

      const label = formatSeenLabel(readAtSec, now);

      expect(label.startsWith('Seen · ')).toBe(true);
      expect(label.split(' · ').length).toBe(2); // "Seen · TIME"
    });

    it('formats as "Seen · Mon · HH:MM" when readAt is within the last 6 days', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0);
      const yesterday = new Date(2026, 0, 1, 12, 0, 0);
      const readAtSec = Math.floor(yesterday.getTime() / 1000);

      const label = formatSeenLabel(readAtSec, now);

      // Expect two separators: "Seen · WEEKDAY · TIME"
      expect(label.split(' · ').length).toBe(3);
      expect(label.startsWith('Seen · ')).toBe(true);
    });

    it('includes a two-digit year for timestamps >= 1 year ago (e.g. "\\\'25")', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0);
      const older = new Date(2024, 11, 31, 12, 0, 0);
      const readAtSec = Math.floor(older.getTime() / 1000);

      const label = formatSeenLabel(readAtSec, now);

      expect(label.includes(" '24 · ")).toBe(true);
    });
  });

  describe('getSeenLabelForCreatedAt', () => {
    it('returns null when the map has no valid seen time for that createdAt', () => {
      expect(getSeenLabelForCreatedAt({}, 123)).toBeNull();
      expect(getSeenLabelForCreatedAt({ '123': 0 }, 123)).toBeNull();
    });

    it('returns a formatted label when a valid seen time exists', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0);
      const readAtSec = Math.floor(now.getTime() / 1000);

      const label = getSeenLabelForCreatedAt({ '1000': readAtSec }, 1000);

      expect(label).not.toBeNull();
      expect(label?.startsWith('Seen')).toBe(true);
    });
  });
});
