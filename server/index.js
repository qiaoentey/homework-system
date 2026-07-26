import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp({ config });

if (config.environment === "production") {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const client = path.join(root, "dist", "client");

  app.use(express.static(client));
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(client, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Daycare server listening on port ${config.port}`);
});
