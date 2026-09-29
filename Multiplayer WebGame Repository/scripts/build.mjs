import { cp, mkdir, rm } from 'node:fs/promises';

await mkdir('dist/public', { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js', 'v11.js']) {
  await cp(file, `dist/public/${file}`);
}
console.log('Built One More Relic v1.1');
