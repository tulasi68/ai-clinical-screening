import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

export default httpServerHandler({ port: 3000 });
