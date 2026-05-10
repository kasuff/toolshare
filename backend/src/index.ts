import { createApp } from "./app";
import { env } from "./config/env";
import { bootstrapManagerAllowlist } from "./modules/users/manager-allowlist.bootstrap";

const start = async () => {
  await bootstrapManagerAllowlist();

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });
};

void start();
