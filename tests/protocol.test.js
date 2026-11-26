import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('stdio server exposes scoped tools, validates patches, and can inspect a project without Pixso', async () => {
 const c = new Client({ name: 'plugin-test', version: '1.0.0' });
 const t = new StdioClientTransport({ command: process.execPath, args: ['src/server.js'], stderr: 'pipe' });
 try {
  await c.connect(t);
  const names = (await c.listTools()).tools.map(x => x.name);
  assert.ok(names.includes('pixso_patch')); assert.ok(names.includes('pixso_begin'));
  assert.ok(!names.includes('eval_script'));
  const project = await c.callTool({ name: 'inspect_vue_project', arguments: { projectRoot: process.cwd() } });
  assert.notEqual(project.isError, true); assert.ok(project.structuredContent.antDesignVue);
  const rejected = await c.callTool({ name: 'pixso_patch', arguments: { scopeToken: 'not-real', expectedRevision: 'old', operations: [{ op: 'update', nodeId: '1:1', props: { arbitraryCode: 'danger' } }] } });
  assert.equal(rejected.isError, true);
 } finally { await c.close(); }
});
