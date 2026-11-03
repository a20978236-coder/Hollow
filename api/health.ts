import { checkAccess, env } from './_lib';

// GET /api/health — reports which backend features are really configured.
// Only true/false flags are returned; secret keys never leave the server.
export function GET(req: Request): Response {
  const locked = Boolean(process.env.HOLLOW_ACCESS_CODE);
  return Response.json({
    ok: true,
    ai: Boolean(env.anthropicKey()),
    voice: Boolean(env.elevenKey()),
    locked,
    authorized: checkAccess(req) === null,
    time: new Date().toISOString(),
  });
}
