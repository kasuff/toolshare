export function isValidRating(score: number): boolean {
  return score >= 1 && score <= 5;
}

export function formatRatingScore(score: number): string {
  return Math.max(0, Math.min(5, score)).toFixed(1);
}

export function calculateAverageRating(ratings: number[]): number {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, curr) => acc + curr, 0);
  return sum / ratings.length;
}
