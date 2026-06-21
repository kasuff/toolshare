export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error, '').toLowerCase();
  return message.includes('zu viele anfragen') || message.includes('rate limit');
}
