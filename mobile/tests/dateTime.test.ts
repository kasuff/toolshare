import { describe, it, expect } from 'vitest';
import {
  toLocalDateKey,
  toLocalTimeKey,
  parseLocalDateKey,
  parseLocalTimeKey,
  formatDateLabel,
  formatTimeLabel,
  getDefaultDateRange,
} from '../utils/dateTime';

describe('toLocalDateKey', () => {
  it('formats a date as zero-padded YYYY-MM-DD', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('toLocalTimeKey', () => {
  it('formats a time as zero-padded HH:mm', () => {
    expect(toLocalTimeKey(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(toLocalTimeKey(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('parseLocalDateKey', () => {
  it('parses a valid date key to local noon', () => {
    const date = parseLocalDateKey('2026-06-19');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(5);
    expect(date?.getDate()).toBe(19);
    expect(date?.getHours()).toBe(12);
  });

  it('returns null for empty or whitespace input', () => {
    expect(parseLocalDateKey('')).toBeNull();
    expect(parseLocalDateKey('   ')).toBeNull();
  });

  it('returns null when any component is missing or zero', () => {
    expect(parseLocalDateKey('2026-06')).toBeNull();
    expect(parseLocalDateKey('0-1-1')).toBeNull();
    expect(parseLocalDateKey('abc')).toBeNull();
  });

  it('round-trips with toLocalDateKey', () => {
    const key = '2026-02-28';
    expect(toLocalDateKey(parseLocalDateKey(key)!)).toBe(key);
  });
});

describe('parseLocalTimeKey', () => {
  it('applies the time onto the provided base date', () => {
    const date = parseLocalTimeKey('08:30', '2026-06-19');
    expect(toLocalDateKey(date)).toBe('2026-06-19');
    expect(date.getHours()).toBe(8);
    expect(date.getMinutes()).toBe(30);
  });

  it('falls back to zero for non-numeric components', () => {
    const date = parseLocalTimeKey('bad:nope', '2026-06-19');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('uses today when no base date is given', () => {
    const before = new Date();
    const date = parseLocalTimeKey('10:15');
    expect(date.getFullYear()).toBe(before.getFullYear());
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(15);
  });
});

describe('formatDateLabel', () => {
  it('returns the placeholder for empty input', () => {
    expect(formatDateLabel('')).toBe('Datum wählen');
    expect(formatDateLabel('', 'Pick a date')).toBe('Pick a date');
  });

  it('formats a valid date key in de-DE', () => {
    expect(formatDateLabel('2026-06-19')).toBe('19.06.2026');
  });

  it('returns the raw value when it cannot be parsed', () => {
    expect(formatDateLabel('not-a-date')).toBe('not-a-date');
  });
});

describe('formatTimeLabel', () => {
  it('returns the placeholder for empty input', () => {
    expect(formatTimeLabel('')).toBe('Uhrzeit wählen');
    expect(formatTimeLabel('  ', 'Pick a time')).toBe('Pick a time');
  });

  it('formats a valid time key in de-DE', () => {
    expect(formatTimeLabel('08:05')).toBe('08:05');
  });
});

describe('getDefaultDateRange', () => {
  it('returns tomorrow and the day after as date keys', () => {
    const { startDate, endDate } = getDefaultDateRange();

    const expectedStart = new Date();
    expectedStart.setDate(expectedStart.getDate() + 1);
    const expectedEnd = new Date(expectedStart);
    expectedEnd.setDate(expectedEnd.getDate() + 1);

    expect(startDate).toBe(toLocalDateKey(expectedStart));
    expect(endDate).toBe(toLocalDateKey(expectedEnd));
  });
});
