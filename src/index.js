import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

app.listen(3000);
const nodeHandler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, env, ctx) {
    // D1 is a Worker binding (object), not a string secret. Keep it separate
    // from process.env and fail closed when it is absent.
    globalThis.__SCREENING_D1 = env?.DB || null;

    if (env && typeof env === "object") {
      for (const [key, value] of Object.entries(env)) {
        if (value == null || typeof value === "object") continue;
        try { process.env[key] = String(value); } catch {}
      }
    }
    return nodeHandler.fetch(request, env, ctx);
  },
};
