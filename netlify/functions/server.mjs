import serverless from 'serverless-http';
import app from '../../src/server.js';

// Netlify rewrites /api/* and /health here while preserving the original path.
export const handler = serverless(app, {
  binary: false,
});
