process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare";
process.env.JWT_SECRET ??= "test-secret-at-least-32-chars-long!!";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-chars!!";
