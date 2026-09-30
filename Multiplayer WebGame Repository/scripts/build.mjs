import { cp, mkdir, rm } from 'node:fs/promises';

await mkdir('dist/public', { recursive: true });
for (const file of ['index.html', 'style.css', 'game.js', 'v11.js', 'network.js']) {
  await cp(file, `dist/public/${file}`);
}
await mkdir('dist/public/shared', { recursive: true });
await cp('dist/shared/movement.js', 'dist/public/shared/movement.js');
console.log('Built One More Relic v1.2.2');
