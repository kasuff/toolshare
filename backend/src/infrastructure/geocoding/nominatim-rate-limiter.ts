export function createNominatimRateLimiter(minIntervalMs = 1000) {
  let lastRequestAt = 0;
  let chain: Promise<void> = Promise.resolve();

  return async function acquire(): Promise<void> {
    chain = chain.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, lastRequestAt + minIntervalMs - now);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastRequestAt = Date.now();
    });
    await chain;
  };
}
