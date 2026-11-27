// 在临时目录解压插件，验证脱离源码与 node_modules 后的真实启动行为。
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const temp = await mkdtemp(join(tmpdir(), 'hd-pixso-package-'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const client = new Client({ name: 'package-acceptance', version });
try {
  // 检查实际 ZIP 清单，确保目录迁移没有把开发依赖、凭据或本地缓存带入发布包。
  const archivePath = `artifacts/hd-pixso-codex-${version}.zip`;
  const entries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
    .trim()
    .split('\n');
  for (const entry of entries) {
    if (
      !entry.startsWith('hd-pixso-codex/') ||
      entry
        .split('/')
        .some((part) => ['..', 'node_modules', '.git', '__pycache__'].includes(part)) ||
      /^hd-pixso-codex\/(src|tests|scripts|artifacts)\//.test(entry) ||
      entry.split('/').some((part) => part.startsWith('.env') || part === 'pixso-oauth.json') ||
      entry.endsWith('.pyc')
    )
      throw Error(`Unexpected release entry: ${entry}`);
  }
  execFileSync('unzip', ['-q', `artifacts/hd-pixso-codex-${version}.zip`, '-d', temp]);
  const root = join(temp, 'hd-pixso-codex');
  await access(join(root, 'examples/pixso-codex.example.json'));
  await access(join(root, 'docs/architecture.md'));
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(root, 'dist/server.js')],
      cwd: root,
      stderr: 'inherit',
    }),
  );
  if (client.getServerVersion()?.version !== version)
    throw Error('Packaged MCP version differs from package.json');
  const tools = await client.listTools();
  if (tools.tools.length !== 12) throw Error('Incomplete package tool inventory');
  const result = await client.callTool({
    name: 'resolve_vue_component',
    arguments: { semantic: 'table' },
  });
  if (result.isError || result.structuredContent.code.name !== 'a-table')
    throw Error('Packaged component resolver failed');
  const library = await client.callTool({
    name: 'pixso_library',
    arguments: { libraryId: 'ant-design-vue-community', page: 'Button', limit: 1 },
  });
  if (
    library.isError ||
    library.structuredContent.coverage.pages !== 87 ||
    !library.structuredContent.families[0]?.familyId
  )
    throw Error('Packaged complete library catalog is missing');
  for (const [libraryId, kind, total] of [
    ['hd-company-styles', 'styles', 36],
    ['hd-annotations', 'variables', 1],
    ['hd-annotations', 'components', 9],
  ]) {
    const result = await client.callTool({
      name: 'pixso_library',
      arguments: { libraryId, kind, limit: 1 },
    });
    if (
      result.isError ||
      result.structuredContent.total !== total ||
      result.structuredContent.libraryId !== libraryId
    )
      throw Error('Packaged company resource library is incomplete');
  }
  const search = JSON.parse(
    execFileSync(
      process.env.PYTHON || 'python3',
      [
        join(root, 'skills/hd-design/vendor/ui-ux-pro-max/scripts/search.py'),
        'active selected state',
        '--domain',
        'ux',
        '--json',
      ],
      { encoding: 'utf8', cwd: temp },
    ),
  );
  if (search.domain !== 'ux' || !search.results?.length)
    throw Error('Packaged UI/UX search failed outside repository');
  console.log(
    'Extracted ZIP starts standalone without node_modules; 12 tools, component resolution and bundled UI/UX search verified',
  );
} finally {
  await client.close();
  await rm(temp, { recursive: true, force: true });
}
