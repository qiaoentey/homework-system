import { createServer as createViteServer } from "vite";
import { createApp } from "../../server/app.js";
import { importRosters, ROSTER_FILES } from "../../scripts/import-rosters.mjs";
import { createTestDatabase } from "../helpers/testDatabase.js";

const port = Number(process.env.E2E_PORT ?? 4173);
const emergencyPasswordHash =
  "task-4-test-salt:330dbd3ebcf20a4b02e6fc954a0677540e9a27cfc5ff51d956659ec11877e06fb426131601c8a7765cdd2f51a908b9013eb463625f6123e097ff762fe5b53b00";

const pool = await createTestDatabase();
await importRosters(pool, ROSTER_FILES);

const app = createApp({
  pool,
  config: {
    sessionSecret: "e2e-session-secret",
    environment: "test",
    googleClientId: "e2e-client.apps.googleusercontent.com",
    allowedEmails: ["qiaoen9816@gmail.com"],
    dashboardAllowedEmails: ["qiaoen9816@gmail.com"],
    emergencyPasswordHash,
  },
  googleVerifier: async (credential) => {
    if (credential !== "e2e-google-token") throw new Error("Invalid E2E credential");
    return { email: "qiaoen9816@gmail.com", emailVerified: true };
  },
});
const vite = await createViteServer({
  appType: "spa",
  server: {
    middlewareMode: true,
    hmr: false,
    ws: false,
  },
});
app.use(vite.middlewares);

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`E2E server listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await vite.close();
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}
