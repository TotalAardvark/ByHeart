import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function chordUrlScraperPlugin(): Plugin {
  const attachMiddleware = (middlewares: {
    use: (
      route: string,
      fn: (
        req: { url?: string },
        res: {
          statusCode: number;
          setHeader: (k: string, v: string) => void;
          end: (body: string) => void;
        }
      ) => void
    ) => void;
  }) => {
    middlewares.use('/api/scrape-url', async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const target = reqUrl.searchParams.get('url');
        if (!target || !/^https?:\/\//i.test(target)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid or missing URL parameter' }));
          return;
        }

        const upstream = await fetch(target, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!upstream.ok) {
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: `Upstream returned HTTP ${upstream.status}`,
            })
          );
          return;
        }

        const contentType =
          upstream.headers.get('content-type') || 'text/html; charset=utf-8';
        const arrayBuf = await upstream.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(buf as unknown as string);
      } catch (err) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Failed to fetch URL',
          })
        );
      }
    });
  };

  return {
    name: 'chord-url-scraper-proxy',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), chordUrlScraperPlugin()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
} as import('vite').UserConfig);
