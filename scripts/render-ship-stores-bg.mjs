/**
 * Render empty Ship Stores PDF templates to PNG via Chromium + pdf.js (in-browser).
 * Run: node scripts/render-ship-stores-bg.mjs
 */
import { chromium } from 'playwright';
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        let rel = decodeURIComponent(url.pathname);
        if (rel === '/') rel = '/scripts/ship-stores-bg-render.html';
        const filePath = join(root, rel.replace(/^\//, ''));
        if (!filePath.startsWith(root) || !statSync(filePath).isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const targets = [
  {
    pdf: '/public/ship-stores-empty.pdf',
    png: join(root, 'public/forms/ship-stores-form-01/ship-stores-form-01-bg.png'),
  },
  {
    pdf: '/public/ship-stores-02-empty.pdf',
    png: join(root, 'public/forms/ship-stores-form-02/ship-stores-form-02-bg.png'),
  },
];

async function renderPdfToPng(browser, baseUrl, pdfPath, pngPath) {
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[${pdfPath}]`, msg.type(), msg.text()));
  page.on('pageerror', (err) => console.error(`[${pdfPath}] pageerror`, err.message));

  const url = `${baseUrl}/scripts/ship-stores-bg-render.html?pdf=${encodeURIComponent(`${baseUrl}${pdfPath}`)}&scale=2`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(
    () => window.__renderDone === true || typeof window.__renderError === 'string',
    { timeout: 60000 },
  );
  const err = await page.evaluate(() => window.__renderError || '');
  if (err) throw new Error(`Render failed for ${pdfPath}: ${err}`);

  const box = await page.locator('#c').boundingBox();
  if (!box) throw new Error(`Canvas missing for ${pdfPath}`);
  const buf = await page.locator('#c').screenshot({ type: 'png' });
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, buf);
  console.log(`Wrote ${pngPath} (${buf.length} bytes, ${Math.round(box.width)}x${Math.round(box.height)})`);
  await page.close();
}

const { server, baseUrl } = await startStaticServer();
const browser = await chromium.launch();
try {
  for (const t of targets) {
    await renderPdfToPng(browser, baseUrl, t.pdf, t.png);
  }
} finally {
  await browser.close();
  server.close();
}
