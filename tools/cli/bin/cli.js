import { spawnSync } from 'node:child_process';

spawnSync('bun', ['r', 'affine.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
