// 启动真实 stdio 服务，验证公开工具、参数校验与协议版本。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PLUGIN_NAME, PLUGIN_VERSION } from '../../src/plugin-info.js';

test('stdio server exposes scoped tools, validates patches, and can inspect a project without Pixso', async () => {
  const c = new Client({ name: 'plugin-test', version: '1.0.0' });
  const t = new StdioClientTransport({
    command: process.execPath,
    args: ['src/cli/server.js'],
    stderr: 'pipe',
  });
  try {
    await c.connect(t);
    // 验证 initialize 握手的真实身份，防止升级 manifest 后仍对外报告旧版本。
    assert.deepEqual(c.getServerVersion(), { name: PLUGIN_NAME, version: PLUGIN_VERSION });
    const names = (await c.listTools()).tools.map((x) => x.name);
    assert.ok(names.includes('pixso_patch'));
    assert.ok(names.includes('pixso_begin'));
    assert.ok(!names.includes('eval_script'));
    // 三库共存时禁止缺失 libraryId 的历史调用，避免把同一节点 ID 解析到错误库。
    for (const [name, args] of [
      ['pixso_library', { page: 'Button' }],
      [
        'pixso_patch',
        {
          scopeToken: 'not-real',
          expectedRevision: 'old',
          operations: [
            { op: 'library-instance', key: 'button', parentId: '1:2', familyId: '144:5014' },
          ],
        },
      ],
    ]) {
      const rejected = await c.callTool({ name, arguments: args });
      assert.equal(rejected.isError, true);
      assert.match(rejected.content[0].text, /libraryId/);
    }
    const library = await c.callTool({
      name: 'pixso_library',
      arguments: { libraryId: 'ant-design-vue-community', page: 'Button', limit: 1 },
    });
    assert.notEqual(library.isError, true);
    assert.equal(library.structuredContent.libraryId, 'ant-design-vue-community');
    const project = await c.callTool({
      name: 'inspect_vue_project',
      arguments: { projectRoot: process.cwd() },
    });
    assert.notEqual(project.isError, true);
    assert.ok(project.structuredContent.antDesignVue);
    const rejected = await c.callTool({
      name: 'pixso_patch',
      arguments: {
        scopeToken: 'not-real',
        expectedRevision: 'old',
        operations: [{ op: 'update', nodeId: '1:1', props: { arbitraryCode: 'danger' } }],
      },
    });
    assert.equal(rejected.isError, true);
  } finally {
    await c.close();
  }
});
