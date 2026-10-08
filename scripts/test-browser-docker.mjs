import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';

const { devDependencies } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${devDependencies['@playwright/test']}-noble`;
const { uid, gid } = userInfo();
const command = process.argv.slice(2);
const result = spawnSync('docker', [
  'run', '--rm', '--init', '--ipc=host',
  ...(uid >= 0 ? ['--user', `${uid}:${gid}`] : []),
  '--volume', `${process.cwd()}:/work`, '--workdir', '/work',
  '--env', 'CI=1', '--env', 'ASTRO_TELEMETRY_DISABLED=1', '--env', 'NPM_CONFIG_CACHE=/tmp/npm-cache',
  image, ...(command.length ? command : ['npm', 'run', 'verify']),
], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
