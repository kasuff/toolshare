import { describe, it, expect } from 'vitest';
import { isValidRating, formatRatingScore, calculateAverageRating } from '../utils/ratings';

describe('ratings utils', () => {
  describe('isValidRating', () => {
    it('returns true for scores between 1 and 5', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(3)).toBe(true);
      expect(isValidRating(5)).toBe(true);
    });

    it('returns false for scores outside 1-5', () => {
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(-1)).toBe(false);
    });
  });

  describe('formatRatingScore', () => {
    it('formats score to one decimal place', () => {
      expect(formatRatingScore(4)).toBe('4.0');
      expect(formatRatingScore(3.56)).toBe('3.6');
    });

    it('clamps score between 0 and 5', () => {
      expect(formatRatingScore(6)).toBe('5.0');
      expect(formatRatingScore(-2)).toBe('0.0');
    });
  });

  describe('calculateAverageRating', () => {
    it('calculates average correctly', () => {
      expect(calculateAverageRating([4, 5, 3])).toBe(4);
      expect(calculateAverageRating([1, 1])).toBe(1);
    });

    it('returns 0 for empty arrays', () => {
      expect(calculateAverageRating([])).toBe(0);
    });
  });
});
