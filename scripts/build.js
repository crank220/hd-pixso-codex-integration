// 构建三个独立 Node.js 入口，并收集实际打入 bundle 的依赖许可证。
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
// dist 文件名是安装契约：目录重组后仍输出 server.js、doctor.js 和 login.js。
const result = await build({
  entryPoints: ['src/cli/server.js', 'src/cli/doctor.js', 'src/cli/login.js'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'bundle',
  metafile: true,
  legalComments: 'external',
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  minify: false,
});
// 只为实际进入 bundle 的依赖生成许可清单，避免遗漏传递依赖。
const dirs = [
  ...new Set(
    Object.keys(result.metafile.inputs)
      .filter((p) => p.startsWith('node_modules/'))
      .map((p) => {
        const parts = p.split('/');
        return parts[1].startsWith('@') ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
      }),
  ),
].sort();
const notices = [];
for (const dir of dirs) {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  let license = null;
  for (const name of [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'license',
    'license.md',
    'license.txt',
    'LICENCE',
  ]) {
    try {
      license = await readFile(join(dir, name), 'utf8');
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  if (!license) throw Error(`Missing redistribution license: ${pkg.name}`);
  notices.push(`=== ${pkg.name}@${pkg.version} (${pkg.license || 'see below'}) ===\n${license}`);
}
await writeFile(
  'dist/THIRD_PARTY_LICENSES.txt',
  notices
    .join('\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n'),
);
console.log(`Built standalone runtime bundles and ${notices.length} dependency license notices`);
