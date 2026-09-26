// Assemble the Firebase Hosting folder:
//   /       landing page   (packages/landing/dist)
//   /app/   mobile PWA     (packages/mobile/build, built with homepage "/app")
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'hosting');
const landing = resolve(root, 'packages/landing/dist');
const app = resolve(root, 'packages/mobile/build');

for (const [name, dir] of [['landing', landing], ['mobile', app]]) {
  if (!existsSync(dir)) {
    console.error(`Missing ${name} build at ${dir}. Run npm run build:${name} first.`);
    process.exit(1);
  }
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(landing, out, { recursive: true });
cpSync(app, resolve(out, 'app'), { recursive: true });
console.log('Hosting folder ready: hosting/ (landing at /, PWA at /app/)');
