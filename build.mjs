import { cp, mkdir, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const files = ['index.html', 'app.js', 'styles.css'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

for (const file of files) {
  try {
    await access(file, constants.R_OK);
  } catch {
    throw new Error(`File static wajib tidak ditemukan di root repository: ${file}`);
  }
  await cp(file, `dist/${file}`);
}

console.log('Build selesai: index.html, app.js, styles.css -> dist/');
