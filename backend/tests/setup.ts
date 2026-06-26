process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare";
// Mind. 32 Zeichen, damit die Secret-Stärke-Prüfung in config/env.ts greift.
process.env.JWT_SECRET ??= "test-secret-at-least-32-chars-long!!";
