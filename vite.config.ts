import { Readable } from 'node:stream';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { solve } from './server/solve';

function localSolveApi(apiKey: string | undefined): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/solve') return next();

    const controller = new AbortController();
    res.once('close', () => controller.abort());
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      signal: controller.signal,
      ...(req.method === 'POST' && { body: Readable.toWeb(req), duplex: 'half' }),
    });
    const response = await solve(request, apiKey);
    if (!res.destroyed) {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    }
  };

  return {
    name: 'local-solve-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GEMINI_');
  return {
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react(), localSolveApi(env.GEMINI_API_KEY)],
  };
});
