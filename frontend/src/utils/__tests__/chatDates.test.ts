import { formatChatActivityDate, formatMessageMetaTimestamp } from '../chatDates';

describe('chatDates', () => {
  describe('formatMessageMetaTimestamp', () => {
    it('returns time only for today', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0).getTime();
      const ts = new Date(2026, 0, 2, 8, 30, 0).getTime();

      const out = formatMessageMetaTimestamp(ts, now);

      // "HH:MM" (locale-dependent AM/PM), but should not include our separator.
      expect(out.includes(' · ')).toBe(false);
      expect(out.length).toBeGreaterThan(0);
    });

    it('includes weekday for last 6 days', () => {
      const now = new Date(2026, 0, 7, 12, 0, 0).getTime(); // Tue/Wed depending, but fixed
      const ts = new Date(2026, 0, 6, 8, 30, 0).getTime(); // 1 day ago

      const out = formatMessageMetaTimestamp(ts, now);
      expect(out.split(' · ').length).toBe(2); // "Mon · TIME"
    });

    it('includes month+day (no year) for older than 6 days but < 1 year', () => {
      const now = new Date(2026, 0, 20, 12, 0, 0).getTime();
      const ts = new Date(2026, 0, 1, 8, 30, 0).getTime(); // 19 days ago

      const out = formatMessageMetaTimestamp(ts, now);
      // "Jan 1 · TIME"
      expect(out.split(' · ').length).toBe(2);
      expect(out.includes("'")).toBe(false);
    });

    it('includes two-digit year for >= 1 year', () => {
      const now = new Date(2026, 0, 2, 12, 0, 0).getTime();
      const ts = new Date(2024, 11, 31, 8, 30, 0).getTime();

      const out = formatMessageMetaTimestamp(ts, now);
      expect(out.includes(" '24 · ")).toBe(true);
    });
  });

  describe('formatChatActivityDate', () => {
    it('returns weekday for last 6 days', () => {
      const now = new Date(2026, 0, 7, 12, 0, 0).getTime();
      const ts = new Date(2026, 0, 6, 8, 30, 0).getTime();
      expect(formatChatActivityDate(ts, now).length).toBeGreaterThan(0);
      expect(formatChatActivityDate(ts, now).includes("'")).toBe(false);
    });

    it("returns month+day+'yy for >= 1 year", () => {
      const now = new Date(2026, 0, 2, 12, 0, 0).getTime();
      const ts = new Date(2024, 11, 31, 8, 30, 0).getTime();
      expect(formatChatActivityDate(ts, now).includes("'24")).toBe(true);
    });
  });
});
