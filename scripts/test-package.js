import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const temp = await mkdtemp(join(tmpdir(), 'hd-pixso-package-'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const client = new Client({ name: 'package-acceptance', version });
try {
 execFileSync('unzip', ['-q', `artifacts/hd-pixso-codex-${version}.zip`, '-d', temp]);
 const root = join(temp,'hd-pixso-codex');
 await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root,'dist/server.js')], cwd: root, stderr: 'inherit' }));
 const tools = await client.listTools();
 if (tools.tools.length !== 11) throw Error('Incomplete package tool inventory');
 const result = await client.callTool({ name: 'resolve_vue_component', arguments: { semantic: 'table' } });
 if (result.isError || result.structuredContent.code.name !== 'a-table') throw Error('Packaged component resolver failed');
 const search=JSON.parse(execFileSync(process.env.PYTHON||'python3',[join(root,'skills/hd-design/vendor/ui-ux-pro-max/scripts/search.py'),'active selected state','--domain','ux','--json'],{encoding:'utf8',cwd:temp}));
 if(search.domain!=='ux'||!search.results?.length)throw Error('Packaged UI/UX search failed outside repository');
 console.log('Extracted ZIP starts standalone without node_modules; 11 tools, component resolution and bundled UI/UX search verified');
} finally { await client.close(); await rm(temp, { recursive: true, force: true }); }
