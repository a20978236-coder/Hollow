// GET /api/health — tells the app which backend features are really configured.
// Runs on Vercel (server side). Secret keys live in Vercel environment variables,
// never in the app that runs on the iPhone; only true/false flags are returned here.
export function GET(): Response {
  return Response.json({
    ok: true,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    time: new Date().toISOString(),
  });
}
