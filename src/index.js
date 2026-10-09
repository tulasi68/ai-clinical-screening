import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

app.listen(3000);

// Export a fetch handler that copies Worker env/secrets onto process.env
// before the Node HTTP server handles the request. Required so store.js
// (and other modules) can read SUPABASE_* / SCREENING_API_KEY via process.env.
const nodeHandler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, env, ctx) {
    if (env && typeof env === "object") {
      for (const [key, value] of Object.entries(env)) {
        if (value == null || typeof value === "object") continue;
        try {
          process.env[key] = String(value);
        } catch {
          // ignore read-only env slots
        }
      }
    }
    return nodeHandler.fetch(request, env, ctx);
  },
};
