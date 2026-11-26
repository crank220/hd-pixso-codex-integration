import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const temp = await mkdtemp(join(tmpdir(), 'hd-pixso-package-'));
const client = new Client({ name: 'package-acceptance', version: '0.1.0' });
try {
 execFileSync('unzip', ['-q', 'artifacts/hd-pixso-codex-0.1.0.zip', '-d', temp]);
 const root = join(temp,'hd-pixso-codex');
 await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root,'dist/server.js')], cwd: root, stderr: 'inherit' }));
 const tools = await client.listTools();
 if (tools.tools.length !== 10) throw Error('Incomplete package tool inventory');
 const result = await client.callTool({ name: 'resolve_vue_component', arguments: { semantic: 'table' } });
 if (result.isError || result.structuredContent.code.name !== 'a-table') throw Error('Packaged component resolver failed');
 console.log('Extracted ZIP starts standalone without node_modules; 10 tools and component resolution verified');
} finally { await client.close(); await rm(temp, { recursive: true, force: true }); }
