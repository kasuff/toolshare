import { afterEach, describe, expect, it, vi } from "vitest";

type MockResponse = {
  statusCode: number;
  body?: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  setHeader: () => MockResponse;
  getHeader: () => unknown;
  end: () => void;
};

function createMockResponse(): MockResponse {
  const response = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
    setHeader() {
      return response;
    },
    getHeader() {
      return undefined;
    },
    end() {}
  } satisfies MockResponse;

  return response;
}

async function loadLimiters() {
  vi.resetModules();
  const { apiRateLimiter, authRateLimiter } = await import("../src/middleware/rate-limit");
  return { apiRateLimiter, authRateLimiter };
}

async function invoke(middleware: (req: any, res: any, next: () => void) => void) {
  const req = {
    ip: "127.0.0.1",
    method: "GET",
    path: "/",
    originalUrl: "/",
    headers: {},
    app: { get: () => undefined }
  };
  const res = createMockResponse();
  await new Promise<void>((resolve, reject) => {
    try {
      res.json = (payload: unknown) => {
        res.body = payload;
        resolve();
        return res;
      };
      res.end = () => {
        resolve();
      };
      middleware(req, res, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
  return res;
}

describe("rate limiting", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("returns 429 when the global API limit is exceeded", async () => {
    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_AUTH_MAX = "100";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const { apiRateLimiter } = await loadLimiters();
    const first = await invoke(apiRateLimiter);
    const second = await invoke(apiRateLimiter);
    const limited = await invoke(apiRateLimiter);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toMatchObject({
      message: expect.stringMatching(/too many requests/i)
    });
  });

  it("returns 429 when the auth limit is exceeded", async () => {
    process.env.RATE_LIMIT_MAX = "1000";
    process.env.RATE_LIMIT_AUTH_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const { authRateLimiter } = await loadLimiters();
    const first = await invoke(authRateLimiter);
    const second = await invoke(authRateLimiter);
    const limited = await invoke(authRateLimiter);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toMatchObject({
      message: expect.stringMatching(/authentication attempts/i)
    });
  });
});
