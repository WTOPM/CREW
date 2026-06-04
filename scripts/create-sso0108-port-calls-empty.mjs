/**
 * Publishes SSO-0108 Port Calls empty PDF to public/.
 * Windows: uses Word COM if SSO-0108_Port_Calls.docx exists in repo root.
 * Usage: node scripts/create-sso0108-port-calls-empty.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docx = path.join(root, 'SSO-0108_Port_Calls.docx');
const out = path.join(root, 'public', 'sso-0108-port-calls-empty.pdf');

if (!fs.existsSync(docx)) {
  console.error('Missing:', docx);
  process.exit(1);
}

if (process.platform === 'win32') {
  const ps = `
$docx = '${docx.replace(/'/g, "''")}'
$pdf = '${out.replace(/'/g, "''")}'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open($docx)
$doc.ExportAsFixedFormat($pdf, 17)
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.error('On non-Windows, export SSO-0108_Port_Calls.docx to PDF manually as public/sso-0108-port-calls-empty.pdf');
  process.exit(1);
}

console.log('Wrote', out);

const strip = path.join(path.dirname(fileURLToPath(import.meta.url)), 'strip-sso0108-template-sample.mjs');
const r2 = spawnSync(process.execPath, [strip], { stdio: 'inherit', cwd: root });
if (r2.status !== 0) process.exit(r2.status ?? 1);
