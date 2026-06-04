/**
 * Removes baked-in sample captain name from narcotic empty templates
 * (white patch to the right of the left table border so grid lines stay intact).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_HEIGHT_PT = 842;
/** Sample text baseline (top-down, from dump-pdf-text). */
const SAMPLE_BASELINE_Y = 476;
/** Left table border — do not paint white on or left of this. */
const TABLE_LEFT_BORDER_X = 51;
const SAMPLE_TEXT = 'Capt. Zhukhariev, Dmytro';
const FONT_SIZE = 10;

const targets = [
  path.join(root, 'Narcotic List — empty.pdf'),
  path.join(root, 'public', 'narcotic-list-empty.pdf'),
];

async function strip(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('Skip (missing):', filePath);
    return;
  }
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(fs.readFileSync(filePath));
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const textW = font.widthOfTextAtSize(SAMPLE_TEXT, FONT_SIZE);
  const clearY = PAGE_HEIGHT_PT - SAMPLE_BASELINE_Y - 4;
  const clearH = FONT_SIZE + 6;
  // Keep the left grid line at TABLE_LEFT_BORDER_X: clear in two bands around it.
  page.drawRectangle({
    x: 48,
    y: clearY,
    width: TABLE_LEFT_BORDER_X - 48 - 0.5,
    height: clearH,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: TABLE_LEFT_BORDER_X + 1,
    y: clearY,
    width: textW + 8,
    height: clearH,
    color: rgb(1, 1, 1),
  });
  fs.writeFileSync(filePath, await pdf.save());
  console.log('Stripped sample captain line:', filePath);
}

for (const file of targets) {
  await strip(file);
}
