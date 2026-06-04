/**
 * Removes baked-in sample text from SSO-0108 empty template.
 * Patch size matches pdf.js text bbox (w×h) so glyph tops are not left as black specks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_HEIGHT_PT = 841;

/** { baselineY (top-down), x, width, height } from dump-pdf-text-detail.mjs */
const PATCHES = [
  { label: 'vessel name', baselineY: 101, x: 167, width: 54, height: 16 },
  { label: 'marsec prefix', baselineY: 126, x: 471, width: 48, height: 16 },
  { label: 'marsec digit', baselineY: 126, x: 516, width: 12, height: 16 },
];

const targets = [path.join(root, 'public', 'sso-0108-port-calls-empty.pdf')];

async function strip(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('Skip (missing):', filePath);
    return;
  }
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(fs.readFileSync(filePath));
  const page = pdf.getPages()[0];
  const white = rgb(1, 1, 1);

  for (const p of PATCHES) {
    page.drawRectangle({
      x: p.x,
      y: PAGE_HEIGHT_PT - p.baselineY - 3,
      width: p.width,
      height: p.height,
      color: white,
    });
    console.log(`  patch ${p.label}: x=${p.x} y=${p.baselineY} ${p.width}x${p.height}`);
  }

  fs.writeFileSync(filePath, await pdf.save());
  console.log('Stripped sample text:', filePath);
}

for (const file of targets) {
  await strip(file);
}
