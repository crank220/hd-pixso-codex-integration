// 按明确的文件清单生成插件 ZIP 和 SHA256 校验文件。
import { mkdir, cp, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const name = 'hd-pixso-codex',
  version = JSON.parse(await readFile('package.json', 'utf8')).version;
const root = `artifacts/${name}`;
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
for (const path of [
  'package.json',
  'plugin.json',
  'mcp.json',
  '.codex-plugin',
  '.mcp.json',
  '.agents',
  'dist',
  'skills',
  'assets',
  'README.md',
  'docs',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'examples',
])
  await cp(path, `${root}/${path}`, {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).includes('__pycache__') && !path.endsWith('.pyc'),
  });
const archive = `artifacts/${name}-${version}.zip`;
await rm(archive, { force: true });
execFileSync('zip', ['-qr', `${name}-${version}.zip`, name], { cwd: 'artifacts' });
const hash = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
await writeFile(`${archive}.sha256`, `${hash}  ${name}-${version}.zip\n`);
console.log(`${archive}\nSHA256 ${hash}`);
