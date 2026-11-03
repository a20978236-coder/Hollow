import { defineConfig, type Plugin } from 'vite';

// Lets `npm run dev` serve the same /api/* functions that Vercel runs in production,
// so the backend can be tested without deploying.
function localApi(): Plugin {
  return {
    name: 'hollow-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const name = req.url.slice(5).split('?')[0];
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (!handler) { res.statusCode = 405; return res.end(); }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method, headers: req.headers as Record<string, string>, body,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (!response.body) return res.end();
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (e) {
          console.error(e);
          res.statusCode = 404;
          res.end('not found');
        }
      });
    },
  };
}

export default defineConfig({ plugins: [localApi()] });
